import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { FarmerLedgerEntry } from '../../core/models/ledger';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { LedgerNavService } from '../../core/services/ledger-nav.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-farmer-ledger-list',
  standalone: true,
  imports: [I18nPipe, DataTableComponent],
  templateUrl: './farmer-ledger-list.html',
  styleUrl: './farmer-ledger-list.css',
})
export class FarmerLedgerListComponent implements OnInit {
  private readonly service = inject(FarmerLedgerService);
  private readonly router = inject(Router);
  private readonly ledgerNav = inject(LedgerNavService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly ledgerTable = viewChild<DataTableComponent>('ledgerTable');
  protected readonly entries = signal<FarmerLedgerEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

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
      key: 'farmerName',
      header: 'ledger.list.col.farmer.name',
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
    this.ledgerNav.setFarmer(entry.farmerId, entry.farmerName, 'ledger');
    this.router.navigate(['/farmer-ledger-detail']);
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
