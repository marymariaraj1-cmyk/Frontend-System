export interface CashBookFarmerRow {
  farmerId: string | null;
  farmerName: string;
  amount: number;
}

export interface ManualAmountEntry {
  label: string;
  amount: number;
}

export interface CashBookBlocks {
  buyerPurchaseTotal: number;
  farmerExcessDebitCashList: CashBookFarmerRow[];
  farmerExcessDebitCash: number;
  buyerReceivedTotal: number;
  commissionTotal: number;
  installmentTotal: number;
  farmerExcessDebitNonCashList: CashBookFarmerRow[];
  farmerExcessDebitNonCash: number;
  shopName?: string | null;
}

export interface CashBookRecord {
  dailyCashBookId: number;
  bookDate: string;
  manualDebitTotal: number;
  manualCreditTotal: number;
  manualDebitEntries: ManualAmountEntry[];
  manualCreditEntries: ManualAmountEntry[];
  buyerPurchaseTotal: number;
  farmerExcessDebitCash: number;
  farmerExcessDebitCashList: CashBookFarmerRow[];
  buyerReceivedTotal: number;
  commissionTotal: number;
  installmentTotal: number;
  farmerExcessDebitNonCash: number;
  farmerExcessDebitNonCashList: CashBookFarmerRow[];
  totalDebitSide: number;
  totalCreditSide: number;
  closingBalance: number;
  remarks: string | null;
  shopName?: string | null;
}