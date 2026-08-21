import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { SalesEditRowRequest, SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AuthService } from '../../core/services/auth.service';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { SalesEditService } from '../../core/services/sales-edit.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { printHtml } from '../../core/utils/print.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';

interface EditRow {
  salesId: number;
  flower: string;
  origFlower: string;
  weight: string;
  origWeight: string;
  rate: string;
  origRate: string;
  amount: string;
  origAmount: string;
  customer: string;
  enabled: boolean;
  edited: boolean;
  flowerInvalid: boolean;
}

@Component({
  selector: 'app-sales-details-edit',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './sales-details-edit.html',
  styleUrl: './sales-details-edit.css',
})
export class SalesDetailsEditComponent implements OnInit {
  private readonly salesEditService = inject(SalesEditService);
  private readonly farmerLedgerService = inject(FarmerLedgerService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly master = signal<SalesMasterData>({
    farmers: [],
    flowers: [],
    buyers: [],
  });
  protected readonly farmer = signal('');
  protected readonly farmerInvalid = signal(false);
  protected readonly salesDate = signal(formatApiDate(new Date()));
  protected readonly rows = signal<EditRow[]>([]);
  protected readonly debit = signal('0');
  protected readonly originalDebit = signal(0);
  protected readonly calcOpen = signal(true);
  protected readonly fetching = signal(false);
  protected readonly saving = signal(false);

  protected currentFarmer = '';
  protected currentDate = '';
  protected readonly noData = signal(false);

  protected readonly formatCurrency = formatCurrency;

  protected readonly debitEdited = computed(() => {
    const value = parseFloat(this.debit());
    const num = Number.isNaN(value) ? 0 : value;
    return num !== this.originalDebit();
  });

  protected readonly saveEnabled = computed(
    () => this.debitEdited() || this.rows().some((row) => row.enabled || row.edited),
  );

  protected readonly summary = computed(() => {
    let total = 0;
    for (const row of this.rows()) {
      const value = parseFloat(row.amount);
      if (!Number.isNaN(value)) {
        total += value;
      }
    }
    const totalRounded = roundOff(total);
    const commission = roundOff(total * 0.1);
    const net = totalRounded - commission;
    const debitValue = parseFloat(this.debit());
    const debitAmount = Number.isNaN(debitValue) ? 0 : debitValue;
    const finalTotal = net - debitAmount;
    return { total: totalRounded, commission, net, debit: debitAmount, final: finalTotal };
  });

  ngOnInit(): void {
    this.loadMasterData();
  }

  private loadMasterData(): void {
    this.salesEditService.getMasterData().subscribe({
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

  protected updateRow(index: number, patch: Partial<EditRow>): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected fetchData(): void {
    if (this.fetching()) {
      return;
    }
    const farmer = this.farmer().trim();
    const date = this.salesDate();

    if (!farmer) {
      this.toast.error(this.i18n.translate('sales.error.farmer.required'));
      this.farmerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(farmer, this.master().farmers)) {
      this.toast.error(this.i18n.translate('sales.error.farmer.notfound'));
      this.farmerInvalid.set(true);
      return;
    }
    if (!date) {
      this.toast.error(this.i18n.translate('sales.error.date.required'));
      return;
    }

    this.fetching.set(true);
    this.salesEditService.fetch(farmer, date).subscribe({
      next: (response) => {
        this.fetching.set(false);
        if (!response.success) {
          this.toast.error(response.message);
          return;
        }
        const data = response.data;
        this.rows.set(
          (data.rows ?? []).map((entry) => ({
            salesId: entry.salesId,
            flower: entry.flowerType ?? '',
            origFlower: entry.flowerType ?? '',
            weight: this.formatDecimal(entry.totalWeight),
            origWeight: this.formatDecimal(entry.totalWeight),
            rate: this.formatDecimal(entry.perKgRate),
            origRate: this.formatDecimal(entry.perKgRate),
            amount: this.formatDecimal(entry.price),
            origAmount: this.formatDecimal(entry.price),
            customer: entry.customerName ?? '',
            enabled: false,
            edited: false,
            flowerInvalid: false,
          })),
        );
        this.currentFarmer = farmer;
        this.currentDate = date;
        this.noData.set((data.rows ?? []).length === 0);
        const summary = data.summary;
        const originalDebit = summary && summary.debitAmt != null ? Number(summary.debitAmt) : 0;
        this.originalDebit.set(Number.isNaN(originalDebit) ? 0 : originalDebit);
        this.debit.set(String(this.originalDebit()));
        if ((data.rows ?? []).length === 0) {
          this.toast.error(this.i18n.translate('sales.edit.no.rows'));
        }
      },
      error: (error) => {
        this.fetching.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('sales.edit.error.fetch.failed')));
      },
    });
  }

  protected toggleRowEdit(index: number): void {
    const row = this.rows()[index];
    if (row.enabled) {
      this.disableRowEdit(index);
    } else {
      this.enableRowEdit(index);
    }
  }

  private enableRowEdit(index: number): void {
    this.updateRow(index, { enabled: true });
  }

  private disableRowEdit(index: number): void {
    const row = this.rows()[index];
    const edited =
      row.flower !== row.origFlower ||
      row.weight !== row.origWeight ||
      row.rate !== row.origRate ||
      row.amount !== row.origAmount;
    this.updateRow(index, { enabled: false, edited });
  }

  protected markEdited(index: number): void {
    const row = this.rows()[index];
    const edited =
      row.flower !== row.origFlower ||
      row.weight !== row.origWeight ||
      row.rate !== row.origRate ||
      row.amount !== row.origAmount;
    this.updateRow(index, { edited });
  }

  protected recalcRowAmount(index: number): void {
    const row = this.rows()[index];
    if (!row.enabled) {
      return;
    }
    if (row.weight.trim() !== '' && row.rate.trim() !== '') {
      const weight = parseFloat(row.weight);
      const rate = parseFloat(row.rate);
      if (!Number.isNaN(weight) && !Number.isNaN(rate)) {
        this.updateRow(index, { amount: String(roundOff(weight * rate)) });
      }
    }
    this.markEdited(index);
  }

  protected validateFlower(index: number): void {
    const row = this.rows()[index];
    const value = row.flower.trim();
    this.updateRow(index, {
      flowerInvalid: value !== '' && !this.matchesMaster(value, this.master().flowers),
    });
  }

  protected matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  private formatDecimal(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  protected clearForm(): void {
    this.farmer.set('');
    this.farmerInvalid.set(false);
    this.salesDate.set(formatApiDate(new Date()));
    this.rows.set([]);
    this.debit.set('0');
    this.originalDebit.set(0);
    this.currentFarmer = '';
    this.currentDate = '';
    this.noData.set(true);
  }

  protected printReport(): void {
    const farmer = this.farmer().trim();
    const date = this.salesDate();
    const rows = this.rows();
    if (!farmer || !date) {
      this.toast.error(this.i18n.translate('sales.error.enter.farmer.print'));
      return;
    }
    if (rows.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows.print'));
      return;
    }

    const shopName = this.auth.user()?.shopName ?? '';
    const summary = this.summary();
    const t = this.i18n.translate.bind(this.i18n);

    let rowsHtml = '';
    rows.forEach((row, i) => {
      rowsHtml +=
        '<tr>' +
        '<td class="left">' + (i + 1) + '</td>' +
        '<td class="left">' + (row.flower || '-') + '</td>' +
        '<td class="right">' + (row.weight || '-') + '</td>' +
        '<td class="right">' + (row.rate || '-') + '</td>' +
        '<td class="right">' + (row.amount || '-') + '</td>' +
        '<td class="left">' + (row.customer || '-') + '</td>' +
        '</tr>';
    });

    const reportHtml =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + t('print.receipt.title') + '</title>' +
      '<style>' +
      '@page{size:80mm auto;margin:3mm 2mm;}' +
      'body{margin:0;padding:2mm 1mm;width:76mm;font-family:"Courier New",monospace;font-size:9px;line-height:1.4;color:#000;background:#fff;}' +
      '.print-header{text-align:center;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px;}' +
      '.print-header h2{font-size:13px;margin:0 0 2px;font-weight:700;letter-spacing:0.5px;}' +
      '.print-header p{font-size:8px;margin:1px 0;color:#333;}' +
      '.print-info{margin-bottom:6px;font-size:8px;line-height:1.5;}' +
      '.print-info span{display:block;}' +
      '.print-info strong{font-size:8px;}' +
      'table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:8.5px;table-layout:fixed;}' +
      'th,td{padding:3px 2.5px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;}' +
      'th{border-bottom:1.5px solid #000;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:0.3px;}' +
      'th.left,td.left{text-align:left;}' +
      'th.right,td.right{text-align:right;}' +
      'tbody tr{border-bottom:0.5px dotted #ccc;}' +
      'tbody tr:last-child{border-bottom:none;}' +
      '.divider{border-top:1px dashed #000;margin:6px 0;}' +
      '.summary{margin:0 0 4px;}' +
      '.summary p{display:flex;justify-content:flex-end;gap:8px;margin:2px 0;font-size:8px;line-height:1.4;}' +
      '.summary p strong{min-width:40px;text-align:right;}' +
      '.summary .final{font-size:10px;font-weight:700;border-top:1px solid #000;padding-top:4px;margin-top:4px;gap:10px;}' +
      '.summary .final strong{min-width:45px;}' +
      '.footer{text-align:center;margin-top:10px;font-size:7px;border-top:1px dashed #000;padding-top:5px;letter-spacing:0.5px;}' +
      '</style></head><body>' +
      '<div class="print-header">' +
      '<h2>' + shopName + '</h2>' +
      '</div>' +
      '<div class="print-info">' +
      '<span><strong>' + t('report.farmer') + '</strong> ' + farmer + '</span>' +
      '<span><strong>' + t('report.date') + '</strong> ' + date + '</span>' +
      '</div>' +
      '<table>' +
      '<colgroup>' +
      '<col style="width:8%"><col style="width:25%"><col style="width:15%"><col style="width:15%"><col style="width:20%"><col style="width:17%">' +
      '</colgroup>' +
      '<thead><tr>' +
      '<th class="left">#</th>' +
      '<th class="left">' + t('report.col.flower.type') + '</th>' +
      '<th class="right">' + t('report.col.weight') + '</th>' +
      '<th class="right">' + t('report.col.price') + '</th>' +
      '<th class="right">' + t('report.col.total') + '</th>' +
      '<th class="left">' + t('report.col.customer') + '</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '<div class="divider"></div>' +
      '<div class="summary">' +
      '<p><span>' + t('report.total') + '</span><strong>' + this.formatCurrency(summary.total) + '</strong></p>' +
      '<p><span>' + t('report.commission') + '</span><strong>' + this.formatCurrency(summary.commission) + '</strong></p>' +
      '<p><span>' + t('report.net.amount') + '</span><strong>' + this.formatCurrency(summary.net) + '</strong></p>' +
      '<p><span>' + t('report.debit') + '</span><strong>' + this.formatCurrency(summary.debit) + '</strong></p>' +
      '<p class="final"><span>' + t('report.final.total') + '</span><strong>' + this.formatCurrency(summary.final) + '</strong></p>' +
      '</div>' +
      '<div class="footer">' + t('print.thankyou') + '</div>' +
      '</body></html>';

    if (!printHtml(reportHtml)) {
      this.toast.error(this.i18n.translate('sales.error.print.blocked'));
    }
  }

  protected save(): void {
    if (this.saving() || !this.saveEnabled()) {
      return;
    }
    const farmer = this.farmer().trim();
    const date = this.salesDate();

    if (!farmer) {
      this.toast.error(this.i18n.translate('sales.error.farmer.required'));
      return;
    }
    if (!this.matchesMaster(farmer, this.master().farmers)) {
      this.toast.error(this.i18n.translate('sales.error.farmer.notfound'));
      return;
    }
    if (!date) {
      this.toast.error(this.i18n.translate('sales.error.date.required'));
      return;
    }
    if (!this.currentFarmer || this.currentFarmer !== farmer || !this.currentDate || this.currentDate !== date) {
      this.toast.error(this.i18n.translate('sales.edit.error.fetch.first'));
      return;
    }

    const editedRows: SalesEditRowRequest[] = [];
    for (let i = 0; i < this.rows().length; i++) {
      const row = this.rows()[i];
      const flower = row.flower.trim();
      const weight = row.weight.trim();
      const rate = row.rate.trim();
      const amount = row.amount.trim();

      if (row.enabled) {
        if (!flower) {
          this.toast.error(this.i18n.translate('sales.error.flower.required.row', i + 1));
          return;
        }
        if (!this.matchesMaster(flower, this.master().flowers)) {
          this.toast.error(this.i18n.translate('sales.error.flower.notfound.row', i + 1));
          this.updateRow(i, { flowerInvalid: true });
          return;
        }
      } else if (!this.matchesMaster(flower, this.master().flowers)) {
        this.toast.error(this.i18n.translate('sales.error.flower.notfound.row', i + 1));
        return;
      }
      if (weight !== '' && !isDecimal(weight)) {
        this.toast.error(this.i18n.translate('sales.error.weight.row', i + 1));
        return;
      }
      if (rate !== '' && !isDecimal(rate)) {
        this.toast.error(this.i18n.translate('sales.error.price.row', i + 1));
        return;
      }
      if (!amount) {
        this.toast.error(this.i18n.translate('sales.error.amount.row', i + 1));
        return;
      }
      if (!isDecimal(amount)) {
        this.toast.error(this.i18n.translate('sales.error.amount.row', i + 1));
        return;
      }
      if (parseFloat(amount) <= 0) {
        this.toast.error(this.i18n.translate('sales.error.amount.positive.row', i + 1));
        return;
      }

      editedRows.push({ salesId: row.salesId, flowerType: flower, totalWeight: weight, price: rate, amount });
    }

    const debitValue = this.debit().trim();
    if (this.debitEdited() && debitValue !== '' && !isDecimal(debitValue)) {
      this.toast.error(this.i18n.translate('sales.edit.error.debit.invalid'));
      return;
    }
    if (editedRows.length === 0 && !this.debitEdited()) {
      this.toast.error(this.i18n.translate('sales.edit.error.no.edits'));
      return;
    }

    this.saving.set(true);
    this.farmerLedgerService.getFarmerList().subscribe({
      next: (ledgerResponse) => {
        let ledgerActive = 'Y';
        let updatePreviousYRecords = false;
        if (ledgerResponse.success && ledgerResponse.data) {
          const farmerEntry = ledgerResponse.data.find(
            (e) => e.farmerName.toLowerCase() === farmer.toLowerCase(),
          );
          if (farmerEntry) {
            const newClosingBalance = (farmerEntry.outstandingBalance ?? 0) + this.summary().final;
            if (newClosingBalance === 0) {
              ledgerActive = 'N';
              updatePreviousYRecords = true;
            }
          }
        }
        this.salesEditService
          .save({
            farmerName: farmer,
            salesDate: date,
            debitEdited: this.debitEdited(),
            debitAmount: debitValue,
            rows: editedRows,
            ledgerActive,
            updatePreviousYRecords,
          })
          .subscribe({
            next: (response) => {
              this.saving.set(false);
              if (response.success) {
                this.toast.success(response.message);
                this.fetchData();
              } else {
                this.toast.error(response.message);
              }
            },
            error: (error) => {
              this.saving.set(false);
              this.toast.error(extractErrorMessage(error, this.i18n.translate('sales.edit.error.save.failed')));
            },
          });
      },
      error: () => {
        this.salesEditService
          .save({
            farmerName: farmer,
            salesDate: date,
            debitEdited: this.debitEdited(),
            debitAmount: debitValue,
            rows: editedRows,
          })
          .subscribe({
            next: (response) => {
              this.saving.set(false);
              if (response.success) {
                this.toast.success(response.message);
                this.fetchData();
              } else {
                this.toast.error(response.message);
              }
            },
            error: (error) => {
              this.saving.set(false);
              this.toast.error(extractErrorMessage(error, this.i18n.translate('sales.edit.error.save.failed')));
            },
          });
      },
    });
  }
}
