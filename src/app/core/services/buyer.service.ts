import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import { Buyer } from '../models/buyer';

@Injectable({ providedIn: 'root' })
export class BuyerService {
  private readonly api = inject(ApiService);

  getBuyers(): Observable<ApiResponse<Buyer[]>> {
    return this.api.get<Buyer[]>('/buyers/list');
  }

  saveBuyer(buyer: Buyer): Observable<ApiResponse<void>> {
    return this.api.post<void>('/buyers/save', buyer);
  }

  deleteBuyer(buyerId: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/buyers/delete/${buyerId}`);
  }
}
