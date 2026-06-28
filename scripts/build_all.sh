#!/usr/bin/env bash
# Builds the RISC Zero guest (via methods/build.rs, triggered by building
# anything that depends on `methods`) and the Casper contract wasm.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building host (this also triggers the guest ELF build)"
cargo build --release -p zkvault-host

echo "==> Building zkVault contract wasm (relayer-attested, default features)"
cd contract
cargo odra build -b casper
cd ..

echo "==> Done. Contract wasm should be at contract/wasm/zkvault_contract.wasm"
echo "    (path depends on your cargo-odra version — check its output above)"
