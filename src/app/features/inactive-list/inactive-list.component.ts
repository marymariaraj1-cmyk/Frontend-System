import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InactiveBuyerRow, InactiveFarmerRow } from '../../core/models/inactive-list';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { InactiveListService } from '../../core/services/inactive-list.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { openPrintWindow } from '../../core/utils/print.util';

type SectionType = 'farmer' | 'buyer';

@Component({
  selector: 'app-inactive-list',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './inactive-list.html',
  styleUrl: './inactive-list.css',
})
export class InactiveListComponent implements OnInit {
  private readonly service = inject(InactiveListService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly section = signal<SectionType>('farmer');
  protected readonly farmers = signal<InactiveFarmerRow[]>([]);
  protected readonly buyers = signal<InactiveBuyerRow[]>([]);
  protected readonly loadingFarmers = signal(false);
  protected readonly loadingBuyers = signal(false);
  protected readonly loaded = signal(false);
  protected readonly farmerSearch = signal('');
  protected readonly buyerSearch = signal('');

  protected readonly formatCurrency = formatCurrency;

  protected readonly filteredFarmers = computed(() => {
    const term = this.farmerSearch().trim().toLowerCase();
    if (!term) {
      return this.farmers();
    }
    return this.farmers().filter((row) => (row.farmerName ?? '').toLowerCase().includes(term));
  });

  protected readonly filteredBuyers = computed(() => {
    const term = this.buyerSearch().trim().toLowerCase();
    if (!term) {
      return this.buyers();
    }
    return this.buyers().filter((row) => (row.buyerName ?? '').toLowerCase().includes(term));
  });

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
    const parts = new Date().toLocaleDateString('en-CA').split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
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

  protected print(): void {
    const farmers = this.farmers();
    const buyers = this.buyers();

    const farmerRows = farmers
      .map(
        (row, i) =>
          `<tr>` +
          `<td class="left">${i + 1}</td>` +
          `<td class="left">${this.escapeHtml(row.farmerName)}</td>` +
          `<td class="right">${formatCurrency(Math.abs(row.outstandingBalance))}</td>` +
          `</tr>`,
      )
      .join('');

    const buyerRows = buyers
      .map(
        (row, i) =>
          `<tr>` +
          `<td class="left">${i + 1}</td>` +
          `<td class="left">${this.escapeHtml(row.buyerName)}</td>` +
          `<td class="right">${formatCurrency(Math.abs(row.outstandingBalance))}</td>` +
          `</tr>`,
      )
      .join('');

    const farmerTotal = formatCurrency(this.farmerTotalOutstanding());
    const buyerTotal = formatCurrency(this.buyerTotalOutstanding());

    const html =
      this.printStyle() +
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('inactive.list.print.title'))}</h2>` +
      `<p>${this.escapeHtml(this.i18n.translate('inactive.list.date.label'))}: ${this.escapeHtml(this.todayLabel())}</p>` +
      `</div>` +
      `<div class="section-title">${this.escapeHtml(this.i18n.translate('inactive.list.print.farmers'))} (${farmers.length})</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left" style="width:10%">${this.escapeHtml(this.i18n.translate('txn.sno'))}</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('farmer.name'))}</th>` +
      `<th class="right" style="width:35%">${this.escapeHtml(this.i18n.translate('ledger.list.col.outstanding.balance'))}</th>` +
      `</tr></thead><tbody>${farmerRows}</tbody></table>` +
      `<table class="summary-table">` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('report.total'))}</td><td class="amt">${farmerTotal}</td></tr>` +
      `</table>` +
      `<div class="page-break"></div>` +
      `<div class="section-title">${this.escapeHtml(this.i18n.translate('inactive.list.print.buyers'))} (${buyers.length})</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left" style="width:10%">${this.escapeHtml(this.i18n.translate('txn.sno'))}</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('buyer.name'))}</th>` +
      `<th class="right" style="width:35%">${this.escapeHtml(this.i18n.translate('ledger.list.col.outstanding.balance'))}</th>` +
      `</tr></thead><tbody>${buyerRows}</tbody></table>` +
      `<table class="summary-table">` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('report.total'))}</td><td class="amt">${buyerTotal}</td></tr>` +
      `</table>` +
      `<div class="footer">${this.escapeHtml(this.i18n.translate('print.thankyou'))}</div>`;

    openPrintWindow(html, 900, 700);
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

  private printStyle(): string {
    return (
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
      `@page{size:A4;margin:8mm;}` +
      `body{margin:0;font-family:"Courier New",monospace;font-size:11px;line-height:1.5;color:#000;background:#fff;}` +
      `.print-header{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px;}` +
      `.print-header h2{font-size:16px;margin:0 0 3px;font-weight:700;letter-spacing:0.5px;}` +
      `.print-header p{font-size:11px;margin:1px 0;color:#333;}` +
      `.section-title{font-size:12px;font-weight:700;margin:10px 0 4px;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid #000;padding-bottom:2px;}` +
      `table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:10px;}` +
      `th,td{padding:4px 4px;vertical-align:top;}` +
      `th{border-bottom:1.5px solid #000;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;}` +
      `th.left,td.left{text-align:left;}` +
      `th.right,td.right{text-align:right;}` +
      `tbody tr{border-bottom:0.5px dotted #aaa;}` +
      `tbody tr:last-child{border-bottom:none;}` +
      `.summary-table{width:100%;border-collapse:collapse;font-size:10px;margin:0 0 8px;}` +
      `.summary-table td{padding:3px 4px;border:none;}` +
      `.summary-table td.lbl{text-align:right;font-weight:700;}` +
      `.summary-table td.amt{width:35%;text-align:right;font-weight:700;border-top:1.5px solid #000;}` +
      `.page-break{page-break-before:always;}` +
      `.footer{text-align:center;font-size:10px;margin-top:12px;}` +
      `</style></head><body>`
    );
  }
}