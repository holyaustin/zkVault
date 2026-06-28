export const NODE_URL =
  process.env.NEXT_PUBLIC_CASPER_NODE_URL ?? "https://node.testnet.casper.network:7777/rpc";

export const CHAIN_NAME = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME ?? "casper-test";

// Set this after running scripts/deploy_testnet.sh — see ../../README.md
export const ZKVAULT_CONTRACT_HASH = process.env.NEXT_PUBLIC_ZKVAULT_CONTRACT_HASH ?? "";

// Payment in motes for the verify_eligibility deploy. 25 CSPR is generous
// headroom for a hackathon demo; tune down once you've measured real gas
// use on testnet.
export const VERIFY_PAYMENT_MOTES = "25000000000";
