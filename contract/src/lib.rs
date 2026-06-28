//! zkVault verifier contract.
//!
//! Records, per anonymized user, whether they've proven `balance >
//! threshold` via a RISC Zero proof — without the contract (or anyone else)
//! ever seeing the balance.
//!
//! NOTE ON API SURFACE: this targets Odra 2.x (`Var`, `Mapping`,
//! `#[odra::module]`, `self.env()`). Odra's macro surface moves between
//! releases — run `cargo run --release --bin zkvault_contract_build_contract`
//! (see bin/build_contract.rs) early and reconcile any compile errors
//! against https://odra.dev/docs for your exact installed version. (An
//! older `cargo odra build -b casper` CLI command doesn't accept that
//! flag on current cargo-odra -- this project hit that directly, see
//! README "Troubleshooting log".)

#[cfg(feature = "onchain-groth16")]
mod verifier;

// Address, Mapping, Var, Vec etc. all come from the prelude glob. An
// earlier draft of this file also did `use odra::{Address, Mapping, Var};`
// -- every Odra 2.x example actually confirmed (Counter, Flipper, ERC20
// livenet) resolves these via `odra::prelude::*` (sometimes alongside an
// explicit `odra::Var`, which IS re-exported at the crate root, but
// Address/Mapping were not confirmed there) -- so importing only from the
// prelude is the verified-safe choice; don't reintroduce the root import
// without checking it resolves on your installed version.
use odra::prelude::*;

#[odra::module]
pub struct ZkVault {
    owner: Var<Address>,
    /// The RISC Zero image ID (32 bytes, the 8x u32 ZKVAULT_GUEST_ID packed
    /// little-endian) that proofs must have been generated against. Lets
    /// you rotate to a new circuit version without redeploying the contract.
    method_id: Var<[u8; 32]>,
    /// Address trusted to relay attested proofs (relayer-attested mode
    /// only). Ignored under onchain-groth16.
    trusted_relayer: Var<Address>,
    eligible: Mapping<[u8; 32], bool>,
    threshold_used: Mapping<[u8; 32], u64>,
}

#[odra::event]
pub struct EligibilityVerified {
    pub user_id_hash: [u8; 32],
    pub is_eligible: bool,
    pub threshold: u64,
}

#[odra::odra_error]
pub enum VaultError {
    NotOwner = 1,
    UntrustedRelayer = 2,
    MalformedJournal = 3,
    InvalidProof = 4,
}

#[odra::module]
impl ZkVault {
    /// Constructor. `method_id` ties this deployment to one specific
    /// compiled guest program (see methods::ZKVAULT_GUEST_ID on the host
    /// side — pack the [u32; 8] to 32 little-endian bytes before passing
    /// it in).
    pub fn init(&mut self, method_id: [u8; 32], trusted_relayer: Address) {
        self.owner.set(self.env().caller());
        self.method_id.set(method_id);
        self.trusted_relayer.set(trusted_relayer);
    }

    /// Owner-only: rotate the trusted relayer (e.g. if its key is
    /// compromised, or you're handing operations to a different agent).
    pub fn set_trusted_relayer(&mut self, relayer: Address) {
        self.assert_owner();
        self.trusted_relayer.set(relayer);
    }

    /// Owner-only: rotate the expected circuit / image ID.
    pub fn set_method_id(&mut self, method_id: [u8; 32]) {
        self.assert_owner();
        self.method_id.set(method_id);
    }

    /// Submit a proof for verification and, on success, record eligibility.
    ///
    /// `journal` is the 41-byte buffer committed by the guest:
    ///   byte 0       -> is_eligible flag
    ///   bytes 1..9   -> threshold (LE u64)
    ///   bytes 9..41  -> anonymized user_id_hash
    /// `seal` is the proof itself (opaque bytes from the host's bincode
    /// serialization of the receipt — see host/src/main.rs).
    pub fn verify_eligibility(&mut self, journal: Vec<u8>, seal: Vec<u8>) {
        if journal.len() != 41 {
            self.env().revert(VaultError::MalformedJournal);
        }

        #[cfg(feature = "relayer-attested")]
        {
            // Trust model: the off-chain relayer already ran real RISC Zero
            // STARK verification (receipt.verify(METHOD_ID)) before ever
            // submitting this deploy, and this deploy is itself signed by
            // the relayer's Casper key. We check that signature here by
            // checking the caller. This is NOT trustless — a compromised
            // or dishonest relayer could submit an unverified journal. See
            // README "Verification modes".
            if self.env().caller() != self.trusted_relayer.get_or_default() {
                self.env().revert(VaultError::UntrustedRelayer);
            }
            let _ = &seal; // not cryptographically checked in this mode
        }

        #[cfg(feature = "onchain-groth16")]
        {
            let method_id = self.method_id.get_or_default();
            let ok = verifier::verify_onchain(&journal, &seal, &method_id);
            if !ok {
                self.env().revert(VaultError::InvalidProof);
            }
        }

        let is_eligible = journal[0] != 0;
        let threshold = u64::from_le_bytes(journal[1..9].try_into().unwrap());
        let mut user_id_hash = [0u8; 32];
        user_id_hash.copy_from_slice(&journal[9..41]);

        self.eligible.set(&user_id_hash, is_eligible);
        self.threshold_used.set(&user_id_hash, threshold);

        self.env().emit_event(EligibilityVerified {
            user_id_hash,
            is_eligible,
            threshold,
        });
    }

    /// View: has this anonymized user proven eligibility?
    pub fn is_eligible(&self, user_id_hash: [u8; 32]) -> bool {
        self.eligible.get(&user_id_hash).unwrap_or(false)
    }

    /// View: what threshold was the last accepted proof checked against?
    pub fn threshold_used(&self, user_id_hash: [u8; 32]) -> u64 {
        self.threshold_used.get(&user_id_hash).unwrap_or(0)
    }

    pub fn method_id(&self) -> [u8; 32] {
        self.method_id.get_or_default()
    }

    pub fn owner(&self) -> Address {
        self.owner.get_or_default()
    }

    fn assert_owner(&self) {
        if self.env().caller() != self.owner.get_or_default() {
            self.env().revert(VaultError::NotOwner);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostEnv};

    fn setup() -> (HostEnv, ZkVaultHostRef) {
        let env = odra_test::env();
        let relayer = env.get_account(1);
        let method_id = [0u8; 32]; // placeholder for unit tests
        let contract = ZkVaultHostRef::deploy(&env, ZkVaultInitArgs { method_id, trusted_relayer: relayer });
        (env, contract)
    }

    fn fake_journal(is_eligible: bool, threshold: u64, user_id_hash: [u8; 32]) -> Vec<u8> {
        let mut j = Vec::with_capacity(41);
        j.push(is_eligible as u8);
        j.extend_from_slice(&threshold.to_le_bytes());
        j.extend_from_slice(&user_id_hash);
        j
    }

    #[test]
    fn relayer_can_register_eligibility() {
        let (env, mut contract) = setup();
        let relayer = env.get_account(1);
        env.set_caller(relayer);

        let user_id_hash = [7u8; 32];
        let journal = fake_journal(true, 100_000, user_id_hash);
        contract.verify_eligibility(journal, vec![]);

        assert!(contract.is_eligible(user_id_hash));
        assert_eq!(contract.threshold_used(user_id_hash), 100_000);
    }

    #[test]
    fn untrusted_caller_is_rejected() {
        let (env, mut contract) = setup();
        let attacker = env.get_account(2);
        env.set_caller(attacker);

        let user_id_hash = [9u8; 32];
        let journal = fake_journal(true, 1, user_id_hash);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.verify_eligibility(journal, vec![]);
        }));
        assert!(result.is_err(), "expected revert for untrusted caller");
    }
}
