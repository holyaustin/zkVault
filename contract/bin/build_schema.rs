//! Generates this crate's contract ABI schema (entry points, types) --
//! useful for explorers, the Odra CLI tooling, and anyone integrating
//! against the deployed contract without your Rust source.
//!
//! Run with: cargo run --release --bin zkvault_contract_build_schema
//!
//! Same honesty note as build_contract.rs: the surrounding wiring
//! (Cargo.toml [[bin]] entry, build-dependency, run command) is confirmed
//! against Odra's own current tutorial; this exact function-call body is
//! a best-effort match, not something I saw verbatim. If it doesn't
//! compile, `cargo odra new --template workspace` in a scratch directory
//! and copying its generated bin/build_schema.rs is the reliable fix.
fn main() {
    odra_build::build_schema();
}
