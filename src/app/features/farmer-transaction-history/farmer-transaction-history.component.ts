import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { FarmerMasterData, FarmerTransaction } from '../../core/models/transaction';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FarmerTransactionService } from '../../core/services/farmer-transaction.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatApiDate } from '../../core/utils/sales.util';

@Component({
  selector: 'app-farmer-transaction-history',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './farmer-transaction-history.html',
  styleUrl: './farmer-transaction-history.css',
})
export class FarmerTransactionHistoryComponent implements OnInit {
  private readonly service = inject(FarmerTransactionService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly master = signal<FarmerMasterData>({ farmers: [] });
  protected readonly farmer = signal('');
  protected readonly farmerInvalid = signal(false);
  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly transactions = signal<FarmerTransaction[]>([]);
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

  protected validateFarmer(): void {
    const value = this.farmer().trim();
    if (value === '') {
      this.farmerInvalid.set(false);
      return;
    }
    this.farmerInvalid.set(!this.matchesMaster(value, this.master().farmers));
  }

  protected search(): void {
    if (this.loading()) {
      return;
    }
    const farmer = this.farmer().trim();
    const fromDate = this.fromDate();
    const toDate = this.toDate();

    if (!farmer) {
      this.toast.error(this.i18n.translate('txn.error.farmer.required'));
      this.farmerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(farmer, this.master().farmers)) {
      this.toast.error(this.i18n.translate('txn.error.farmer.notfound'));
      this.farmerInvalid.set(true);
      return;
    }
    if (!fromDate || !toDate) {
      this.toast.error(this.i18n.translate('txn.error.dates.required'));
      return;
    }

    this.loading.set(true);
    this.service.getHistory(farmer, fromDate, toDate).subscribe({
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
    return list.some((item) => item.toLowerCase() === lower);
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
