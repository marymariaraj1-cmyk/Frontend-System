import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  FlowerLootSaleEditFetchData,
  FlowerLootSaleEditRequest,
  SalesMasterData,
} from '../models/sales';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FlowerLootSaleEditService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<SalesMasterData>> {
    return this.api.get<SalesMasterData>('/flower-loot-sale-edit/master-data');
  }

  fetch(
    flowerName: string,
    salesDate: string,
  ): Observable<ApiResponse<FlowerLootSaleEditFetchData>> {
    const params = `flowerName=${encodeURIComponent(flowerName)}&salesDate=${encodeURIComponent(salesDate)}`;
    return this.api.get<FlowerLootSaleEditFetchData>(`/flower-loot-sale-edit/fetch?${params}`);
  }

  save(
    request: FlowerLootSaleEditRequest,
  ): Observable<ApiResponse<{ updatedBuyerRows: number; updatedFarmerRows: number }>> {
    return this.api.post<{ updatedBuyerRows: number; updatedFarmerRows: number }>(
      '/flower-loot-sale-edit/save',
      request,
    );
  }

  delete(salesId: number): Observable<ApiResponse<{ deletedSalesId: number }>> {
    return this.api.post<{ deletedSalesId: number }>('/flower-loot-sale-edit/delete', { salesId });
  }
}