import {
  CasperClient,
  Contracts,
  RuntimeArgs,
  CLValueBuilder,
  CLPublicKey,
  DeployUtil,
} from "casper-js-sdk";
import { NODE_URL, CHAIN_NAME, ZKVAULT_CONTRACT_HASH, VERIFY_PAYMENT_MOTES } from "./config";

// NOTE ON VERSION DRIFT: this targets casper-js-sdk's documented
// Contracts.Contract / RuntimeArgs / CLValueBuilder pattern (see
// https://docs.casper.network/developers/dapps/template-frontend and the
// casper-js-sdk README). The exact CLValueBuilder method for raw bytes
// has varied across major versions (byteArray vs bytes vs list(CLType.U8)).
// Run `npm run dev` and exercise this path against your installed
// casper-js-sdk version before deploy day — if it errors, check that
// package's CLValueBuilder export for the current byte-array constructor.

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Builds the unsigned verify_eligibility deploy as a JSON object, ready to
 * hand to CSPR.click's sign()/send() methods (which expect the
 * `{"deploy": {...}}` wrapper that DeployUtil.deployToJson produces). */
export function buildVerifyEligibilityDeployJson(
  journalHex: string,
  sealHex: string,
  signingPublicKeyHex: string
) {
  if (!ZKVAULT_CONTRACT_HASH) {
    throw new Error(
      "NEXT_PUBLIC_ZKVAULT_CONTRACT_HASH is not set — deploy the contract first (see README)."
    );
  }

  const casperClient = new CasperClient(NODE_URL);
  const contract = new Contracts.Contract(casperClient);
  contract.setContractHash(ZKVAULT_CONTRACT_HASH);

  const journalBytes = hexToBytes(journalHex);
  const sealBytes = hexToBytes(sealHex);

  const args = RuntimeArgs.fromMap({
    journal: CLValueBuilder.byteArray(journalBytes),
    seal: CLValueBuilder.byteArray(sealBytes),
  });

  const deploy = contract.callEntrypoint(
    "verify_eligibility",
    args,
    CLPublicKey.fromHex(signingPublicKeyHex),
    CHAIN_NAME,
    VERIFY_PAYMENT_MOTES
  );

  return DeployUtil.deployToJson(deploy);
}
