//! Reads on-chain eligibility for an anonymized user_id_hash by attaching
//! to the already-deployed ZkVault contract via Odra's Livenet backend and
//! calling its `is_eligible` / `threshold_used` view entry points.
//!
//! Lives in bin/ (not src/bin/) to match the layout Odra's own current
//! tutorials use for livenet/build binaries (see e.g.
//! https://odra.dev/docs/2.3.1/tutorials/deploying-on-casper/ -- its
//! `our_token_livenet` binary lives at `bin/our_token_livenet.rs`).
//!
//! Only built with `--features livenet` (see Cargo.toml), so the wasm
//! contract build never pulls in clap/anyhow/dotenvy/etc.
//!
//!   cargo run --release -p zkvault-contract --features livenet \
//!       --bin check_eligibility -- \
//!       --contract-addr hash-... --user-id-hash-hex <64 hex chars>
//!
//! Connection settings follow Odra's own livenet env var convention
//! (https://odra.dev/docs/backends/livenet/):
//!   ODRA_CASPER_LIVENET_NODE_ADDRESS
//!   ODRA_CASPER_LIVENET_CHAIN_NAME
//!   ODRA_CASPER_LIVENET_SECRET_KEY_PATH   (read-only view calls are
//!                                          free/offline per Odra's docs,
//!                                          but the livenet env still
//!                                          wants a configured signer)
//! Put these in a `.env` file at the workspace root -- see .env.sample.
//! We load it explicitly below since it's unconfirmed whether Odra's
//! livenet env auto-loads dotenv files on every version; the explicit
//! load is harmless either way.
//!
//! ONE THING TO VERIFY: attaching to an *existing* deployed contract (as
//! opposed to deploying a fresh one) is provided by Odra's `HostRefLoader`
//! trait -- confirmed present via `use odra::host::{Deployer, HostRef,
//! HostRefLoader};` in Odra's own Casper livenet tutorial, which describes
//! it as how you "load the existing contract". The call below,
//! `HostRefLoader::load(&env, address)`, matches that trait's evident
//! purpose and Odra's own "load" terminology, but I have not seen its
//! exact method signature directly -- if this doesn't compile against
//! your installed Odra version, this is the one line to adjust (check
//! `odra::host::HostRefLoader`'s docs.rs page for the exact method name).

use anyhow::{bail, Context, Result};
use clap::Parser;
use odra::host::HostRefLoader;
use odra::prelude::Address;
use std::str::FromStr;

use zkvault_contract::ZkVaultHostRef;

#[derive(Parser)]
struct Args {
    /// The deployed ZkVault contract's address, e.g. "hash-...".
    #[arg(long)]
    contract_addr: String,
    /// 64 hex characters (32 bytes) -- the anonymized user_id_hash from
    /// proof.json's `user_id_hash_hex` field.
    #[arg(long)]
    user_id_hash_hex: String,
}

fn main() -> Result<()> {
    dotenvy::dotenv().ok(); // fine if absent -- real deployments may set these directly

    let args = Args::parse();
    let env = odra_casper_livenet_env::env();

    let address = Address::from_str(&args.contract_addr)
        .context("invalid contract address -- expected a Casper hash-... address")?;
    let contract: ZkVaultHostRef = HostRefLoader::load(&env, address);

    let bytes = hex::decode(&args.user_id_hash_hex).context("user_id_hash_hex must be hex")?;
    if bytes.len() != 32 {
        bail!("user_id_hash must decode to exactly 32 bytes, got {}", bytes.len());
    }
    let mut user_id_hash = [0u8; 32];
    user_id_hash.copy_from_slice(&bytes);

    let is_eligible = contract.is_eligible(user_id_hash);
    let threshold_used = contract.threshold_used(user_id_hash);

    // Single-line JSON on stdout -- the Next.js API route reads the LAST
    // line of stdout, so route any future debug output to stderr instead.
    println!(r#"{{"is_eligible": {is_eligible}, "threshold_used": {threshold_used}}}"#);
    Ok(())
}
