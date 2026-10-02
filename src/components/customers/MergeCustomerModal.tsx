"use client";

/**
 * Merge a duplicate customer INTO the customer whose card is open.
 * STUB — implemented by the merge package (preview counts → typed confirmation → merge).
 */
export interface MergeCustomerModalProps {
  /** The customer that stays (the card that is open). */
  targetId: string;
  targetName: string;
  onClose: () => void;
  /** Called after a successful merge (the duplicate no longer exists). */
  onMerged: () => void;
}

export function MergeCustomerModal(_props: MergeCustomerModalProps) {
  return null;
}
