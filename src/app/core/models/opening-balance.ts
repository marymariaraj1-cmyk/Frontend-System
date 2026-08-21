export interface OpeningBalanceFarmerRow {
  farmerId: string;
  farmerName: string;
  openingBalance: number;
  openingBalanceDate?: string | null;
}

export interface OpeningBalanceBuyerRow {
  buyerId: string;
  buyerName: string;
  openingBalance: number;
  openingBalanceDate?: string | null;
}
