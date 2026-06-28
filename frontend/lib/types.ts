export interface ProofBundle {
  journal_hex: string;
  seal_hex: string;
  method_id_hex: string;
  is_eligible: boolean;
  user_id_hash_hex: string;
}

export interface EligibilityRecord {
  is_eligible: boolean;
  threshold_used: number;
}

export type ProofSource = "generate" | "upload";
