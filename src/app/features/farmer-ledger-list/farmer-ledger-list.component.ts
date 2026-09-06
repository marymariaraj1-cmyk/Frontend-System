import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { FarmerLedgerEntry } from '../../core/models/ledger';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-farmer-ledger-list',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './farmer-ledger-list.html',
  styleUrl: './farmer-ledger-list.css',
})
export class FarmerLedgerListComponent implements OnInit {
  private readonly service = inject(FarmerLedgerService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly entries = signal<FarmerLedgerEntry[]>([]);
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

  ngOnInit(): void {
    this.loadList();
  }

  protected filteredEntries(): FarmerLedgerEntry[] {
    const q = this.search().trim().toLowerCase();
    if (q === '') {
      return this.entries();
    }
    return this.entries().filter((entry) => entry.farmerName.toLowerCase().includes(q));
  }

  protected summaryTotal(): number {
    return this.entries().length;
  }

  protected summaryOutstanding(): number {
    return this.entries().reduce((sum, entry) => sum + Math.abs(Number(entry.outstandingBalance) || 0), 0);
  }

  protected summarySettled(): number {
    return this.entries().filter((entry) => (Number(entry.outstandingBalance) || 0) <= 0).length;
  }

  protected outstandingAbs(value: number): number {
    return Math.abs(value);
  }

  protected initials(name: string | undefined): string {
    if (!name) {
      return '?';
    }
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
  }

  protected balanceClass(value: number): string {
    if (value > 0) {
      return 'credit';
    }
    if (value < 0) {
      return 'debit';
    }
    return 'settled';
  }

  protected viewDetail(entry: FarmerLedgerEntry): void {
    this.router.navigate(['/farmer-ledger-detail'], {
      queryParams: {
        farmerId: entry.farmerId,
        farmerName: entry.farmerName,
        source: 'ledger'
      },
      queryParamsHandling: 'merge'
    });
  }

  private loadList(): void {
    this.loading.set(true);
    this.service.getFarmerList().subscribe({
      next: (response) => {
        this.loading.set(false);
        this.loaded.set(true);
        if (response.success) {
          this.entries.set(response.data);
        } else {
          this.entries.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.loaded.set(true);
        this.entries.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }
}
