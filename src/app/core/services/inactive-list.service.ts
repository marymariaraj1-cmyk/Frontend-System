import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { InactiveBuyerRow, InactiveFarmerRow } from '../models/inactive-list';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class InactiveListService {
  private readonly api = inject(ApiService);

  getInactiveFarmers(): Observable<ApiResponse<InactiveFarmerRow[]>> {
    return this.api.get<InactiveFarmerRow[]>('/inactive/farmers');
  }

  getInactiveBuyers(): Observable<ApiResponse<InactiveBuyerRow[]>> {
    return this.api.get<InactiveBuyerRow[]>('/inactive/buyers');
  }
}