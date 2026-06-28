// zkVault guest program — runs inside the RISC Zero zkVM.
//
// What gets proven: "I know a `balance` such that balance > threshold,
// for the threshold and anonymized identity committed to in the journal."
//
// `balance` is read as a private input and NEVER written to the journal.
// Only `is_eligible`, `threshold`, and `user_id_hash` (public) leave the
// guest. That's the whole privacy property: the verifier (the Casper
// contract, or anyone with the receipt) learns the boolean result and the
// threshold it was checked against, but never the exact balance.

#![no_main]

risc0_zkvm::guest::entry!(main);

use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct ComplianceInput {
    /// PRIVATE. Never leaves the guest.
    balance: u64,
    /// Public: the compliance bar being checked against (e.g. accredited
    /// investor net-worth minimum, or a collateral floor for a yield tier).
    threshold: u64,
    /// Public: an anonymized identifier — e.g. sha256(wallet_pubkey || salt),
    /// computed by the host. Lets the contract index eligibility per-user
    /// without ever learning which raw balance produced it.
    user_id_hash: [u8; 32],
}

fn main() {
    let input: ComplianceInput = env::read();

    // --- the "secret" computation -----------------------------------
    let is_eligible = input.balance > input.threshold;
    // ------------------------------------------------------------------

    // Pack the journal as a fixed-layout byte buffer instead of a serde
    // blob. This makes parsing on-chain trivial (no serde stack needed
    // inside the Casper WASM contract) and keeps the journal small:
    //   byte 0       -> is_eligible (0x00 / 0x01)
    //   bytes 1..9   -> threshold, little-endian u64
    //   bytes 9..41  -> user_id_hash, 32 bytes
    let mut journal = Vec::with_capacity(41);
    journal.push(is_eligible as u8);
    journal.extend_from_slice(&input.threshold.to_le_bytes());
    journal.extend_from_slice(&input.user_id_hash);

    env::commit_slice(&journal);
}
