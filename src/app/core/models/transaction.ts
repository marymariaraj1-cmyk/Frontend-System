export interface FarmerMasterData {
  farmers: string[];
}

export interface BuyerMasterData {
  buyers: string[];
}

export interface FarmerTransaction {
  farmerTransactionId: number;
  clientId: number;
  clientUsername: string;
  farmerId: string;
  farmerName: string;
  transactionDate: string;
  cashPaidAmt: number;
  excessDebitAmt: number;
  debAmt: number;
}

export interface BuyerTransaction {
  buyerTransactionId: number;
  clientId: number;
  clientUsername: string;
  buyerId: string;
  buyerName: string;
  transactionDate: string;
  cashPaidAmt: number;
  disAmt: number;
}

export interface FarmerTransactionRequest {
  farmerName: string;
  transactionDate: string;
  excessDebitAmt: string;
  debitAmt: string;
}

export interface BuyerTransactionRequest {
  buyerName: string;
  transactionDate: string;
  amountReceived: string;
  discountAmt: string;
}

export interface OpeningBalanceData {
  openingBalance: number;
}
