# zkVault — Zero-Knowledge Proof of Solvency & Compliance
## Description
zkVault is a DeFi/RWA-focused application where an agent or user can prove they hold sufficient collateral or meet a compliance requirement (e.g., net worth, accredited investor status) without revealing the exact underlying balance. The agent interacts with a Casper smart contract that verifies a zero-knowledge proof submitted by the user's off-chain prover. Upon successful verification, the contract issues a compliance token or unlocks a specific DeFi feature (e.g., higher yield tier, access to a restricted pool).

This directly applies to the challenge's focus on Agentic AI, DeFi, and RWA by enabling trustless, privacy-preserving compliance checks essential for regulated real-world assets.



## Tools & Tech Stack
Casper Testnet: For deploying the ZK verifier smart contract.

RISC Zero: To generate zero-knowledge proofs of computation (e.g., proving balance > threshold). The RISC Zero verifier can be compiled to WASM and executed within a Casper contract.

Odra Framework: To write the verifier smart contract in Rust efficiently.

CSPR.click AI Agent Skill: For the AI agent to interact with the contract and submit proofs.

Circom/Groth16 (Alternative): Community research shows proof verification is possible using Circom and a custom Casper node, but RISC Zero offers a more general-purpose and accessible path for a 24-hour build.
Frontend	React + TypeScript