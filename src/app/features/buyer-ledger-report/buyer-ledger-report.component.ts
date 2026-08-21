import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BuyerLedgerEntry } from '../../core/models/ledger';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BuyerLedgerService } from '../../core/services/buyer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
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
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly entries = signal<BuyerLedgerEntry[]>([]);
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

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
    sessionStorage.setItem(
      'bb_buyer_ledger',
      JSON.stringify({ buyerId: entry.buyerId, buyerName: entry.buyerName }),
    );
    this.router.navigate(['/buyer-ledger-detail'], { queryParams: { source: 'report' } });
  }

  private loadList(): void {
    this.loading.set(true);
    this.service.getBuyerList().subscribe({
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
