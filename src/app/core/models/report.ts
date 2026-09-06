export interface FarmerSalesReportItem {
  farmerId: string;
  farmerName: string;
  salesDate: string;
  flowerType: string;
  totalWeight: number;
  perKgRate: number;
  price: number;
  custName: string;
}

export interface FarmerSalesReportRow {
  farmerId: string;
  farmerName: string;
  total: number;
  commission: number;
  debit: number;
  netAmount: number;
  totalNetAmt: number;
  finalTotal: number;
  items: FarmerSalesReportItem[];
  debitBreakdown?: string;
  debitDetails?: number[];
}

export interface BuyerSalesReportItem {
  buyerId: string;
  salesDate: string;
  flowerType: string;
  totalWeight: number;
  perKgRate: number;
  price: number;
  custName: string;
}

export interface BuyerSalesReportRow {
  buyerId: string;
  buyerName: string;
  totalWeight: number;
  discount: number;
  totalAmount: number;
  items: BuyerSalesReportItem[];
}

export interface CurrentDayProfitRow {
  farmerId: string;
  farmerName: string;
  totalSalesAmt: number;
  totalNetAmt: number;
  debitAmt: number;
  finalAmt: number;
  commissionAmt: number;
}

export interface CurrentDayProfitSalesDetail {
  farmerId: string;
  farmerName: string;
  custName: string;
  flowerType: string;
  totalWeight: number;
  perKgRate: number;
  price: number;
}
