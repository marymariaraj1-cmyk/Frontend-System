import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { FarmerMasterData } from '../../core/models/transaction';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FarmerTransactionService } from '../../core/services/farmer-transaction.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatApiDate } from '../../core/utils/sales.util';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

@Component({
  selector: 'app-farmer-transaction',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './farmer-transaction.html',
  styleUrl: './farmer-transaction.css',
})
export class FarmerTransactionComponent implements OnInit {
  private readonly service = inject(FarmerTransactionService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly master = signal<FarmerMasterData>({ farmers: [] });
  protected readonly farmer = signal('');
  protected readonly farmerInvalid = signal(false);
  protected readonly txnDate = signal(formatApiDate(new Date()));
  protected readonly excessDebit = signal('');
  protected readonly debit = signal('');
  protected readonly saving = signal(false);

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

  protected sanitizeExcessDebit(value: string): void {
    this.excessDebit.set(this.sanitizeAmount(value));
  }

  protected sanitizeDebit(value: string): void {
    this.debit.set(this.sanitizeAmount(value));
  }

  protected clearForm(): void {
    this.farmer.set('');
    this.farmerInvalid.set(false);
    this.txnDate.set(formatApiDate(new Date()));
    this.excessDebit.set('');
    this.debit.set('');
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const farmer = this.farmer().trim();
    const excessDebit = this.excessDebit();
    const debit = this.debit();

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
    if (!this.txnDate()) {
      this.toast.error(this.i18n.translate('txn.error.date.required'));
      return;
    }
    if (excessDebit && !AMOUNT_RE.test(excessDebit)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (debit && !AMOUNT_RE.test(debit)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (!excessDebit && !debit) {
      this.toast.error(this.i18n.translate('txn.error.excess.debit.or.debit.required'));
      return;
    }

    this.saving.set(true);
    this.service
      .save({
        farmerName: farmer,
        transactionDate: this.txnDate(),
        excessDebitAmt: excessDebit,
        debitAmt: debit,
      })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success) {
            this.toast.success(response.message);
            this.clearForm();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('common.save.failed')));
        },
      });
  }

  private matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  private sanitizeAmount(value: string): string {
    return value
      .replace(/[^0-9.]/g, '')
      .replace(/(\..*)\./g, '$1')
      .replace(/(\.\d{2})\d+/g, '$1');
  }
}
