"use client";

import { useState } from "react";
import { useClickRef } from "@make-software/csprclick-ui";
import ProcessLedger from "@/components/ProcessLedger";
import RedactedBalanceField from "@/components/RedactedBalanceField";
import WalletBar from "@/components/WalletBar";
import { buildVerifyEligibilityDeployJson } from "@/lib/casperDeploy";
import { ZKVAULT_CONTRACT_HASH } from "@/lib/config";
import type { EligibilityRecord, ProofBundle, ProofSource } from "@/lib/types";

function truncate(hex: string, lead = 10, tail = 6) {
  if (hex.length <= lead + tail) return hex;
  return `${hex.slice(0, lead)}…${hex.slice(-tail)}`;
}

export default function Page() {
  const clickRef = useClickRef();

  const [tab, setTab] = useState<ProofSource>("generate");
  const [balance, setBalance] = useState("");
  const [threshold, setThreshold] = useState("100000");
  const [userSecret, setUserSecret] = useState("");
  const [uploadText, setUploadText] = useState("");

  const [proof, setProof] = useState<ProofBundle | null>(null);
  const [proving, setProving] = useState(false);
  const [proveError, setProveError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [deployHash, setDeployHash] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [record, setRecord] = useState<EligibilityRecord | null>(null);

  const connectedPublicKey: string | null =
    (clickRef as any)?.getActiveAccount?.()?.public_key ?? null;

  async function handleGenerate() {
    setProving(true);
    setProveError(null);
    setProof(null);
    try {
      const res = await fetch("/api/prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance, threshold, userSecret }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Proving failed");
      const data: ProofBundle = await res.json();
      setProof(data);
    } catch (e: any) {
      setProveError(e.message ?? String(e));
    } finally {
      setProving(false);
    }
  }

  function handleUseUploaded() {
    try {
      const parsed: ProofBundle = JSON.parse(uploadText);
      if (!parsed.journal_hex || !parsed.seal_hex) {
        throw new Error("Missing journal_hex / seal_hex — is this a proof.json from the host prover?");
      }
      setProof(parsed);
      setProveError(null);
    } catch (e: any) {
      setProveError(e.message ?? "Couldn't parse that as a proof.json bundle.");
    }
  }

  async function handleSubmit() {
    if (!proof || !connectedPublicKey || !clickRef) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const deployJson = buildVerifyEligibilityDeployJson(
        proof.journal_hex,
        proof.seal_hex,
        connectedPublicKey
      );
      const result = await (clickRef as any).send(JSON.stringify(deployJson), connectedPublicKey);
      setDeployHash(result?.deployHash ?? result?.hash ?? null);
    } catch (e: any) {
      setSubmitError(e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckStatus() {
    if (!proof) return;
    setChecking(true);
    try {
      const res = await fetch(
        `/api/eligibility?user_id_hash=${proof.user_id_hash_hex}&contract=${ZKVAULT_CONTRACT_HASH}`
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Status check failed");
      setRecord(await res.json());
    } catch (e: any) {
      setSubmitError(e.message ?? String(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen mx-auto max-w-3xl px-5 py-10">
      {/* Hero */}
      <header className="flex items-start justify-between gap-4 mb-10">
        <div>
          <p className="font-mono text-xs text-brass mb-2 tracking-wide">ZKVAULT · CASPER TESTNET</p>
          <h1 className="font-display text-3xl md:text-4xl italic text-parchment leading-tight">
            Prove the balance.
            <br />
            Redact the number.
          </h1>
          <p className="mt-3 text-parchment-dim max-w-md text-[15px] leading-relaxed">
            An agent shows it qualifies for a compliance tier — net worth, collateral, accredited
            status — without ever showing you, or the chain, what it's actually holding.
          </p>
        </div>
        <WalletBar />
      </header>

      <section className="mb-10">
        <ProcessLedger />
      </section>

      {/* Case file */}
      <section className="bg-vault-panel border border-vault-steel rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-parchment">Open a case file</h2>
          <div className="flex gap-1 bg-vault-ink rounded-md p-1 border border-vault-steel">
            {(["generate", "upload"] as ProofSource[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded ${
                  tab === t ? "bg-brass text-vault-ink font-medium" : "text-parchment-dim"
                }`}
              >
                {t === "generate" ? "Generate locally" : "Upload sealed proof"}
              </button>
            ))}
          </div>
        </div>

        {tab === "generate" ? (
          <div className="space-y-4">
            <p className="text-xs text-seal-pending bg-vault-ink border border-vault-steel rounded px-3 py-2 leading-relaxed">
              This calls a server route that runs the Rust prover. Fine for local development —
              your balance never leaves the machine you're running <span className="font-mono">npm run dev</span> on.
              If you deploy this app publicly, use "Upload sealed proof" instead so balance never
              transits the network at all (run the prover CLI yourself, then paste its proof.json
              here).
            </p>
            <RedactedBalanceField
              value={balance}
              onChange={setBalance}
              sealed={!!proof}
              eligible={proof?.is_eligible ?? null}
              disabled={proving}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-brass mb-1.5 font-medium">
                  Threshold — public
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  disabled={!!proof || proving}
                  className="w-full h-11 rounded-md bg-vault-ink border border-vault-steel px-3 font-mono text-parchment"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-brass mb-1.5 font-medium">
                  Account fingerprint seed
                </label>
                <input
                  type="text"
                  placeholder="any stable per-user secret"
                  value={userSecret}
                  onChange={(e) => setUserSecret(e.target.value)}
                  disabled={!!proof || proving}
                  className="w-full h-11 rounded-md bg-vault-ink border border-vault-steel px-3 font-mono text-sm text-parchment placeholder:text-parchment-dim/40"
                />
              </div>
            </div>
            {!proof ? (
              <button
                onClick={handleGenerate}
                disabled={proving || !balance || !threshold || !userSecret}
                className="w-full h-11 rounded-md bg-brass hover:bg-brass-bright disabled:opacity-40 text-vault-ink font-medium transition-colors"
              >
                {proving ? "Sealing proof…" : "Generate proof"}
              </button>
            ) : (
              <button
                onClick={() => {
                  setProof(null);
                  setDeployHash(null);
                  setRecord(null);
                }}
                className="text-xs text-parchment-dim underline underline-offset-2"
              >
                Start a new case file
              </button>
            )}
            {proveError && <p className="text-sm text-seal-rejected">{proveError}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-parchment-dim leading-relaxed">
              Run the prover locally (<span className="font-mono">cargo run --release -p zkvault-host -- --balance … --threshold … --user-secret …</span>),
              then paste the resulting <span className="font-mono">proof.json</span> below. Your
              balance never touches this browser tab.
            </p>
            <textarea
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              rows={6}
              placeholder='{"journal_hex": "...", "seal_hex": "...", ...}'
              className="w-full rounded-md bg-vault-ink border border-vault-steel px-3 py-2 font-mono text-xs text-parchment placeholder:text-parchment-dim/40"
            />
            <button
              onClick={handleUseUploaded}
              className="w-full h-11 rounded-md bg-brass hover:bg-brass-bright text-vault-ink font-medium transition-colors"
            >
              Use this proof
            </button>
            {proveError && <p className="text-sm text-seal-rejected">{proveError}</p>}
          </div>
        )}
      </section>

      {/* Submit + status */}
      {proof && (
        <section className="bg-vault-panel border border-vault-steel rounded-lg p-6 mb-8 space-y-4">
          <h2 className="font-display text-xl text-parchment">Ledger entry</h2>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm font-mono">
            <dt className="text-parchment-dim">account fingerprint</dt>
            <dd className="text-parchment">{truncate(proof.user_id_hash_hex)}</dd>
            <dt className="text-parchment-dim">method id</dt>
            <dd className="text-parchment">{truncate(proof.method_id_hex)}</dd>
            <dt className="text-parchment-dim">local proof result</dt>
            <dd className={proof.is_eligible ? "text-seal-verified" : "text-seal-rejected"}>
              {proof.is_eligible ? "eligible" : "not eligible"}
            </dd>
          </dl>

          {!connectedPublicKey ? (
            <p className="text-xs text-parchment-dim">Connect the relayer wallet above to submit this proof on-chain.</p>
          ) : !deployHash ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-11 rounded-md bg-brass hover:bg-brass-bright disabled:opacity-40 text-vault-ink font-medium transition-colors"
            >
              {submitting ? "Awaiting wallet signature…" : "Submit to Casper testnet"}
            </button>
          ) : (
            <div className="text-sm">
              <p className="text-parchment-dim">
                Submitted —{" "}
                <a
                  href={`https://testnet.cspr.live/deploy/${deployHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brass underline underline-offset-2"
                >
                  view deploy
                </a>
              </p>
            </div>
          )}
          {submitError && <p className="text-sm text-seal-rejected">{submitError}</p>}

          {deployHash && (
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="text-xs text-parchment-dim underline underline-offset-2"
            >
              {checking ? "Reading ledger…" : "Check on-chain status"}
            </button>
          )}

          {record && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                record.is_eligible
                  ? "border-seal-verified text-seal-verified"
                  : "border-seal-rejected text-seal-rejected"
              }`}
            >
              On-chain record: {record.is_eligible ? "eligible" : "not eligible"} at threshold{" "}
              {record.threshold_used}
            </div>
          )}
        </section>
      )}

      <footer className="text-xs text-parchment-dim/70 text-center pb-6">
        zkVault — built for the Casper Agentic Buildathon. No balance was harmed in the making of this proof.
      </footer>
    </main>
  );
}
