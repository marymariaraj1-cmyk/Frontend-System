import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { MultiSalesRequest, SalesMasterData, SalesRecord, TodayEntry } from '../models/sales';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class MultiSalesEntryService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<SalesMasterData>> {
    return this.api.get<SalesMasterData>('/multi-sales/master-data');
  }

  getTodayEntries(): Observable<ApiResponse<TodayEntry[]>> {
    return this.api.get<TodayEntry[]>('/multi-sales/today-entries');
  }

  save(request: MultiSalesRequest): Observable<ApiResponse<SalesRecord[]>> {
    return this.api.post<SalesRecord[]>('/multi-sales/save', request);
  }
}
