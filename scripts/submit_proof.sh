#!/usr/bin/env bash
# Submits a proof.json (produced by the host prover) to the deployed
# ZkVault contract's verify_eligibility entry point, signed by the trusted
# relayer's key.
#
# Usage:
#   SECRET_KEY_PATH=~/.casper/relayer_secret_key.pem \
#   ZKVAULT_CONTRACT_ADDR=hash-... \
#   ./scripts/submit_proof.sh proof.json

set -euo pipefail
cd "$(dirname "$0")/.."

PROOF_FILE="${1:-proof.json}"
: "${SECRET_KEY_PATH:?set SECRET_KEY_PATH to the relayer's key}"
: "${ZKVAULT_CONTRACT_ADDR:?set ZKVAULT_CONTRACT_ADDR to the deployed contract hash}"

NODE_ADDRESS="${NODE_ADDRESS:-https://node.testnet.casper.network:7777}"
CHAIN_NAME="${CHAIN_NAME:-casper-test}"

JOURNAL_HEX=$(python3 -c "import json; print(json.load(open('$PROOF_FILE'))['journal_hex'])")
SEAL_HEX=$(python3 -c "import json; print(json.load(open('$PROOF_FILE'))['seal_hex'])")

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY_PATH" \
  --payment-amount 25000000000 \
  --session-hash "$ZKVAULT_CONTRACT_ADDR" \
  --session-entry-point "verify_eligibility" \
  --session-arg "journal:bytes='$JOURNAL_HEX'" \
  --session-arg "seal:bytes='$SEAL_HEX'"

echo "Submitted. Check the deploy on https://testnet.cspr.live"
echo "Then call the is_eligible view entry point with the user_id_hash from"
echo "proof.json to confirm the on-chain state updated."
