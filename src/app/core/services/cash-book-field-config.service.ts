import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  CashBookFieldConfig,
  CashBookFieldConfigRequest,
  CashBookFieldType,
} from '../models/cash-book-field-config';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CashBookFieldConfigService {
  private readonly api = inject(ApiService);

  list(): Observable<ApiResponse<CashBookFieldConfig[]>> {
    return this.api.get<CashBookFieldConfig[]>('/cash-book-field-config/list');
  }

  create(request: CashBookFieldConfigRequest): Observable<ApiResponse<CashBookFieldConfig>> {
    return this.api.post<CashBookFieldConfig>('/cash-book-field-config/create', request);
  }

  update(request: CashBookFieldConfigRequest): Observable<ApiResponse<CashBookFieldConfig>> {
    return this.api.put<CashBookFieldConfig>('/cash-book-field-config/update', request);
  }

  remove(fieldConfigId: number): Observable<ApiResponse<null>> {
    return this.api.delete<null>(`/cash-book-field-config/delete?fieldConfigId=${fieldConfigId}`);
  }

  reorder(fieldType: CashBookFieldType, ids: number[]): Observable<ApiResponse<null>> {
    return this.api.put<null>('/cash-book-field-config/reorder', { fieldType, ids });
  }
}