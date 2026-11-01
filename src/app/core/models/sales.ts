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
  customerName?: string;
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

export interface FlowerLootRow {
  bag: string;
  name: string;
  qty: string;
  rate: string;
  amount: string;
}

export interface FlowerLootSaveRequest {
  flowerName: string;
  salesDate: string;
  buyerRows: FlowerLootRow[];
  farmerRows: FlowerLootRow[];
}

export interface FlowerLootSaleEditRow {
  salesId: number;
  bag?: string;
  name: string;
  qty: string;
  rate: string;
  amount: string;
}

export interface FlowerLootSaleEditFetchData {
  flowerName: string;
  salesDate: string;
  buyerRows: FlowerLootSaleEditRow[];
  farmerRows: FlowerLootSaleEditRow[];
}

export interface FlowerLootSaleEditRequest {
  flowerName: string;
  salesDate: string;
  buyerRows: FlowerLootSaleEditRow[];
  farmerRows: FlowerLootSaleEditRow[];
}

export interface IntakeDirectRowInput {
  flowerType: string;
  bagCount?: string;
  totalWeight: string;
  rate: string;
  amount: string;
}

export interface FlowerIntakeSaleRequest {
  farmerName: string;
  salesDate: string;
  debitAmount: string;
  totalSalesAmt?: string;
  commissionAmt?: string;
  netAmount?: string;
  finalTotal?: string;
  rows: IntakeDirectRowInput[];
}

export interface BuyerDirectSaleRequest {
  buyerName: string;
  salesDate: string;
  rows: IntakeDirectRowInput[];
}

export interface IntakeDirectEditRow {
  salesId: number;
  flowerType: string;
  bag?: string;
  totalWeight: string;
  rate: string;
  amount: string;
}

export interface FlowerIntakeSaleEditFetchData {
  farmerId: string;
  farmerName: string;
  salesDate: string;
  rows: IntakeDirectEditRow[];
  summary: SalesEditSummary | null;
}

export interface BuyerDirectSaleEditFetchData {
  buyerId: string;
  buyerName: string;
  salesDate: string;
  rows: IntakeDirectEditRow[];
}

export interface IntakeEditRowRequest {
  salesId: number;
  flowerType: string;
  bagCount?: string;
  totalWeight: string;
  rate: string;
  amount: string;
}

export interface FlowerIntakeSaleEditRequest {
  farmerName: string;
  salesDate: string;
  rows: IntakeEditRowRequest[];
}

export interface BuyerDirectSaleEditRequest {
  buyerName: string;
  salesDate: string;
  rows: IntakeEditRowRequest[];
}
