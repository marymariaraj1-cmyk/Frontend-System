import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { ReceiptPrintButtonsComponent } from '../../core/components/receipt-print-buttons/receipt-print-buttons.component';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { ActiveLedgerRow } from '../../core/models/ledger';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { DateFormatPipe } from '../../core/pipes/date-format.pipe';
import { FarmerAccountCheckService } from '../../core/services/farmer-account-check.service';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { FarmerService } from '../../core/services/farmer.service';
import { I18nService } from '../../core/services/i18n.service';
import { ReceiptFormat, ReceiptService } from '../../core/services/receipt.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { formatDate } from '../../core/utils/date.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

type CalcModel = 'model1' | 'model2' | 'model3' | null;

type PanelBadge = 'debit' | 'credit' | null;

type PanelRow =
  | { type: 'line'; label: string; amount: number; badge: PanelBadge; note?: string; final: boolean; absolute: boolean }
  | { type: 'divider' };

interface ModelResult {
  model: CalcModel;
  label: string;
  rows: PanelRow[];
  finalAmount: number;
}

@Component({
  selector: 'app-farmer-account-check',
  standalone: true,
  imports: [FormsModule, I18nPipe, DateFormatPipe, AutocompleteComponent, ReceiptPrintButtonsComponent, DataTableComponent],
  templateUrl: './farmer-account-check.html',
  styleUrl: './farmer-account-check.css',
})
export class FarmerAccountCheckComponent {
  private readonly accountCheckService = inject(FarmerAccountCheckService);
  private readonly ledgerService = inject(FarmerLedgerService);
  private readonly farmerService = inject(FarmerService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly receipt = inject(ReceiptService);

  protected readonly formatCurrency = formatCurrency;

  protected absAmount(value: number): number {
    return Math.abs(value);
  }

  protected readonly farmerNames = signal<string[]>([]);
  protected readonly farmer = signal('');
  protected readonly farmerInvalid = signal(false);
  protected readonly farmerId = signal('');

  protected readonly loading = signal(false);
  protected readonly activeRows = signal<ActiveLedgerRow[]>([]);
  protected readonly loaded = signal(false);

  protected readonly activeColumns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'txn.sno',
      type: 'text',
      align: 'left',
      className: 'left',
      width: '50px',
      sortable: false,
      filterable: false,
    },
    {
      key: 'salesDate',
      header: 'ledger.report.col.sales.date',
      type: 'date',
      align: 'left',
      className: 'left',
      width: '140px',
      sortable: false,
      filterable: false,
    },
    {
      key: 'creditAmt',
      header: 'fac.col.credit.or.sale',
      type: 'currency',
      align: 'right',
      className: 'amount-col',
      sortable: false,
      filterable: false,
    },
    {
      key: 'debitAmt',
      header: 'fac.col.debit.or.advance',
      type: 'currency',
      align: 'right',
      className: 'amount-col',
      sortable: false,
      filterable: false,
    },
  ];

  protected readonly selectedModel = signal<CalcModel>(null);
  protected readonly modelResult = signal<ModelResult | null>(null);

  protected readonly updating = signal(false);

  constructor() {
    this.loadFarmerNames();
    effect(() => {
      const lang = this.i18n.lang();
      const model = this.selectedModel();
      if (model && this.activeRows().length > 0) {
        this.calculate(model);
      }
    });
  }

  private loadFarmerNames(): void {
    this.ledgerService.getFarmerNames().subscribe({
      next: (response) => {
        if (response.success) {
          this.farmerNames.set(response.data);
        }
      },
      error: () => {},
    });
  }

  protected validateFarmer(): void {
    const value = this.farmer().trim();
    if (value === '') {
      this.farmerInvalid.set(false);
      this.farmerId.set('');
      return;
    }
    const match = this.farmerNames().some((n) => n.toLowerCase() === value.toLowerCase());
    this.farmerInvalid.set(!match);
  }

  protected onFarmerSelected(name: string): void {
    this.farmer.set(name);
    this.farmerInvalid.set(false);
    this.farmerId.set('');
    this.activeRows.set([]);
    this.loaded.set(false);
    this.selectedModel.set(null);
    this.modelResult.set(null);
  }

  protected viewActiveLedger(): void {
    const farmerName = this.farmer().trim();
    if (!farmerName) {
      this.toast.error(this.i18n.translate('fac.error.farmer.required'));
      this.farmerInvalid.set(true);
      return;
    }
    if (this.farmerInvalid()) {
      this.toast.error(this.i18n.translate('txn.error.farmer.notfound'));
      return;
    }

    this.loading.set(true);
    this.selectedModel.set(null);
    this.modelResult.set(null);

    // Resolve the ID from Farmer Master (not the ledger list) so a farmer who exists but has no
    // sales/ledger rows is reported as "no sales" rather than "not found in master".
    this.farmerService.getFarmers().subscribe({
      next: (listResponse) => {
        if (!listResponse.success) {
          this.loading.set(false);
          this.toast.error(listResponse.message);
          return;
        }
        const match = listResponse.data.find(
          (e) => e.farmerName.toLowerCase() === farmerName.toLowerCase(),
        );
        if (!match) {
          this.loading.set(false);
          this.toast.error(this.i18n.translate('txn.error.farmer.notfound'));
          return;
        }
        this.farmerId.set(match.farmerId);

        this.accountCheckService.getActiveLedgerRows(match.farmerId).subscribe({
          next: (response) => {
            this.loading.set(false);
            this.loaded.set(true);
            if (response.success) {
              this.activeRows.set(response.data);
              if (response.data.length === 0) {
                this.toast.error(this.i18n.translate('fac.no.active.rows'));
              }
            } else {
              this.activeRows.set([]);
              this.toast.error(response.message);
            }
          },
          error: (error) => {
            this.loading.set(false);
            this.loaded.set(true);
            this.activeRows.set([]);
            this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
          },
        });
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected totalCredit(): number {
    return this.activeRows().reduce((s, r) => s + (Number(r.creditAmt) || 0), 0);
  }

  protected totalDebit(): number {
    return this.activeRows().reduce((s, r) => s + (Number(r.debitAmt) || 0), 0);
  }

  protected netTotal(): number {
    return this.totalCredit() - this.totalDebit();
  }

  protected hasDebitEntries(): boolean {
    return this.activeRows().some((r) => (Number(r.debitAmt) || 0) > 0);
  }

  protected calculate(model: CalcModel): void {
    const rows = this.activeRows();
    if (rows.length === 0) {
      return;
    }

    const sumCredit = rows.reduce((s, r) => s + (Number(r.creditAmt) || 0), 0);
    const sumDebit = rows.reduce((s, r) => s + (Number(r.debitAmt) || 0), 0);

    if (model === 'model1') {
      if (!this.hasDebitEntries()) {
        this.toast.error(this.i18n.translate('fac.no.debit.found'));
        return;
      }
      const actual = sumCredit - sumDebit;
      const interest = Math.round(actual * 0.1);
      const finalAmt = actual + interest;
      this.modelResult.set({
        model: 'model1',
        label: this.i18n.translate('fac.model.1.label'),
        rows: [
          this.line('fac.panel.flower.credit.sale', sumCredit),
          this.line('fac.panel.debit.farmer.advance', sumDebit),
          { type: 'divider' },
          this.outstandingLine(actual),
          this.line('fac.panel.overdraft', interest, undefined, true),
          { type: 'divider' },
          this.totalLine(finalAmt),
          { type: 'divider' },
        ],
        finalAmount: finalAmt,
      });
      this.selectedModel.set(model);
    } else if (model === 'model2') {
      const farmerId = this.farmerId();
      if (!farmerId) {
        return;
      }
      this.loading.set(true);
      this.accountCheckService.getClosingBalance(farmerId).subscribe({
        next: (response) => {
          this.loading.set(false);
          if (!response.success || response.data.closingBalance === null || response.data.closingBalance === undefined) {
            this.toast.error(this.i18n.translate('fac.no.opening.debit'));
            return;
          }
          const openingDebit = Number(response.data.closingBalance);
          if (openingDebit === 0) {
            this.toast.error(this.i18n.translate('fac.no.opening.debit'));
            return;
          }
          const interest = Math.round(openingDebit * 0.02);
          const inwardIncome = sumCredit - Math.abs(interest);
          const finalAmt = inwardIncome - sumDebit;
          const note = this.i18n.translate('fac.panel.interest.note', this.formatNumber(Math.abs(openingDebit)));
          this.modelResult.set({
            model: 'model2',
            label: this.i18n.translate('fac.model.2.label'),
            rows: [
              this.line('fac.panel.flower.credit.sale', sumCredit),
              this.line('fac.panel.interest', interest, note, true),
              { type: 'divider' },
              this.line('fac.panel.balance', inwardIncome),
              this.line('fac.panel.debit.farmer.advance', sumDebit),
              { type: 'divider' },
              this.totalLine(finalAmt),
            ],
            finalAmount: finalAmt,
          });
          this.selectedModel.set(model);
        },
        error: () => {
          this.loading.set(false);
          this.toast.error(this.i18n.translate('fac.no.opening.debit'));
        },
      });
    } else if (model === 'model3') {
      const finalAmt = sumCredit - sumDebit;
      this.modelResult.set({
        model: 'model3',
        label: this.i18n.translate('fac.model.3.label'),
        rows: [
          this.line('fac.panel.flower.credit.sale', sumCredit),
          this.line('fac.panel.debit.farmer.advance', sumDebit),
          { type: 'divider' },
          this.totalLine(finalAmt),
          { type: 'divider' },
        ],
        finalAmount: finalAmt,
      });
      this.selectedModel.set(model);
    }
  }

  private line(labelKey: string, amount: number, note?: string, absolute = false): PanelRow {
    return { type: 'line', label: this.i18n.translate(labelKey), amount, badge: null, note, final: false, absolute };
  }

  private outstandingLine(value: number): PanelRow {
    return {
      type: 'line',
      label: this.i18n.translate(this.outstandingKey(value)),
      amount: value,
      badge: this.badgeFor(value),
      final: false,
      absolute: true,
    };
  }

  private totalLine(value: number): PanelRow {
    return {
      type: 'line',
      label: this.i18n.translate(this.totalOutstandingKey(value), formatDate(new Date())),
      amount: value,
      badge: this.badgeFor(value),
      final: true,
      absolute: true,
    };
  }

  private badgeFor(value: number): PanelBadge {
    if (value > 0) {
      return 'credit';
    }
    if (value < 0) {
      return 'debit';
    }
    return null;
  }

  private labelSide(value: number): 'debit' | 'credit' {
    return value > 0 ? 'credit' : 'debit';
  }

  private outstandingKey(value: number): string {
    return this.labelSide(value) === 'debit' ? 'fac.panel.outstanding.debit' : 'fac.panel.outstanding.credit';
  }

  private totalOutstandingKey(value: number): string {
    return this.labelSide(value) === 'debit'
      ? 'fac.panel.total.outstanding.debit'
      : 'fac.panel.total.outstanding.credit';
  }

  private formatNumber(value: number | null | undefined): string {
    return formatCurrency(value).replace('₹ ', '');
  }

  protected updateLedger(): void {
    const result = this.modelResult();
    if (!result) {
      return;
    }
    const farmerName = this.farmer().trim();
    const farmerId = this.farmerId();
    if (!farmerId) {
      return;
    }

    const amount = this.formatCurrency(Math.abs(result.finalAmount));
    const kind = this.i18n.translate(result.finalAmount < 0 ? 'fac.debit' : 'fac.credit');

    const confirmed = confirm(this.i18n.translate('fac.confirm.update', amount, kind));
    if (!confirmed) {
      return;
    }

    this.commitWrite(farmerId, farmerName, result.finalAmount);
  }

  private commitWrite(farmerId: string, farmerName: string, finalAmount: number): void {
    this.accountCheckService.commit(farmerId, farmerName, finalAmount).subscribe({
      next: (response) => {
        this.updating.set(false);
        if (response.success) {
          this.toast.success(response.message);
          this.viewActiveLedger();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.updating.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.save.failed')));
      },
    });
  }

  protected async printReceipt(format: ReceiptFormat): Promise<void> {
    const rows = this.activeRows();
    const result = this.modelResult();
    if (rows.length === 0) {
      this.toast.error(this.i18n.translate('msg.no.records'));
      return;
    }

    const rowsHtml = rows
      .map(
        (row, i) =>
          `<tr>` +
          `<td class="left">${i + 1}</td>` +
          `<td class="left">${this.escapeHtml(formatDate(row.salesDate))}</td>` +
          `<td class="right">${this.formatNum(row.creditAmt)}</td>` +
          `<td class="right">${this.formatNum(row.debitAmt)}</td>` +
          `</tr>`,
      )
      .join('');

    const totalRow =
      `<tr class="total-row">` +
      `<td class="left"></td>` +
      `<td class="left"><strong>${this.escapeHtml(this.i18n.translate('fac.total'))}</strong></td>` +
      `<td class="right"><strong>${this.formatNum(this.totalCredit())}</strong></td>` +
      `<td class="right"><strong>${this.formatNum(this.totalDebit())}</strong></td>` +
      `</tr>`;

    let calcHtml = '';
    if (result) {
      let pendingDivider = false;
      const panelRows = result.rows
        .map((row) => {
          if (row.type === 'divider') {
            pendingDivider = true;
            return '';
          }
          const noteHtml = row.note
            ? ` <span style="font-size:7px;color:#555;">${this.escapeHtml(row.note)}</span>`
            : '';
          const badgeHtml = row.badge
            ? `<span style="border:1px solid #000;border-radius:6px;padding:0 3px;font-size:7px;">${this.escapeHtml(
                this.i18n.translate(row.badge === 'debit' ? 'fac.debit' : 'fac.credit'),
              )}</span>&nbsp;`
            : '';
          const amount = this.formatNum(row.absolute ? Math.abs(row.amount) : row.amount);
          const divStyle = pendingDivider && !row.final ? ' style="border-top:1px solid #000;"' : '';
          pendingDivider = false;
          return (
            `<tr${row.final ? ' class="final"' : ''}${divStyle}>` +
            `<td class="lbl">${this.escapeHtml(row.label)}${noteHtml}</td>` +
            `<td class="amt">${badgeHtml}${amount}</td>` +
            `</tr>`
          );
        })
        .join('');
      calcHtml =
        `<div class="divider"></div>` +
        `<h3 style="font-size:9px;margin:4px 0;">${this.escapeHtml(result.label)}</h3>` +
        `<table class="summary-table">${panelRows}</table>`;
    }

    const content =
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('fac.print.title'))}</h2>` +
      `<p>${this.escapeHtml(this.farmer())}</p>` +
      `</div>` +
      `<table>` +
      `<colgroup><col style="width:26px;"><col style="width:78px;"><col><col></colgroup>` +
      `<thead><tr>` +
      `<th class="left">#</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('ledger.report.col.sales.date'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.report.col.credit.amt'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.report.col.debit.amt'))}</th>` +
      `</tr></thead><tbody>${rowsHtml}${totalRow}</tbody></table>` +
      calcHtml;

    const output = await this.receipt.output(content, {
      title: this.i18n.translate('fac.print.title'),
      fileBase: 'farmer-account-check',
      format,
    });
    if (output.status !== 'ok') {
      this.toast.error(output.message);
    }
  }

  private formatNum(value: number | null | undefined): string {
    return formatCurrency(value);
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
