import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  BuyerMasterData,
  BuyerTransaction,
  BuyerTransactionRequest,
  OpeningBalanceData,
} from '../models/transaction';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class BuyerTransactionService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<BuyerMasterData>> {
    return this.api.get<BuyerMasterData>('/buyer-transaction/master-data');
  }

  save(request: BuyerTransactionRequest): Observable<ApiResponse<BuyerTransaction>> {
    return this.api.post<BuyerTransaction>('/buyer-transaction/save', request);
  }

  getOpeningBalance(buyerName: string): Observable<ApiResponse<OpeningBalanceData>> {
    const params = `buyerName=${encodeURIComponent(buyerName)}`;
    return this.api.get<OpeningBalanceData>(`/buyer-transaction/opening-balance?${params}`);
  }

  getHistory(buyerName: string, fromDate: string, toDate: string): Observable<ApiResponse<BuyerTransaction[]>> {
    const params = `buyerName=${encodeURIComponent(buyerName)}&fromDate=${fromDate}&toDate=${toDate}`;
    return this.api.get<BuyerTransaction[]>(`/buyer-transaction/history?${params}`);
  }
}
