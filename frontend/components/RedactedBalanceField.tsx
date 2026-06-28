"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  sealed: boolean;
  eligible: boolean | null;
  disabled?: boolean;
}

/** The one bold move on this page: the balance never just "submits" —
 * once a proof exists for it, the field itself gets redacted and stamped,
 * right where you typed the number. That's the whole privacy property,
 * shown rather than explained. */
export default function RedactedBalanceField({ value, onChange, sealed, eligible, disabled }: Props) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-brass mb-1.5 font-medium">
        Balance — private, never committed to the proof
      </label>
      <div className="relative h-11">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={sealed || disabled}
          placeholder="0.00"
          aria-label="Balance"
          className="w-full h-11 rounded-md bg-vault-panel border border-vault-steel px-3 font-mono text-parchment placeholder:text-parchment-dim/40 transition-opacity disabled:opacity-0"
        />
        {sealed && (
          <div className="absolute inset-0 flex items-center pointer-events-none">
            <div className="h-full w-full rounded-md bg-redact animate-redact-sweep" />
            <div
              className={`absolute -right-3 -top-4 rotate-[-6deg] animate-stamp rounded-full border-2 px-3 py-1 text-[11px] font-display font-semibold tracking-wider bg-vault-ink ${
                eligible ? "border-seal-verified text-seal-verified" : "border-seal-rejected text-seal-rejected"
              }`}
            >
              {eligible ? "VERIFIED" : "DENIED"}
            </div>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-parchment-dim">
        Only the result of <span className="font-mono">balance &gt; threshold</span> is ever
        committed to the proof. This field redacts itself the moment a proof exists for it.
      </p>
    </div>
  );
}
