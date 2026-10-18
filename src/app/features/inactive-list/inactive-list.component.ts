import { Component, OnInit, inject, signal } from '@angular/core';

import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { ReceiptPrintButtonsComponent } from '../../core/components/receipt-print-buttons/receipt-print-buttons.component';
import { InactiveBuyerRow, InactiveFarmerRow } from '../../core/models/inactive-list';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { InactiveListService } from '../../core/services/inactive-list.service';
import { ReceiptFormat, ReceiptService } from '../../core/services/receipt.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { formatDate } from '../../core/utils/date.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

type SectionType = 'farmer' | 'buyer';

@Component({
  selector: 'app-inactive-list',
  standalone: true,
  imports: [I18nPipe, ReceiptPrintButtonsComponent, DataTableComponent],
  templateUrl: './inactive-list.html',
  styleUrl: './inactive-list.css',
})
export class InactiveListComponent implements OnInit {
  private readonly service = inject(InactiveListService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly receipt = inject(ReceiptService);

  protected readonly section = signal<SectionType>('farmer');
  protected readonly farmers = signal<InactiveFarmerRow[]>([]);
  protected readonly buyers = signal<InactiveBuyerRow[]>([]);
  protected readonly loadingFarmers = signal(false);
  protected readonly loadingBuyers = signal(false);
  protected readonly loaded = signal(false);

  protected readonly formatCurrency = formatCurrency;

  protected readonly farmerColumns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'common.sno',
      type: 'text',
      align: 'center',
      sortable: false,
      filterable: false,
      className: 'col-no',
    },
    {
      key: 'farmerName',
      header: 'farmer.name',
      type: 'text',
      className: 'col-name',
    },
    {
      key: 'outstandingBalance',
      header: 'ledger.list.col.outstanding.balance',
      type: 'number',
      className: 'col-outstanding',
    },
  ];

  protected readonly buyerColumns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'common.sno',
      type: 'text',
      align: 'center',
      sortable: false,
      filterable: false,
      className: 'col-no',
    },
    {
      key: 'buyerName',
      header: 'buyer.name',
      type: 'text',
      className: 'col-name',
    },
    {
      key: 'outstandingBalance',
      header: 'ledger.list.col.outstanding.balance',
      type: 'number',
      className: 'col-outstanding',
    },
  ];

  ngOnInit(): void {
    this.loadFarmers();
    this.loadBuyers();
  }

  protected farmerCount(): number {
    return this.farmers().length;
  }

  protected buyerCount(): number {
    return this.buyers().length;
  }

  protected farmerTotalOutstanding(): number {
    return this.farmers().reduce((sum, row) => sum + Math.abs(Number(row.outstandingBalance) || 0), 0);
  }

  protected buyerTotalOutstanding(): number {
    return this.buyers().reduce((sum, row) => sum + Math.abs(Number(row.outstandingBalance) || 0), 0);
  }

  protected isLoading(): boolean {
    return this.loadingFarmers() || this.loadingBuyers();
  }

  protected todayLabel(): string {
    return formatDate(new Date());
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
    const farmer = this.section() === 'farmer';
    if (value > 0) {
      return farmer ? 'credit' : 'debit';
    }
    if (value < 0) {
      return farmer ? 'debit' : 'credit';
    }
    return 'settled';
  }

  protected async printReport(format: ReceiptFormat): Promise<void> {
    const farmers = this.farmers();
    const buyers = this.buyers();
    const t = this.i18n.translate.bind(this.i18n);
    const esc = (value: string | null | undefined): string => this.escapeHtml(value);

    const farmerRows = farmers
      .map(
        (row, i) =>
          `<tr>` +
          `<td class="left">${i + 1}</td>` +
          `<td class="left">${esc(row.farmerName)}</td>` +
          `<td class="right">${formatCurrency(Math.abs(row.outstandingBalance))}</td>` +
          `</tr>`,
      )
      .join('');

    const buyerRows = buyers
      .map(
        (row, i) =>
          `<tr>` +
          `<td class="left">${i + 1}</td>` +
          `<td class="left">${esc(row.buyerName)}</td>` +
          `<td class="right">${formatCurrency(Math.abs(row.outstandingBalance))}</td>` +
          `</tr>`,
      )
      .join('');

    const farmerTotal = formatCurrency(this.farmerTotalOutstanding());
    const buyerTotal = formatCurrency(this.buyerTotalOutstanding());

    const content =
      `<div class="print-header">` +
      `<h2>${esc(t('inactive.list.print.title'))}</h2>` +
      `<p>${esc(t('inactive.list.date.label'))}: ${esc(this.todayLabel())}</p>` +
      `</div>` +
      `<div class="section-title">${esc(t('inactive.list.print.farmers'))} (${farmers.length})</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left sno">${esc(t('txn.sno'))}</th>` +
      `<th class="left">${esc(t('farmer.name'))}</th>` +
      `<th class="right" style="width:32%">${esc(t('ledger.list.col.outstanding.balance'))}</th>` +
      `</tr></thead><tbody>${farmerRows}</tbody></table>` +
      `<table class="summary-table">` +
      `<tr><td class="lbl">${esc(t('report.total'))}</td><td class="amt">${farmerTotal}</td></tr>` +
      `</table>` +
      `<div class="section-title">${esc(t('inactive.list.print.buyers'))} (${buyers.length})</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left sno">${esc(t('txn.sno'))}</th>` +
      `<th class="left">${esc(t('buyer.name'))}</th>` +
      `<th class="right" style="width:32%">${esc(t('ledger.list.col.outstanding.balance'))}</th>` +
      `</tr></thead><tbody>${buyerRows}</tbody></table>` +
      `<table class="summary-table">` +
      `<tr><td class="lbl">${esc(t('report.total'))}</td><td class="amt">${buyerTotal}</td></tr>` +
      `</table>`;

    const output = await this.receipt.output(content, {
      title: t('inactive.list.print.title'),
      fileBase: 'inactive-list',
      format,
    });
    if (output.status !== 'ok') {
      this.toast.error(output.message);
    }
  }

  private loadFarmers(): void {
    this.loadingFarmers.set(true);
    this.service.getInactiveFarmers().subscribe({
      next: (response) => {
        this.loadingFarmers.set(false);
        this.loaded.set(true);
        if (response.success) {
          this.farmers.set(response.data);
        } else {
          this.farmers.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loadingFarmers.set(false);
        this.loaded.set(true);
        this.farmers.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private loadBuyers(): void {
    this.loadingBuyers.set(true);
    this.service.getInactiveBuyers().subscribe({
      next: (response) => {
        this.loadingBuyers.set(false);
        this.loaded.set(true);
        if (response.success) {
          this.buyers.set(response.data);
        } else {
          this.buyers.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loadingBuyers.set(false);
        this.loaded.set(true);
        this.buyers.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private escapeHtml(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}