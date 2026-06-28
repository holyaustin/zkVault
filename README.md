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
┌──────────────────────────┐   GET    ┌───────────────────────────────┐
│  frontend/ (Next.js)       │────────▶  contract/.../check_eligibility │
│  app/api/prove (shells     │         │  (Odra livenet HostRefLoader)  │
│   out to host/, above)     │◀────────┴────────────────────────────────┘
│  app/api/eligibility       │
└──────────┬──────────────────┘
           │  CSPR.click-signed deploy → verify_eligibility(journal, seal)
           ▼
┌─────────────────────────┐
│  Casper testnet          │
│  ZkVault contract         │
│  (contract/, Odra)        │
└─────────────────────────┘
```

- **`methods/guest`** — the ZK circuit. Reads a private `balance` and a
  public `threshold`, commits only `is_eligible`, `threshold`, and an
  anonymized `user_id_hash` to the journal. `balance` never leaves the
  guest.
- **`methods`** — embeds the compiled guest ELF + image ID as Rust
  constants (`ZKVAULT_GUEST_ELF`, `ZKVAULT_GUEST_ID`).
- **`host`** — the off-chain prover agent CLI. Takes `--balance` (secret),
  `--threshold`, `--user-secret`, runs the prover, verifies the receipt
  locally, and writes `proof.json` (journal + seal, hex-encoded — no
  balance).
- **`contract`** — the Odra/Casper verifier contract. Two feature-gated
  verification backends (see below), plus `bin/check_eligibility.rs`
  — a `--features livenet` binary that makes a real read-only call
  against the deployed contract via Odra's `HostRefLoader`, used by the
  frontend's status check.
- **`frontend`** — Next.js + TypeScript + Tailwind. The actual
  agent-facing surface: a form that drives the prover, a CSPR.click-signed
  submission to the contract, and a status read-back. See "Frontend
  setup" below.

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

**Security note:** this project pins `risc0-zkvm` / `risc0-build` to `"3"`.
An earlier draft pinned `"1.2"`, which resolves to a version affected by
[CVE-2025-61588](https://github.com/risc0/risc0/security/advisories/GHSA-jqq4-c7wq-36h7)
— a critical (CVSS 9.3) memory-safety bug in `sys_read` that lets a
malicious host write to arbitrary guest memory. If you've already run
`cargo build` against an older copy of this repo, run `cargo update` and
confirm `cargo tree -p risc0-zkvm` shows `>=3.0.3` (or `>=2.3.2` if you
have a reason to stay on the 2.x line) before trusting any proof it
produced.

## Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local   # then fill in NEXT_PUBLIC_ZKVAULT_CONTRACT_HASH
                                    # after step 3 below
npm run dev
# -> http://localhost:3000
```

Also copy `.env.sample` (workspace root) to `.env` and fill in your testnet
key path — `frontend/app/api/eligibility/route.ts` shells out to
`contract/bin/check_eligibility.rs`, which reads those vars.

The frontend has two tabs:

- **Generate locally** — calls `app/api/prove`, which runs the real
  RISC Zero prover server-side. Fine for `npm run dev` on your own
  machine; **do not** treat this as private if you deploy the app
  publicly (see the privacy note in that route's source).
- **Upload sealed proof** — paste a `proof.json` you generated yourself
  via the `host` CLI. Balance never touches this server at all, in any
  deployment. This is the path to use for anything beyond your own laptop.

Submission to the contract happens browser-side, signed by whichever
wallet you connect via CSPR.click ("Connect relayer wallet") — that
wallet's address must match the `trusted_relayer` the contract was
deployed with (step 3 below), since `relayer-attested` mode checks the
caller, not the proof math. For a hackathon demo, this is naturally your
agent's own operating wallet.

## Running the flow end to end

```bash
# 1. Build guest + contract wasm
./scripts/build_all.sh
# -> watch its output for the actual wasm path/filename it reports;
#    deploy_testnet.sh's WASM_PATH default assumes contract/wasm/ZkVault.wasm

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
#    entry points:
cargo run --release -p zkvault-contract --features livenet \
  --bin check_eligibility -- \
  --contract-addr <contract hash from step 3> \
  --user-id-hash-hex <user_id_hash_hex from proof.json>

# Or skip steps 4-5's raw CLI calls entirely and drive the same flow from
# the frontend (see "Frontend setup" above) — it wraps this exact prove /
# submit / check sequence behind the case-file UI, with submission signed
# in-browser via CSPR.click instead of a raw casper-client call.
```

## Known engineering risk / things to double check against your installed
## tool versions before deploy day

- **`odra_build::build_contract()` / `build_schema()` function bodies**
  in `contract/bin/build_contract.rs` / `build_schema.rs` — confirmed (via
  Odra's own current tutorial, including real terminal output) that this
  bin-script + `odra-build` pattern is what replaced the older
  `cargo odra build -b casper` CLI command, and confirmed the surrounding
  Cargo.toml wiring exactly. The one-line function bodies themselves are
  a best-effort match to that convention, not verified verbatim. If they
  don't compile: run `cargo odra new --name scaffold --template workspace`
  in a scratch directory and copy its generated `bin/build_contract.rs`
  body in — guaranteed correct for your installed version, zero guessing.
- **Wasm output filename** — confirmed Odra names it after the contract
  *struct* (e.g. `ZkVault.wasm`), not the crate name. `deploy_testnet.sh`
  defaults to `contract/wasm/ZkVault.wasm`; double check against
  `build_all.sh`'s actual output.
- **`HostRefLoader::load(&env, address)`** in
  `contract/bin/check_eligibility.rs` — confirmed that Odra's
  `HostRefLoader` trait is what attaches to an already-deployed contract
  (vs. deploying a fresh one), but its exact method name wasn't directly
  verified. If this doesn't compile, check `odra::host::HostRefLoader` on
  docs.rs for your installed version.
- **`--session-arg` type syntax** in `deploy_testnet.sh` /
  `submit_proof.sh` (e.g. `fixed_list<u8>` vs `bytes` vs a constructor-args
  JSON file) depends on how your build packages the constructor args —
  check `cargo odra build --help` / the schema from `build_schema.rs` for
  the exact invocation rather than trusting the placeholder syntax here
  verbatim.
- **casper-js-sdk's `CLValueBuilder` byte-array constructor** in
  `frontend/lib/casperDeploy.ts` — the exact method name for raw bytes has
  varied across major versions of that package; check its current export
  if the deploy fails to build.
- **CSPR.click event names** in `frontend/components/WalletBar.tsx` — the
  `csprclick:signed-in` / `csprclick:signed-out` event strings weren't
  confirmed verbatim against `@make-software/csprclick-core-types`'s
  exported event enum; check that package if the wallet bar doesn't update
  on connect.

## Troubleshooting log

Real errors hit while building this, for anyone who searches their way
here with the same ones:

- **`failed to get image ID using r0vm: ... Malformed ProgramBinary`**
  during the guest build — version mismatch between the `r0vm` toolchain
  `rzup install` gave you and the `risc0-zkvm`/`risc0-build` versions
  pinned in Cargo.toml (RISC Zero changed its low-level VM/ELF format
  across major versions). Fixed by pinning both to `"3"` everywhere (see
  the security note above — this also happens to fix a real CVE, it
  wasn't pinned to `"1.2"` for any good reason).
- **`cargo odra build: error: unexpected argument '-b' found`** — that
  CLI flag is from an older cargo-odra generation. Current Odra (2.x)
  builds via binaries inside your own crate instead — see
  `contract/bin/build_contract.rs` and the Cargo.toml `[[bin]]` entries
  pointing at it.

## CSPR.click integration

The frontend wires up `@make-software/csprclick-ui` directly (see
`components/ClickProviderWrapper.tsx` and `components/WalletBar.tsx`) —
this is the "agent interacts with the contract" piece: the connected
wallet is the agent's own operating wallet, and it signs the
`verify_eligibility` deploy in-browser rather than via a raw
`casper-client` call. The top navigation bar is intentionally not
rendered (the project builds its own connect control for visual
consistency) — see CSPR.click's React docs if you want to switch back to
their default `<ClickUI>` bar instead.

If you want this driven conversationally by an LLM agent instead of a
form UI, the natural extension is wrapping `frontend/lib/casperDeploy.ts`
and `app/api/*` behind tool definitions for whatever agent framework
you're using, rather than rebuilding the Casper integration from scratch.

## Demo script suggestion

1. Show `host` running with a balance *above* threshold → `is_eligible:
   true`, submit, query `is_eligible` on-chain → `true`.
2. Re-run with a balance *below* threshold → `is_eligible: false`, submit,
   query → `false`. This is the moment that proves the contract is actually
   reading the proof's result, not just always saying yes.
3. Open `proof.json` on screen and point out: no `balance` field anywhere.
   That's the whole point.
