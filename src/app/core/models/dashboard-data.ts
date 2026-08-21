export interface DashboardKpis {
  todaySales: number;
  todayCommission: number;
  todayKg: number;
  activeFarmers: number;
  activeBuyers: number;
  yesterdaySales: number;
  yesterdayCommission: number;
}

export interface DashboardMasterCounts {
  farmers: number;
  buyers: number;
  flowers: number;
}

export interface DashboardTrendRow {
  salesDate: string;
  amount: number;
}

export interface DashboardTopFlowerRow {
  flowerType: string;
  totalKg: number;
}

export interface DashboardTopFarmerRow {
  farmerId: string;
  farmerName: string;
  totalSalesAmt: number;
}

export interface DashboardOutstandingRow {
  farmerId?: string;
  farmerName?: string;
  buyerId?: string;
  buyerName?: string;
  outstandingBalance: number;
}

export interface DashboardDirectPayments {
  cashToday: number;
  upiToday: number;
  otherToday: number;
  cashMonth: number;
  upiMonth: number;
  otherMonth: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  masterCounts: DashboardMasterCounts;
  trend: DashboardTrendRow[];
  monthTrend: DashboardTrendRow[];
  topFlowers: DashboardTopFlowerRow[];
  topFarmers: DashboardTopFarmerRow[];
  outstandingFarmers: DashboardOutstandingRow[];
  outstandingBuyers: DashboardOutstandingRow[];
  directPayments: DashboardDirectPayments;
}
