export type LedgerType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';
export type LedgerSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';
export type LedgerReferenceType = 'order' | 'expense' | 'payment' | 'return';

export interface Ledger {
  id: string;
  name: string;
  type: LedgerType;
  parent_id: string | null;
  is_system: boolean;
  branch_id: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  ledger_id: string;
  debit: number;
  credit: number;
  transaction_id: number | null;
  reference_id: number | null;
  reference_type: LedgerReferenceType;
  description: string | null;
  date: string;
  branch_id: string | null;
  sync_status: LedgerSyncStatus;
  source_event_key: string;
  line_no: number;
  created_at: string;
}

export interface TrialBalanceRow {
  id: string;
  name: string;
  type: LedgerType;
  total_debit: number;
  total_credit: number;
  net_balance: number;
}

export interface ProfitLossSummary {
  total_income: number;
  total_expense: number;
  net_profit: number;
}

export interface BalanceSheetSummary {
  total_assets: number;
  total_liabilities: number;
}
