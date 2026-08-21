import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { SalesMasterData, SalesRecord, SalesRequest } from '../models/sales';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<SalesMasterData>> {
    return this.api.get<SalesMasterData>('/sales/master-data');
  }

  getAutocompleteSuggestions(field: string, query: string): Observable<ApiResponse<string[]>> {
    const params = `field=${encodeURIComponent(field)}&query=${encodeURIComponent(query)}`;
    return this.api.get<string[]>(`/sales/autocomplete?${params}`);
  }

  save(request: SalesRequest): Observable<ApiResponse<SalesRecord[]>> {
    return this.api.post<SalesRecord[]>('/sales/save', request);
  }
}
