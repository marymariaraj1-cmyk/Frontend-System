import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
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
  imports: [I18nPipe, DataTableComponent],
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
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  protected readonly ledgerTable = viewChild<DataTableComponent>('ledgerTable');

  protected readonly formatCurrency = formatCurrency;

  protected readonly columns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'txn.sno',
      type: 'text',
      align: 'center',
      sortable: false,
      filterable: false,
      className: 'col-no',
    },
    {
      key: 'buyerName',
      header: 'ledger.list.col.buyer.name',
      type: 'text',
      className: 'col-name',
    },
    {
      key: 'outstandingBalance',
      header: 'ledger.list.col.outstanding.balance',
      type: 'number',
      className: 'col-outstanding',
    },
    {
      key: 'action',
      header: 'ledger.list.col.action',
      type: 'text',
      align: 'center',
      sortable: false,
      filterable: false,
      className: 'col-action',
    },
  ];

  ngOnInit(): void {
    this.loadList();
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
