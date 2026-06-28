const steps = [
  {
    n: "01",
    title: "Seal the proof",
    body: "The off-chain prover runs the RISC Zero guest program against your real balance. Only a pass/fail result and the threshold leave the machine.",
  },
  {
    n: "02",
    title: "Relay the seal",
    body: "The agent's relayer wallet submits the sealed proof in a deploy it signs itself — the contract trusts that signature, not a recomputation of the math on-chain.",
  },
  {
    n: "03",
    title: "Read the stamp",
    body: "Anyone can query the contract's eligibility record for the anonymized account. No balance is ever attached to it.",
  },
];

export default function ProcessLedger() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-vault-steel rounded-lg overflow-hidden border border-vault-steel">
      {steps.map((s) => (
        <div key={s.n} className="bg-vault-panel p-5">
          <div className="font-mono text-xs text-brass mb-2">{s.n}</div>
          <h3 className="font-display text-lg text-parchment mb-1.5">{s.title}</h3>
          <p className="text-sm text-parchment-dim leading-relaxed">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
