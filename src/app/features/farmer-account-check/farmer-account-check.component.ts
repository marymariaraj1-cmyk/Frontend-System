import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { ActiveLedgerRow } from '../../core/models/ledger';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FarmerAccountCheckService } from '../../core/services/farmer-account-check.service';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { openPrintWindow } from '../../core/utils/print.util';

type CalcModel = 'model1' | 'model2' | 'model3' | null;

interface ModelResult {
  model: CalcModel;
  label: string;
  lines: { label: string; value: number; desc: string; sign?: boolean }[];
  finalLabel: string;
  finalAmount: number;
  finalDesc: string;
}

@Component({
  selector: 'app-farmer-account-check',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './farmer-account-check.html',
  styleUrl: './farmer-account-check.css',
})
export class FarmerAccountCheckComponent {
  private readonly accountCheckService = inject(FarmerAccountCheckService);
  private readonly ledgerService = inject(FarmerLedgerService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

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

    this.ledgerService.getFarmerList().subscribe({
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
        lines: [
          { label: this.i18n.translate('fac.farmer.advance'), value: sumDebit, desc: this.i18n.translate('fac.desc.total.farmer.advance') },
          { label: this.i18n.translate('fac.total.sale'), value: sumCredit, desc: this.i18n.translate('fac.desc.total.credit.sale') },
          { label: this.i18n.translate('fac.actual.amount'), value: actual, desc: this.i18n.translate('fac.desc.total.sale.minus.advance'), sign: true },
          { label: this.i18n.translate('fac.interest.10'), value: interest, desc: this.i18n.translate('fac.desc.interest.10.100days'), sign: true },
        ],
        finalLabel: this.i18n.translate('fac.final.total'),
        finalAmount: finalAmt,
        finalDesc: this.i18n.translate('fac.desc.actual.plus.interest'),
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
          this.modelResult.set({
            model: 'model2',
            label: this.i18n.translate('fac.model.2.label'),
            lines: [
              { label: this.i18n.translate('fac.opening.debit'), value: openingDebit, desc: this.i18n.translate('fac.desc.closing.balance.of.active.entry'), sign: true },
              { label: this.i18n.translate('fac.interest.2'), value: interest, desc: this.i18n.translate('fac.desc.interest.2.opening.debit'), sign: true },
              { label: this.i18n.translate('fac.total.sale'), value: sumCredit, desc: this.i18n.translate('fac.desc.total.credit.sale') },
              { label: this.i18n.translate('fac.inward.income'), value: inwardIncome, desc: this.i18n.translate('fac.desc.total.sale.minus.interest') },
              { label: this.i18n.translate('fac.total.farmer.advance'), value: sumDebit, desc: '' },
            ],
            finalLabel: this.i18n.translate('fac.final.amount'),
            finalAmount: finalAmt,
            finalDesc: this.i18n.translate('fac.desc.inward.minus.advance'),
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
        lines: [
          { label: this.i18n.translate('fac.inward.income'), value: sumCredit, desc: this.i18n.translate('fac.desc.total.credit.sale') },
          { label: this.i18n.translate('fac.farmer.advance'), value: sumDebit, desc: this.i18n.translate('fac.desc.total.farmer.advance') },
        ],
        finalLabel: this.i18n.translate('fac.final.total'),
        finalAmount: finalAmt,
        finalDesc: this.i18n.translate('fac.desc.total.inward.minus.advance'),
      });
      this.selectedModel.set(model);
    }
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

  protected printReceipt(): void {
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
          `<td class="left">${this.escapeHtml(row.salesDate)}</td>` +
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
      const linesHtml = result.lines
        .map(
          (line) =>
            `<tr><td class="lbl">${this.escapeHtml(line.label)}</td><td class="amt">${this.formatNum(line.value)}</td><td class="desc">${this.escapeHtml(line.desc)}</td></tr>`,
        )
        .join('');
      calcHtml =
        `<div class="divider"></div>` +
        `<h3 style="font-size:9px;margin:4px 0;">${this.escapeHtml(result.label)}</h3>` +
        `<table class="summary-table">${linesHtml}` +
        `<tr class="final"><td class="lbl">${this.escapeHtml(result.finalLabel)}</td><td class="amt">${this.formatNum(result.finalAmount)}</td><td class="desc">${this.escapeHtml(result.finalDesc)}</td></tr>` +
        `</table>`;
    }

    const html =
      this.printStyle() +
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('fac.print.title'))}</h2>` +
      `<p>${this.escapeHtml(this.farmer())}</p>` +
      `</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left">#</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('ledger.report.col.sales.date'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.report.col.credit.amt'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.report.col.debit.amt'))}</th>` +
      `</tr></thead><tbody>${rowsHtml}${totalRow}</tbody></table>` +
      calcHtml +
      `<div class="footer">${this.escapeHtml(this.i18n.translate('print.thankyou'))}</div>` +
      `<script>window.onload=function(){window.print();}<\/script></body></html>`;

    openPrintWindow(html, 320, 600);
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

  private printStyle(): string {
    return (
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
      `@page{size:3in auto;margin:0;}` +
      `body{margin:0;padding:2mm 1.5mm;width:3in;box-sizing:border-box;font-family:"Courier New",monospace;font-size:9px;line-height:1.4;color:#000;background:#fff;}` +
      `.print-header{text-align:center;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px;}` +
      `.print-header h2{font-size:12px;margin:0 0 2px;font-weight:700;letter-spacing:0.5px;}` +
      `.print-header p{font-size:8px;margin:1px 0;color:#333;}` +
      `table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:8px;table-layout:fixed;}` +
      `th,td{padding:3px 2px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;}` +
      `th{border-bottom:1.5px solid #000;font-weight:700;font-size:7.5px;text-transform:uppercase;letter-spacing:0.3px;}` +
      `th.left,td.left{text-align:left;}` +
      `th.right,td.right{text-align:right;}` +
      `tbody tr{border-bottom:0.5px dotted #ccc;}` +
      `tbody tr:last-child{border-bottom:none;}` +
      `.total-row td{border-top:1px solid #000;padding-top:3px;}` +
      `.divider{border-top:1px dashed #000;margin:6px 0;}` +
      `.summary-table{width:100%;border-collapse:collapse;font-size:8px;margin:0 0 4px;}` +
      `.summary-table td{padding:2px 2px;border:none;}` +
      `.summary-table td.lbl{width:32%;text-align:left;}` +
      `.summary-table td.amt{width:22%;text-align:right;}` +
      `.summary-table td.desc{width:46%;text-align:left;font-size:7px;color:#555;}` +
      `.summary-table tr.final td{font-size:10px;font-weight:700;border-top:1px solid #000;padding-top:4px;}` +
      `.footer{text-align:center;margin-top:10px;font-size:7px;border-top:1px dashed #000;padding-top:5px;letter-spacing:0.5px;}` +
      `</style></head><body>`
    );
  }
}
