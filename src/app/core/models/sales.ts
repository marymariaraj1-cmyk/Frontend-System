export interface SalesMasterData {
  farmers: string[];
  flowers: string[];
  buyers: string[];
}

export interface SalesRecord {
  salesId: number;
  clientId: number;
  clientUsername: string;
  farmerId: string;
  farmerName: string;
  salesDate: string;
  flowerType: string;
  totalWeight: number;
  price: number;
  buyerId: string;
  perKgRate: number;
  custName: string;
  debitCreditFlag: string;
  saleSlotId: string;
}

export interface SalesLineInput {
  flowerType: string;
  bagCount?: string;
  totalWeight: string;
  price: string;
  amount: string;
  customerName: string;
}

export interface SalesRequest {
  farmerName: string;
  salesDate: string;
  totalSalesAmt: string;
  commissionAmt: string;
  netAmount: string;
  finalTotal: string;
  debitAmount: string;
  rows: SalesLineInput[];
  ledgerActive?: string;
  updatePreviousYRecords?: boolean;
}

export interface SalesEditRow {
  salesId: number;
  flowerType: string;
  bagCount?: number;
  totalWeight: number;
  perKgRate: number;
  price: number;
  customerName: string;
  buyerId: string;
}

export interface SalesEditSummary {
  totalSalesAmt: number;
  commissionAmt: number;
  totalNetAmt: number;
  debitAmt: number;
  finalAmt: number;
}

export interface SalesEditFetchData {
  farmerId: string;
  farmerName: string;
  salesDate: string;
  rows: SalesEditRow[];
  summary: SalesEditSummary | null;
}

export interface SalesEditRowRequest {
  salesId: number;
  flowerType: string;
  bagCount?: string;
  totalWeight: string;
  price: string;
  amount: string;
}

export interface SalesEditRequest {
  farmerName: string;
  salesDate: string;
  debitEdited: boolean;
  debitAmount: string;
  rows: SalesEditRowRequest[];
  ledgerActive?: string;
  updatePreviousYRecords?: boolean;
}

export interface MultiSalesLine {
  farmerName: string;
  flowerType: string;
  bagCount?: string;
  totalWeight: string;
  price: string;
  amount: string;
  customerName: string;
  ledgerActive?: string;
  updatePreviousYRecords?: boolean;
}

export interface MultiSalesRequest {
  rows: MultiSalesLine[];
  totalSalesAmt?: string;
  commissionAmt?: string;
  netAmount?: string;
  finalTotal?: string;
  debitAmount?: string;
}

export interface TodayEntry {
  salesId: number;
  farmerName: string;
  flowerType: string;
  totalWeight: number;
  price: number;
  amount: number;
  customerName: string;
  saleSlotId: string;
}
