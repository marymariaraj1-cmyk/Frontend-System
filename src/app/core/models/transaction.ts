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
  paymentMode: string;
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
  paymentMode: string;
}

export interface FarmerTransactionRequest {
  farmerName: string;
  transactionDate: string;
  excessDebitAmt: string;
  debitAmt: string;
  paymentMode: string;
}

export interface BuyerTransactionRequest {
  buyerName: string;
  transactionDate: string;
  amountReceived: string;
  discountAmt: string;
  paymentMode: string;
}

export interface OpeningBalanceData {
  openingBalance: number;
}
