fn main() {
    // Compiles methods/guest into a RISC-V ELF and writes a generated
    // methods.rs (under OUT_DIR) defining:
    //   pub const ZKVAULT_GUEST_ELF: &[u8]
    //   pub const ZKVAULT_GUEST_ID: [u32; 8]
    // (names derived from the guest's [[bin]] name, upper-cased)
    risc0_build::embed_methods();
}
