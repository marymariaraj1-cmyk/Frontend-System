import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import { Farmer } from '../models/farmer';

@Injectable({ providedIn: 'root' })
export class FarmerService {
  private readonly api = inject(ApiService);

  getFarmers(): Observable<ApiResponse<Farmer[]>> {
    return this.api.get<Farmer[]>('/farmers/list');
  }

  saveFarmer(farmer: Farmer): Observable<ApiResponse<void>> {
    return this.api.post<void>('/farmers/save', farmer);
  }

  deleteFarmer(farmerId: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/farmers/delete/${farmerId}`);
  }
}
