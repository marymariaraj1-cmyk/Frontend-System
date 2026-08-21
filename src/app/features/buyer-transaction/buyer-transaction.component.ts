import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { BuyerMasterData } from '../../core/models/transaction';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BuyerTransactionService } from '../../core/services/buyer-transaction.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate } from '../../core/utils/sales.util';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const PAYMENT_EXCLUDE = ['cash', 'upi', 'google pay', 'gpay', 'phonepe', 'paytm', 'online', 'card', 'neft', 'rtgs', 'imps'];

@Component({
  selector: 'app-buyer-transaction',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './buyer-transaction.html',
  styleUrl: './buyer-transaction.css',
})
export class BuyerTransactionComponent implements OnInit {
  private readonly service = inject(BuyerTransactionService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly master = signal<BuyerMasterData>({ buyers: [] });
  protected readonly buyer = signal('');
  protected readonly buyerInvalid = signal(false);
  protected readonly txnDate = signal(formatApiDate(new Date()));
  protected readonly amountReceived = signal('');
  protected readonly discountAmt = signal('');
  protected readonly openingBalance = signal(0);
  protected readonly closingBalance = signal(0);
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

  protected onBuyerSelected(value: string): void {
    this.buyer.set(value);
    this.buyerInvalid.set(false);
    this.onBuyerChange();
  }

  protected onBuyerChange(): void {
    const buyer = this.buyer().trim();
    if (buyer && this.matchesMaster(buyer, this.master().buyers)) {
      this.loadOpeningBalance(buyer);
    } else {
      this.openingBalance.set(0);
      this.recalcClosing();
    }
  }

  protected validateBuyer(): void {
    const value = this.buyer().trim();
    if (value === '') {
      this.buyerInvalid.set(false);
      return;
    }
    this.buyerInvalid.set(!this.matchesMaster(value, this.master().buyers));
  }

  private loadOpeningBalance(buyer: string): void {
    this.service.getOpeningBalance(buyer).subscribe({
      next: (response) => {
        if (response.success) {
          this.openingBalance.set(response.data.openingBalance ?? 0);
          this.recalcClosing();
        }
      },
      error: () => {
        this.openingBalance.set(0);
        this.recalcClosing();
      },
    });
  }

  protected sanitizeAmountReceived(value: string): void {
    this.amountReceived.set(this.sanitizeAmount(value));
    this.recalcClosing();
  }

  protected sanitizeDiscount(value: string): void {
    this.discountAmt.set(this.sanitizeAmount(value));
    this.recalcClosing();
  }

  protected recalcClosing(): void {
    const received = parseFloat(this.amountReceived()) || 0;
    const discount = parseFloat(this.discountAmt()) || 0;
    this.closingBalance.set(roundOff(this.openingBalance() - (received + discount)));
  }

  protected clearForm(): void {
    this.buyer.set('');
    this.buyerInvalid.set(false);
    this.amountReceived.set('');
    this.discountAmt.set('');
    this.openingBalance.set(0);
    this.closingBalance.set(0);
    this.txnDate.set(formatApiDate(new Date()));
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const buyer = this.buyer().trim();
    const amountReceived = this.amountReceived().trim();
    const discount = this.discountAmt().trim();

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
    if (!this.txnDate()) {
      this.toast.error(this.i18n.translate('txn.error.date.required'));
      return;
    }
    if (!amountReceived && !discount) {
      this.toast.error(this.i18n.translate('txn.error.amount.or.discount.required'));
      return;
    }
    if (amountReceived !== '' && !AMOUNT_RE.test(amountReceived)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (amountReceived !== '' && parseFloat(amountReceived) <= 0) {
      this.toast.error(this.i18n.translate('txn.error.amount.positive'));
      return;
    }
    if (discount !== '' && !AMOUNT_RE.test(discount)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (discount !== '' && parseFloat(discount) <= 0) {
      this.toast.error(this.i18n.translate('txn.error.amount.positive'));
      return;
    }

    this.saving.set(true);
    this.service
      .save({
        buyerName: buyer,
        transactionDate: this.txnDate(),
        amountReceived,
        discountAmt: discount,
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
    if (PAYMENT_EXCLUDE.some((ex) => lower.indexOf(ex) !== -1)) {
      return false;
    }
    return list.some((item) => item.toLowerCase() === lower);
  }

  private sanitizeAmount(value: string): string {
    return value
      .replace(/[^0-9.]/g, '')
      .replace(/(\..*)\./g, '$1')
      .replace(/(\.\d{2})\d+/g, '$1');
  }
}
