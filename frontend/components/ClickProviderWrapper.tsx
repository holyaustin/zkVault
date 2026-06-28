"use client";

import { ClickProvider } from "@make-software/csprclick-ui";
import { CONTENT_MODE } from "@make-software/csprclick-core-types";
import type { ReactNode } from "react";

// NOTE: this targets @make-software/csprclick-ui's documented React
// integration (https://docs.cspr.click/cspr.click-sdk/react). The top
// navigation bar (<ClickUI>) is intentionally NOT rendered here — zkVault
// builds its own "connect the relayer wallet" control (see
// components/WalletBar.tsx) to keep the vault aesthetic consistent, which
// CSPR.click's docs explicitly support opting into.
//
// Get appId from https://console.cspr.build after registering your app;
// the default 'csprclick-template' id works for local development only.
const clickOptions = {
  appName: "zkVault",
  appId: process.env.NEXT_PUBLIC_CSPRCLICK_APP_ID ?? "csprclick-template",
  contentMode: CONTENT_MODE.IFRAME,
  providers: ["casper-wallet", "ledger", "casperdash"],
};

export default function ClickProviderWrapper({ children }: { children: ReactNode }) {
  return <ClickProvider options={clickOptions}>{children}</ClickProvider>;
}
