import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}${environment.apiPrefix}`;

  get<T>(path: string) {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${path}`);
  }

  post<T>(path: string, body?: unknown) {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {});
  }

  put<T>(path: string, body?: unknown) {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {});
  }

  delete<T>(path: string) {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${path}`);
  }

  getRaw<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`);
  }
}
