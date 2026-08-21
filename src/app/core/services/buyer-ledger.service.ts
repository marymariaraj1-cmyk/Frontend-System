import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  BuyerLedgerDetailRow,
  BuyerLedgerEntry,
  BuyerSalesItem,
  LedgerReportRow,
} from '../models/ledger';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class BuyerLedgerService {
  private readonly api = inject(ApiService);

  getBuyerList(): Observable<ApiResponse<BuyerLedgerEntry[]>> {
    return this.api.get<BuyerLedgerEntry[]>('/buyer-ledger-list/data');
  }

  getBuyerDetail(
    buyerId: string,
    fromDate?: string,
    toDate?: string,
  ): Observable<ApiResponse<BuyerLedgerDetailRow[]>> {
    let params = `buyerId=${encodeURIComponent(buyerId)}`;
    if (fromDate && toDate) {
      params += `&fromDate=${fromDate}&toDate=${toDate}`;
    }
    return this.api.get<BuyerLedgerDetailRow[]>(`/buyer-ledger-detail/data?${params}`);
  }

  getBuyerReportDetail(
    buyerId: string,
    fromDate: string,
    toDate: string,
  ): Observable<ApiResponse<BuyerLedgerDetailRow[]>> {
    const params =
      `buyerId=${encodeURIComponent(buyerId)}&fromDate=${fromDate}&toDate=${toDate}&report=true`;
    return this.api.get<BuyerLedgerDetailRow[]>(`/buyer-ledger-detail/data?${params}`);
  }

  getBuyerNames(): Observable<ApiResponse<string[]>> {
    return this.api.get<string[]>('/buyer-ledger-report/buyers');
  }

  getBuyerReport(
    buyerName: string,
    fromDate: string,
    toDate: string,
  ): Observable<ApiResponse<LedgerReportRow[]>> {
    return this.api.post<LedgerReportRow[]>('/buyer-ledger-report/data', {
      buyerName,
      fromDate,
      toDate,
    });
  }

  getBuyerSalesByDate(buyerId: string, date: string, ledgerActive?: string): Observable<ApiResponse<BuyerSalesItem[]>> {
    let params = `buyerId=${encodeURIComponent(buyerId)}&date=${encodeURIComponent(date)}`;
    if (ledgerActive) {
      params += `&ledgerActive=${encodeURIComponent(ledgerActive)}`;
    }
    return this.api.get<BuyerSalesItem[]>(`/buyer-sales-by-date/data?${params}`);
  }
}
