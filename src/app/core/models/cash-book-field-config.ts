export type CashBookFieldType = 'DEBIT' | 'CREDIT';

export interface CashBookFieldConfig {
  fieldConfigId: number;
  label: string;
  labelTa: string | null;
  fieldType: CashBookFieldType;
  displayOrder: number;
  inUse: boolean;
  recentDates?: string[];
}

export interface CashBookFieldConfigRequest {
  fieldConfigId?: number;
  label: string;
  labelTa: string | null;
  fieldType: CashBookFieldType;
}