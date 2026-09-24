import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { ShopProfile } from '../models/shop-profile';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ClientProfileService {
  private readonly api = inject(ApiService);

  getShopProfile(): Observable<ApiResponse<ShopProfile>> {
    return this.api.get<ShopProfile>('/client-profile/me');
  }
}
