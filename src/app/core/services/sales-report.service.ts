import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  BuyerSalesReportRow,
  CurrentDayProfitRow,
  CurrentDayProfitSalesDetail,
  FarmerSalesReportRow,
} from '../models/report';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SalesReportService {
  private readonly api = inject(ApiService);

  getFarmerSalesReport(
    fromDate: string,
    toDate: string,
  ): Observable<ApiResponse<FarmerSalesReportRow[]>> {
    return this.api.post<FarmerSalesReportRow[]>('/farmer-sales-report/data', {
      fromDate,
      toDate,
    });
  }

  getBuyerSalesReport(
    fromDate: string,
    toDate: string,
  ): Observable<ApiResponse<BuyerSalesReportRow[]>> {
    return this.api.post<BuyerSalesReportRow[]>('/buyer-sales-report/data', {
      fromDate,
      toDate,
    });
  }

  getCurrentDayProfit(): Observable<ApiResponse<CurrentDayProfitRow[]>> {
    return this.api.get<CurrentDayProfitRow[]>('/current-day-profit/data');
  }

  getCurrentDayProfitSalesDetails(
    farmerId: string,
  ): Observable<ApiResponse<CurrentDayProfitSalesDetail[]>> {
    return this.api.post<CurrentDayProfitSalesDetail[]>('/current-day-profit/sales-details', {
      farmerId,
    });
  }
}
