import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BuyerLedgerEntry } from '../../core/models/ledger';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BuyerLedgerService } from '../../core/services/buyer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { LedgerNavService } from '../../core/services/ledger-nav.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-buyer-ledger-report',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './buyer-ledger-report.html',
  styleUrl: './buyer-ledger-report.css',
})
export class BuyerLedgerReportComponent implements OnInit {
  private readonly service = inject(BuyerLedgerService);
  private readonly router = inject(Router);
  private readonly ledgerNav = inject(LedgerNavService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly entries = signal<BuyerLedgerEntry[]>([]);
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

  protected readonly formatCurrency = formatCurrency;

  ngOnInit(): void {
    this.loadList();
  }

  protected filteredEntries(): BuyerLedgerEntry[] {
    const q = this.search().trim().toLowerCase();
    if (q === '') {
      return this.entries();
    }
    return this.entries().filter((entry) => entry.buyerName.toLowerCase().includes(q));
  }

  protected viewDetail(entry: BuyerLedgerEntry): void {
    this.ledgerNav.setBuyer(entry.buyerId, entry.buyerName, 'report');
    this.router.navigate(['/buyer-ledger-detail']);
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

  protected outstandingAbs(value: number): number {
    return Math.abs(value);
  }

  protected balanceClass(value: number): string {
    if (value > 0) {
      return 'debit';
    }
    if (value < 0) {
      return 'credit';
    }
    return 'settled';
  }

  private loadList(): void {
    this.loading.set(true);
    // Buyer ledger report alone includes Cash / UPI payment buyers.
    this.service.getBuyerList(true).subscribe({
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
