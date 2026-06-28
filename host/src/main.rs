//! zkVault off-chain prover agent.
//!
//! This is the piece that holds the user's secret (`balance`). It NEVER
//! sends `balance` anywhere — only the proof (journal + seal) leaves this
//! process.
//!
//! Usage:
//!   cargo run --release -p zkvault-host -- \
//!       --balance 250000 --threshold 100000 --user-secret "alice-wallet-key" \
//!       --out proof.json
//!
//! `proof.json` is then handed to scripts/submit_proof.sh, which calls the
//! deployed Casper contract's `verify_eligibility` entry point.

use anyhow::{Context, Result};
use clap::Parser;
use methods::{ZKVAULT_GUEST_ELF, ZKVAULT_GUEST_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Parser)]
#[command(about = "zkVault off-chain proof generator")]
struct Args {
    /// PRIVATE. The real balance. Never leaves this process.
    #[arg(long)]
    balance: u64,

    /// PUBLIC. The compliance threshold being checked against.
    #[arg(long)]
    threshold: u64,

    /// A user-specific secret (e.g. wallet private key fingerprint, or any
    /// stable per-user secret) used to derive an anonymized on-chain
    /// identifier. Two proofs from the same secret will map to the same
    /// on-chain record; the secret itself never appears in the proof.
    #[arg(long)]
    user_secret: String,

    #[arg(long, default_value = "proof.json")]
    out: String,
}

#[derive(Serialize, Deserialize)]
struct ComplianceInput {
    balance: u64,
    threshold: u64,
    user_id_hash: [u8; 32],
}

/// What gets written to disk for submission to the Casper contract.
/// `seal_hex` / `journal_hex` are exactly the bytes the contract's
/// `verify_eligibility(journal: Vec<u8>, seal: Vec<u8>)` entry point expects.
#[derive(Serialize)]
struct ProofBundle {
    journal_hex: String,
    seal_hex: String,
    method_id_hex: String,
    /// Convenience field for the demo / logs — the contract re-derives this
    /// from the journal itself, it does not trust this field.
    is_eligible: bool,
    user_id_hash_hex: String,
}

fn method_id_to_hex(id: &[u32; 8]) -> String {
    let mut bytes = Vec::with_capacity(32);
    for word in id {
        bytes.extend_from_slice(&word.to_le_bytes());
    }
    hex::encode(bytes)
}

fn main() -> Result<()> {
    let args = Args::parse();

    let user_id_hash: [u8; 32] = Sha256::digest(args.user_secret.as_bytes()).into();

    let input = ComplianceInput {
        balance: args.balance,
        threshold: args.threshold,
        user_id_hash,
    };

    println!("Building executor env (balance stays local)...");
    let env = ExecutorEnv::builder()
        .write(&input)
        .context("failed to write guest input")?
        .build()?;

    println!("Running the RISC Zero prover (this can take a while on CPU)...");
    let prover = default_prover();
    let receipt = prover
        .prove(env, ZKVAULT_GUEST_ELF)
        .context("proving failed")?
        .receipt;

    // Journal is exactly the 41-byte buffer the guest committed.
    let journal_bytes = receipt.journal.bytes.clone();
    if journal_bytes.len() != 41 {
        anyhow::bail!(
            "unexpected journal length {} (expected 41) — guest/host out of sync?",
            journal_bytes.len()
        );
    }
    let is_eligible = journal_bytes[0] != 0;
    let threshold_in_journal = u64::from_le_bytes(journal_bytes[1..9].try_into().unwrap());

    println!(
        "Local decode -> is_eligible: {is_eligible}, threshold: {threshold_in_journal}"
    );

    // Sanity check: verify the receipt locally against the known method ID
    // BEFORE spending testnet gas on a bad proof. This is real RISC Zero
    // STARK verification, running off-chain.
    receipt
        .verify(ZKVAULT_GUEST_ID)
        .context("local receipt verification failed — do not submit this proof")?;
    println!("Receipt verified locally against ZKVAULT_GUEST_ID. Safe to submit.");

    let seal_bytes =
        bincode::serialize(&receipt.inner).context("failed to serialize receipt seal")?;

    let bundle = ProofBundle {
        journal_hex: hex::encode(&journal_bytes),
        seal_hex: hex::encode(&seal_bytes),
        method_id_hex: method_id_to_hex(&ZKVAULT_GUEST_ID),
        is_eligible,
        user_id_hash_hex: hex::encode(user_id_hash),
    };

    std::fs::write(&args.out, serde_json::to_vec_pretty(&bundle)?)?;
    println!("Proof bundle written to {}", args.out);
    println!("Next: ./scripts/submit_proof.sh {}", args.out);

    Ok(())
}
