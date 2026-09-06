export interface FarmerLedgerEntry {
  farmerId: string;
  farmerName: string;
  outstandingBalance: number;
}

export interface BuyerLedgerEntry {
  buyerId: string;
  buyerName: string;
  outstandingBalance: number;
}

export interface FarmerLedgerDetailRow {
  salesDate: string;
  openingBalance: number;
  sales: number;
  creditAmount: number;
  closingBalance: number;
  ledgerActive?: string;
  salesIds?: string;
}

export interface BuyerLedgerDetailRow {
  salesDate: string;
  openingBalance: number;
  purchase: number;
  cash: number;
  discount: number;
  closingBalance: number;
  ledgerActive?: string;
}

export interface LedgerReportRow {
  salesDate: string;
  creditAmt: number;
  debitAmt: number;
}

export interface FarmerSalesItem {
  farmerId: string;
  farmerName: string;
  salesDate: string;
  flowerType: string;
  totalWeight: number;
  perKgRate: number;
  price: number;
  custName: string;
}

export interface FarmerSalesSummary {
  farmerId: string;
  farmerName: string;
  salesDate: string;
  total: number;
  commission: number;
  netAmount: number;
  debit: number;
  finalTotal: number;
  adjustmentAmt?: number;
  debitBreakdown?: string;
  debitDetails?: number[];
}

export interface FarmerSalesByDateData {
  data: FarmerSalesItem[];
  summary: FarmerSalesSummary | null;
}

export interface ActiveLedgerRow {
  salesDate: string;
  creditAmt: number;
  debitAmt: number;
}

export interface PreviewResponse {
  willCauseZeroClose: boolean;
}

export interface BuyerSalesItem {
  buyerId: string;
  salesDate: string;
  flowerType: string;
  totalWeight: number;
  perKgRate: number;
  price: number;
  custName: string;
}
