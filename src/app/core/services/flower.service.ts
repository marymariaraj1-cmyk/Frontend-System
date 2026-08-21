import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import { Flower } from '../models/flower';

@Injectable({ providedIn: 'root' })
export class FlowerService {
  private readonly api = inject(ApiService);

  getFlowers(): Observable<ApiResponse<Flower[]>> {
    return this.api.get<Flower[]>('/flowers/list');
  }

  saveFlower(flower: Flower): Observable<ApiResponse<void>> {
    return this.api.post<void>('/flowers/save', flower);
  }

  deleteFlower(flowerId: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/flowers/delete/${flowerId}`);
  }
}
