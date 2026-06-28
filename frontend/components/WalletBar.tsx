"use client";

import { useClickRef } from "@make-software/csprclick-ui";
import { useEffect, useState } from "react";

// CSPR.click events: this targets the SDK's documented event-listener
// pattern (see "Handling events" in the CSPR.click React docs). Event
// names below match the SDK's published event constants as of writing --
// re-check against `@make-software/csprclick-core-types`'s exported event
// enum if these don't fire on your installed version.
export default function WalletBar() {
  const clickRef = useClickRef();
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (!clickRef) return;
    const onConnected = (evt: any) => setPublicKey(evt?.account?.public_key ?? null);
    const onDisconnected = () => setPublicKey(null);

    clickRef.on?.("csprclick:signed-in", onConnected);
    clickRef.on?.("csprclick:signed-out", onDisconnected);

    return () => {
      clickRef.off?.("csprclick:signed-in", onConnected);
      clickRef.off?.("csprclick:signed-out", onDisconnected);
    };
  }, [clickRef]);

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 bg-vault-panel border border-vault-steel">
      {publicKey ? (
        <>
          <span className="h-2 w-2 rounded-full bg-seal-verified" aria-hidden />
          <span className="font-mono text-xs text-parchment-dim truncate max-w-[14ch]">
            {publicKey.slice(0, 10)}…{publicKey.slice(-6)}
          </span>
          <button
            onClick={() => clickRef?.signOut()}
            className="text-xs text-parchment-dim hover:text-parchment underline underline-offset-2"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={() => clickRef?.signIn()}
          className="text-sm font-medium text-vault-ink bg-brass hover:bg-brass-bright transition-colors rounded px-3 py-1.5"
        >
          Connect relayer wallet
        </button>
      )}
    </div>
  );
}
