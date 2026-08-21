import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import { Client } from '../models/client';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly api = inject(ApiService);

  getClients(): Observable<ApiResponse<Client[]>> {
    return this.api.get<Client[]>('/clients/list');
  }

  saveClient(client: Client): Observable<ApiResponse<Client>> {
    return this.api.post<Client>('/clients/save', client);
  }

  deleteClient(clientId: number): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/clients/delete/${clientId}`);
  }
}
