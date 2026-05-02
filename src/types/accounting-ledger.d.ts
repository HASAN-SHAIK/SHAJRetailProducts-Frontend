export type ReceiptPaymentMode = 'cash' | 'bank' | 'online';
export type OutPaymentMode = 'cash' | 'bank';
export type PaymentEntryType = 'supplier' | 'expense';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface ReceiptEntryPayload {
  customer_id: number;
  amount: number;
  payment_mode: ReceiptPaymentMode;
  reference_id?: string;
  notes?: string;
  date: string;
  branch_id: string;
  client_txn_id: string;
}

export interface PaymentEntryPayload {
  type: PaymentEntryType;
  supplier_id?: number;
  expense_category?: string;
  amount: number;
  payment_mode: OutPaymentMode;
  reference_id?: string;
  notes?: string;
  date: string;
  branch_id: string;
  client_txn_id: string;
}

export interface BookEntry {
  id: string;
  date: string;
  description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  reference_id: number | null;
  reference_type: string | null;
  transaction_id: number | null;
  branch_id: string | null;
  ledger_id: string;
  ledger_name: string;
}

export interface BookResponse {
  opening_balance: number;
  entries: BookEntry[];
}

export interface OutstandingRow {
  id: string;
  name: string;
  total_debit: number;
  total_credit: number;
  outstanding: number;
}

export interface OutstandingResponse {
  rows: OutstandingRow[];
}
