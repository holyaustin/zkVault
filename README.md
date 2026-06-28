# zkVault — Zero-Knowledge Proof of Solvency & Compliance on Casper

Prove `balance > threshold` (e.g. accredited-investor net worth, or a
collateral floor for a yield tier) to a Casper smart contract — without ever
revealing the balance. Built on RISC Zero + Odra.

## Architecture

```
┌─────────────────┐   private balance    ┌──────────────────────┐
│  Off-chain       │──────────────────────▶  RISC Zero zkVM      │
│  Prover Agent    │   (host/)            │  (methods/guest)     │
│  (host/)         │◀──────────────────────  proves balance>thr  │
└──────────┬───────┘   journal + seal     └──────────────────────┘
           │  proof.json
           ▼
┌─────────────────────────┐
│  Casper testnet          │   verify_eligibility(journal, seal)
│  ZkVault contract         │◀─────────────────────────────────────
│  (contract/, Odra)        │
└─────────────────────────┘
```

- **`methods/guest`** — the ZK circuit. Reads a private `balance` and a
  public `threshold`, commits only `is_eligible`, `threshold`, and an
  anonymized `user_id_hash` to the journal. `balance` never leaves the
  guest.
- **`methods`** — embeds the compiled guest ELF + image ID as Rust
  constants (`ZKVAULT_GUEST_ELF`, `ZKVAULT_GUEST_ID`).
- **`host`** — the off-chain prover agent. Takes `--balance` (secret),
  `--threshold`, `--user-secret`, runs the prover, verifies the receipt
  locally, and writes `proof.json` (journal + seal, hex-encoded — no
  balance).
- **`contract`** — the Odra/Casper verifier contract. Two feature-gated
  verification backends — see below, this is the part to read carefully
  before you present this.

## Verification modes — read this before your demo

The hard part of this whole project is verifying a RISC Zero proof *inside*
a Casper WASM contract. It's real engineering (STARK verification is heavy;
the realistic path is RISC Zero's Groth16-wrapped receipt + a BN254 pairing
check on-chain), not something you wire up as a side task. Even the Casper
ecosystem's own published experiment on this exact idea describes its
on-chain `verify()` as written for demonstration, not production
(see https://odra.dev/blog/casper-zk-risc0/).

So this repo ships two modes, and you should know which one you're running
when you talk to judges:

- **`relayer-attested` (default, fully working)**: the off-chain prover
  agent runs real RISC Zero STARK verification locally
  (`receipt.verify(METHOD_ID)` — genuine cryptographic verification, just
  executed off-chain), then relays the result by submitting its own
  Casper-signed deploy. The contract's only on-chain check is "did this
  deploy come from the address I designated as trusted relayer." This is a
  legitimate, commonly used architecture pattern when a target VM can't
  cheaply run the verifier natively — but it is **not trustless**: a
  dishonest or compromised relayer key could register a false eligibility
  record. Say this plainly when you present — it's a real ZK pipeline with
  a relayed trust boundary, not "fully on-chain ZK verification."
- **`onchain-groth16` (stub, stretch goal)**: `contract/src/verifier.rs`
  has the real entry point wired up but `unimplemented!()`'d, with the
  actual cryptography it needs (Groth16 wrapping on the host, BN254
  pairing check on-chain) documented inline. If you have time left after
  the core flow works, this is the genuine path to trustless on-chain
  verification — budget real hours for it, it's not a quick patch.

## Setup

```bash
# Rust toolchain + RISC Zero
curl -L https://risczero.com/install | bash
rzup install

# cargo-odra (Casper contract tooling)
cargo install cargo-odra

# casper-client CLI (for deploy/submit scripts)
cargo install casper-client
```

## Running the flow end to end

```bash
# 1. Build guest + contract wasm
./scripts/build_all.sh

# 2. Generate a real ZK proof (balance stays local to this process)
cargo run --release -p zkvault-host -- \
  --balance 250000 --threshold 100000 --user-secret "alice" --out proof.json
# -> prints the image ID hex you need for deploy, and is_eligible

# 3. Deploy the contract to Casper testnet, pinned to that image ID
SECRET_KEY_PATH=~/.casper/testnet_secret_key.pem \
METHOD_ID_HEX=<method_id_hex from proof.json> \
RELAYER_ACCOUNT_HASH=<the relayer account that will submit proofs> \
./scripts/deploy_testnet.sh
# -> note the resulting contract hash

# 4. Submit the proof, signed by the relayer key
SECRET_KEY_PATH=~/.casper/relayer_secret_key.pem \
ZKVAULT_CONTRACT_ADDR=<contract hash from step 3> \
./scripts/submit_proof.sh proof.json

# 5. Confirm on-chain state via the is_eligible / threshold_used view
#    entry points (casper-client query-state or your own small CLI),
#    passing the user_id_hash printed in proof.json.
```

## Known engineering risk / things to double check against your installed
## tool versions before deploy day

- **Odra macro surface** (`Var`, `Mapping`, `#[odra::module]`,
  `#[odra::odra_error]`, `self.env().emit_event`) targets Odra ~1.x. Run
  `cargo odra build -b casper` early and reconcile any compile errors
  against https://odra.dev/docs for your exact installed version —
  Odra's API has moved between releases.
- **`--session-arg` type syntax** in `deploy_testnet.sh` /
  `submit_proof.sh` (e.g. `fixed_list<u8>` vs `bytes` vs a constructor-args
  JSON file) depends on how `cargo-odra` packages your constructor args —
  check its build output / odra's own deploy helper for the exact
  invocation rather than trusting the placeholder syntax here verbatim.
- **`risc0-zkvm` / `risc0-build` versions**: pin to whatever
  `rzup install` gives you; the `1.2` version pins here are a starting
  point, not gospel — `cargo update` if `cargo build` complains about
  yanked or incompatible versions.

## Extending: CSPR.click for agent-facing UX

The off-chain prover here is a plain CLI for clarity. If you want an AI
agent to drive this conversationally (e.g. "check if I qualify for the
high-yield tier"), wrap `host`'s logic behind the
[CSPR.click](https://cspr.click/) AI agent skill / CSPR.build Agent Skills
for wallet connection, deploy signing, and event handling, instead of the
raw `casper-client` calls in the scripts here.

## Demo script suggestion

1. Show `host` running with a balance *above* threshold → `is_eligible:
   true`, submit, query `is_eligible` on-chain → `true`.
2. Re-run with a balance *below* threshold → `is_eligible: false`, submit,
   query → `false`. This is the moment that proves the contract is actually
   reading the proof's result, not just always saying yes.
3. Open `proof.json` on screen and point out: no `balance` field anywhere.
   That's the whole point.
