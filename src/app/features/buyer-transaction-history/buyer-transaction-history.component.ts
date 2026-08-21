import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { BuyerMasterData, BuyerTransaction } from '../../core/models/transaction';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BuyerTransactionService } from '../../core/services/buyer-transaction.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatApiDate } from '../../core/utils/sales.util';

const PAYMENT_EXCLUDE = ['cash', 'upi', 'google pay', 'gpay', 'phonepe', 'paytm', 'online', 'card', 'neft', 'rtgs', 'imps'];

@Component({
  selector: 'app-buyer-transaction-history',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './buyer-transaction-history.html',
  styleUrl: './buyer-transaction-history.css',
})
export class BuyerTransactionHistoryComponent implements OnInit {
  private readonly service = inject(BuyerTransactionService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly master = signal<BuyerMasterData>({ buyers: [] });
  protected readonly buyer = signal('');
  protected readonly buyerInvalid = signal(false);
  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly transactions = signal<BuyerTransaction[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  ngOnInit(): void {
    this.loadMasterData();
  }

  private loadMasterData(): void {
    this.service.getMasterData().subscribe({
      next: (response) => {
        if (response.success) {
          this.master.set(response.data);
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) =>
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed'))),
    });
  }

  protected validateBuyer(): void {
    const value = this.buyer().trim();
    if (value === '') {
      this.buyerInvalid.set(false);
      return;
    }
    this.buyerInvalid.set(!this.matchesMaster(value, this.master().buyers));
  }

  protected search(): void {
    if (this.loading()) {
      return;
    }
    const buyer = this.buyer().trim();
    const fromDate = this.fromDate();
    const toDate = this.toDate();

    if (!buyer) {
      this.toast.error(this.i18n.translate('txn.error.buyer.required'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(buyer, this.master().buyers)) {
      this.toast.error(this.i18n.translate('txn.error.buyer.notfound'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!fromDate || !toDate) {
      this.toast.error(this.i18n.translate('txn.error.dates.required'));
      return;
    }

    this.loading.set(true);
    this.service.getHistory(buyer, fromDate, toDate).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.searched.set(true);
        if (response.success) {
          this.transactions.set(response.data);
        } else {
          this.transactions.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.searched.set(true);
        this.transactions.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    if (PAYMENT_EXCLUDE.some((ex) => lower.indexOf(ex) !== -1)) {
      return false;
    }
    return list.some((item) => item.toLowerCase() === lower);
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
