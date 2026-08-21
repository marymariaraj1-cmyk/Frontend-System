import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  FarmerLedgerDetailRow,
  FarmerLedgerEntry,
  FarmerSalesByDateData,
  LedgerReportRow,
} from '../models/ledger';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FarmerLedgerService {
  private readonly api = inject(ApiService);

  getFarmerList(): Observable<ApiResponse<FarmerLedgerEntry[]>> {
    return this.api.get<FarmerLedgerEntry[]>('/farmer-ledger-list/data');
  }

  getFarmerDetail(
    farmerId: string,
    fromDate?: string,
    toDate?: string,
  ): Observable<ApiResponse<FarmerLedgerDetailRow[]>> {
    let params = `farmerId=${encodeURIComponent(farmerId)}`;
    if (fromDate && toDate) {
      params += `&fromDate=${fromDate}&toDate=${toDate}`;
    }
    return this.api.get<FarmerLedgerDetailRow[]>(`/farmer-ledger-detail/data?${params}`);
  }

  getFarmerReportDetail(
    farmerId: string,
    fromDate: string,
    toDate: string,
  ): Observable<ApiResponse<FarmerLedgerDetailRow[]>> {
    const params =
      `farmerId=${encodeURIComponent(farmerId)}&fromDate=${fromDate}&toDate=${toDate}&report=true`;
    return this.api.get<FarmerLedgerDetailRow[]>(`/farmer-ledger-detail/data?${params}`);
  }

  getFarmerNames(): Observable<ApiResponse<string[]>> {
    return this.api.get<string[]>('/farmer-ledger-report/farmers');
  }

  getFarmerReport(
    farmerName: string,
    fromDate: string,
    toDate: string,
  ): Observable<ApiResponse<LedgerReportRow[]>> {
    return this.api.post<LedgerReportRow[]>('/farmer-ledger-report/data', {
      farmerName,
      fromDate,
      toDate,
    });
  }

  getFarmerSalesByDate(
    farmerId: string,
    date: string,
    ledgerActive?: string,
    creditAmt?: number,
  ): Observable<ApiResponse<FarmerSalesByDateData>> {
    let params = `farmerId=${encodeURIComponent(farmerId)}&date=${encodeURIComponent(date)}`;
    if (ledgerActive) {
      params += `&ledgerActive=${encodeURIComponent(ledgerActive)}`;
    }
    if (creditAmt !== undefined && creditAmt !== null) {
      params += `&creditAmt=${creditAmt}`;
    }
    return this.api.get<FarmerSalesByDateData>(`/farmer-sales-by-date/data?${params}`);
  }
}
