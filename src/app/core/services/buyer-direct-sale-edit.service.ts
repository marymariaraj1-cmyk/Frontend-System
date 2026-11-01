import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  BuyerDirectSaleEditFetchData,
  BuyerDirectSaleEditRequest,
  SalesMasterData,
} from '../models/sales';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class BuyerDirectSaleEditService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<SalesMasterData>> {
    return this.api.get<SalesMasterData>('/sales/master-data');
  }

  fetch(
    buyerName: string,
    salesDate: string,
  ): Observable<ApiResponse<BuyerDirectSaleEditFetchData>> {
    const params = `buyerName=${encodeURIComponent(buyerName)}&salesDate=${encodeURIComponent(salesDate)}`;
    return this.api.get<BuyerDirectSaleEditFetchData>(
      `/buyer-direct-sale-edit/fetch?${params}`,
    );
  }

  save(request: BuyerDirectSaleEditRequest): Observable<ApiResponse<{ editedRows: number }>> {
    return this.api.post<{ editedRows: number }>('/buyer-direct-sale-edit/save', request);
  }

  delete(salesId: number): Observable<ApiResponse<{ deletedSalesId: number }>> {
    return this.api.post<{ deletedSalesId: number }>('/buyer-direct-sale-edit/delete', { salesId });
  }
}
