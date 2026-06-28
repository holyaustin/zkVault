#!/usr/bin/env bash
# Builds the RISC Zero guest (via methods/build.rs, triggered by building
# anything that depends on `methods`) and the Casper contract wasm.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building host (this also triggers the guest ELF build)"
cargo build --release -p zkvault-host

echo "==> Building zkVault contract wasm (relayer-attested, default features)"
# Current Odra (2.x) build path -- see contract/bin/build_contract.rs for
# why this replaced the older `cargo odra build -b casper` CLI command.
cargo run --release -p zkvault-contract --bin zkvault_contract_build_contract

echo "==> Generating contract ABI schema"
cargo run --release -p zkvault-contract --bin zkvault_contract_build_schema

echo "==> Done. Contract wasm should be at contract/wasm/ZkVault.wasm"
echo "    (named after the contract struct, not the crate -- confirm the"
echo "    exact filename in the output above before deploy_testnet.sh)"
