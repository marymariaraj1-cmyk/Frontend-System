export interface CashBookFarmerRow {
  farmerId: string | null;
  farmerName: string;
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
  rentAmt: number;
  expenseAmt: number;
  chitAmt: number;
  financeAmt: number;
  noteAmt: number;
  salaryAmt: number;
  coinAmt: number;
  buyerPurchaseTotal: number;
  farmerExcessDebitCash: number;
  farmerExcessDebitCashList: CashBookFarmerRow[];
  cashInHandAmt: number;
  openingBalance: number;
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
