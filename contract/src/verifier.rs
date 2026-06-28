//! On-chain proof verification backend (feature = "onchain-groth16").
//!
//! THIS IS THE PART OF THE ORIGINAL 24H PLAN THAT IS GENUINELY HARD, AND IT
//! IS NOT WIRED UP YET. Verifying a RISC Zero receipt requires either:
//!
//!   (a) a STARK verifier compiled to wasm32-unknown-unknown — large, and the
//!       Casper/Odra community's own writeup of this exact idea
//!       (https://odra.dev/blog/casper-zk-risc0/) describes its `verify()`
//!       as a demonstration stub, not a production verifier — so treat that
//!       as a *starting reference*, not a drop-in dependency; or
//!
//!   (b) shrinking the receipt with RISC Zero's Groth16 wrapping
//!       (`prover.prove_with_opts(env, elf, &ProverOpts::groth16())` on the
//!       host side, see https://dev.risczero.com/api/blockchain-integration)
//!       and then doing a BN254 pairing check on-chain — the same approach
//!       RISC Zero ships for EVM contracts. This needs a no_std pairing
//!       implementation (e.g. an `ark-bn254`/`ark-groth16` build that
//!       compiles to wasm32-unknown-unknown) plus RISC Zero's fixed
//!       verifying key constants for your risc0 version.
//!
//! Both paths are real engineering, not a config flag — budget real time for
//! this, or ship with `relayer-attested` (the default) and present it
//! honestly as your trust-reduced fallback, with this as documented future
//! work. Faking this check (always returning `true`) would mean your
//! contract isn't actually verifying anything — don't do that even under
//! deadline pressure.
//!
//! Signature kept stable so swapping verification backends doesn't change
//! `lib.rs`. NOTE: as of host/src/main.rs's current implementation,
//! `seal` is the bincode-serialized *whole* Receipt (journal included),
//! not an isolated seal field -- adjust this doc and the implementation
//! together if that changes.

#[allow(unused_variables)]
pub fn verify_onchain(journal: &[u8], seal: &[u8], method_id: &[u8; 32]) -> bool {
    // TODO(stretch goal): replace with a real Groth16/BN254 pairing check
    // or a wasm-compiled STARK verifier, per the module docs above.
    unimplemented!(
        "onchain-groth16 backend is a stub — see contract/src/verifier.rs docs. \
         Build without --features onchain-groth16 to use the working \
         relayer-attested backend instead."
    )
}
