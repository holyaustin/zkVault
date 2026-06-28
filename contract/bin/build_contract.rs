//! Builds this crate's `#[odra::module]` contract(s) into a deployable
//! Casper wasm file (expect it under `wasm/`, named after the contract
//! struct -- e.g. `wasm/ZkVault.wasm`, not the crate name).
//!
//! Run with: cargo run --release --bin zkvault_contract_build_contract
//!
//! This is Odra 2.x's documented build path (confirmed via Odra's own
//! "Deploying a Token on Casper Livenet" tutorial, which wires up an
//! identical `bin/build_contract.rs` + `odra-build` build-dependency
//! pattern), replacing the older `cargo odra build -b casper` CLI
//! invocation that this project's scripts originally used.
//!
//! HONESTY NOTE: I confirmed the surrounding wiring directly (the
//! Cargo.toml [[bin]] entry, the build-dependency, the run command, and
//! real terminal output showing it producing a wasm file) -- but not this
//! exact function-call body. `odra_build::build_contract()` is a
//! best-effort match to that convention, not something I saw verbatim.
//! If this doesn't compile against your installed `odra-build` version,
//! the reliable fix is:
//!   cargo odra new --name scaffold --template workspace
//! in a scratch directory, then copy ITS generated bin/build_contract.rs
//! body verbatim into this file -- that guarantees a version-correct
//! implementation instead of this guess.
fn main() {
    odra_build::build_contract();
}
