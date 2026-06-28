#!/usr/bin/env bash
# Deploys ZkVault to Casper testnet using the casper-client CLI.
#
# Prereqs:
#   - casper-client installed (cargo install casper-client)
#   - a funded testnet account: secret key at $SECRET_KEY_PATH, get test
#     CSPR from https://testnet.cspr.live (faucet) for that account
#   - contract wasm built (./scripts/build_all.sh)
#   - METHOD_ID_HEX: the 32-byte hex image ID printed by the host prover
#     (see proof.json -> method_id_hex), so the contract is initialized
#     pinned to the right circuit from the start.
#
# Usage:
#   SECRET_KEY_PATH=~/.casper/testnet_secret_key.pem \
#   METHOD_ID_HEX=<hex from proof.json> \
#   RELAYER_ACCOUNT_HASH=<account-hash-... of the relayer/agent account> \
#   ./scripts/deploy_testnet.sh

set -euo pipefail
cd "$(dirname "$0")/.."

: "${SECRET_KEY_PATH:?set SECRET_KEY_PATH to your funded testnet account key}"
: "${METHOD_ID_HEX:?set METHOD_ID_HEX to the guest's image ID, from proof.json}"
: "${RELAYER_ACCOUNT_HASH:?set RELAYER_ACCOUNT_HASH to the trusted relayer account}"

NODE_ADDRESS="${NODE_ADDRESS:-https://node.testnet.casper.network:7777}"
CHAIN_NAME="${CHAIN_NAME:-casper-test}"
# Confirmed convention: Odra names the wasm after the contract STRUCT
# (ZkVault), not the crate (zkvault-contract). Override if build_all.sh's
# output showed a different path/name.
WASM_PATH="${WASM_PATH:-contract/wasm/ZkVault.wasm}"

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY_PATH" \
  --payment-amount 150000000000 \
  --session-path "$WASM_PATH" \
  --session-arg "method_id:fixed_list<u8>='$METHOD_ID_HEX'" \
  --session-arg "trusted_relayer:account_hash='$RELAYER_ACCOUNT_HASH'"

echo
echo "Deploy submitted. Track it on https://testnet.cspr.live and grab the"
echo "resulting contract hash for ZKVAULT_CONTRACT_ADDR in submit_proof.sh."
echo
echo "NOTE: the exact --session-arg type syntax (fixed_list<u8> vs bytes vs"
echo "a constructor-args JSON file) depends on how cargo-odra packaged your"
echo "constructor -- check the output of 'cargo odra build' / odra's CLI"
echo "deploy helper for the exact invocation it expects, and adjust above."
