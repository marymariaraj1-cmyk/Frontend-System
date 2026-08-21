import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  SalesEditFetchData,
  SalesEditRequest,
  SalesMasterData,
} from '../models/sales';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SalesEditService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<SalesMasterData>> {
    return this.api.get<SalesMasterData>('/sales-edit/master-data');
  }

  fetch(farmerName: string, salesDate: string): Observable<ApiResponse<SalesEditFetchData>> {
    const params = `farmerName=${encodeURIComponent(farmerName)}&salesDate=${encodeURIComponent(salesDate)}`;
    return this.api.get<SalesEditFetchData>(`/sales-edit/fetch?${params}`);
  }

  save(request: SalesEditRequest): Observable<ApiResponse<{ updatedRows: number }>> {
    return this.api.post<{ updatedRows: number }>('/sales-edit/save', request);
  }
}
