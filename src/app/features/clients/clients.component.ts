import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Client, emptyClient } from '../../core/models/client';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { ClientService } from '../../core/services/client.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './clients.html',
  styleUrl: './clients.css',
})
export class ClientsComponent implements OnInit {
  private readonly clientService = inject(ClientService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<Client[]>([]);
  protected readonly showForm = signal(false);
  protected form = emptyClient();
  protected editing = false;
  protected submitting = false;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.clientService.getClients().subscribe({
      next: (response) => {
        if (response.success) {
          this.rows.set(response.data);
        } else {
          this.toast.error(response.message);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
  }

  protected startAdd(): void {
    this.editing = false;
    this.showForm.set(true);
    this.form = emptyClient();
  }

  protected startEdit(row: Client): void {
    this.editing = true;
    this.showForm.set(true);
    this.form = { ...row, clientPassword: '' };
  }

  protected cancel(): void {
    this.showForm.set(false);
  }

  protected submit(): void {
    if (this.submitting) {
      return;
    }
    if (!this.form.clientUsername?.trim()) {
      this.toast.error(this.i18n.translate('client.username.required'));
      return;
    }
    if (!this.form.clientShopName?.trim()) {
      this.toast.error(this.i18n.translate('client.shopname.required'));
      return;
    }
    if (!this.editing && !this.form.clientPassword) {
      this.toast.error(this.i18n.translate('client.password.required'));
      return;
    }
    this.submitting = true;
    this.clientService.saveClient(this.form).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.success) {
          this.toast.success(response.message);
          this.showForm.set(false);
          this.form = emptyClient();
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: () => {
        this.submitting = false;
        this.toast.error(this.i18n.translate('common.save.failed'));
      },
    });
  }
}
