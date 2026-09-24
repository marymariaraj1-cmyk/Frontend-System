import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { ReceiptPrintButtonsComponent } from '../../core/components/receipt-print-buttons/receipt-print-buttons.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { BagCountConfigRow } from '../../core/models/bag-count-config';
import { SalesEditRowRequest, SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BagCountConfigService } from '../../core/services/bag-count-config.service';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { ReceiptFormat, ReceiptService } from '../../core/services/receipt.service';
import { SalesEditService } from '../../core/services/sales-edit.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';

interface EditRow {
  salesId: number;
  flower: string;
  origFlower: string;
  bag: string;
  origBag: string;
  weight: string;
  origWeight: string;
  rate: string;
  origRate: string;
  amount: string;
  origAmount: string;
  customer: string;
  origCustomer: string;
  enabled: boolean;
  edited: boolean;
  flowerInvalid: boolean;
}

@Component({
  selector: 'app-sales-details-edit',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent, DraggableDirective, ReceiptPrintButtonsComponent],
  templateUrl: './sales-details-edit.html',
  styleUrl: './sales-details-edit.css',
})
export class SalesDetailsEditComponent implements OnInit {
  private readonly salesEditService = inject(SalesEditService);
  private readonly farmerLedgerService = inject(FarmerLedgerService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly bagCountConfigService = inject(BagCountConfigService);
  private readonly receipt = inject(ReceiptService);

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
  protected readonly bagLimitsOpen = signal(false);
  protected readonly bagConfigs = signal<BagCountConfigRow[]>([]);
  protected readonly deleting = signal(false);
  protected readonly deleteTarget = signal<EditRow | null>(null);

  protected currentFarmer = '';
  protected currentDate = '';
  protected readonly noData = signal(false);

  protected readonly formatCurrency = formatCurrency;

  protected readonly bagLimits = computed(() => {
    const farmer = this.farmer().trim();
    if (!farmer) return [];
    const date = this.salesDate();
    if (!date) return [];
    const lower = farmer.toLowerCase();
    return this.bagConfigs()
      .filter((c) => c.salesDate === date && c.farmerName.trim().toLowerCase() === lower)
      .sort((a, b) => a.flowerName.localeCompare(b.flowerName));
  });

  protected readonly bagLimitNotice = computed(() => this.bagLimits().length > 0);

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
    this.loadBagConfigs();
  }

  private loadBagConfigs(): void {
    this.bagCountConfigService.getConfigs().subscribe({
      next: (response) => {
        if (response.success) {
          this.bagConfigs.set(response.data ?? []);
        }
      },
      error: () => this.bagConfigs.set([]),
    });
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
            bag: entry.bagCount != null ? String(entry.bagCount) : '',
            origBag: entry.bagCount != null ? String(entry.bagCount) : '',
            weight: this.formatDecimal(entry.totalWeight),
            origWeight: this.formatDecimal(entry.totalWeight),
            rate: this.formatDecimal(entry.perKgRate),
            origRate: this.formatDecimal(entry.perKgRate),
            amount: this.formatDecimal(entry.price),
            origAmount: this.formatDecimal(entry.price),
            customer: entry.customerName ?? '',
            origCustomer: entry.customerName ?? '',
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
      row.bag !== row.origBag ||
      row.weight !== row.origWeight ||
      row.rate !== row.origRate ||
      row.amount !== row.origAmount ||
      row.customer.trim() !== row.origCustomer.trim();
    this.updateRow(index, { enabled: false, edited });
  }

  protected markEdited(index: number): void {
    const row = this.rows()[index];
    const edited =
      row.flower !== row.origFlower ||
      row.bag !== row.origBag ||
      row.weight !== row.origWeight ||
      row.rate !== row.origRate ||
      row.amount !== row.origAmount ||
      row.customer.trim() !== row.origCustomer.trim();
    this.updateRow(index, { edited });
  }

  protected onDecimalKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = event.key;
    if (
      key.length !== 1 ||
      key === 'Backspace' ||
      key === 'Delete' ||
      key === 'Tab' ||
      key === 'Enter' ||
      key === 'Escape' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Home' ||
      key === 'End'
    ) {
      return;
    }
    if (key === '.') {
      if ((event.target as HTMLInputElement).value.includes('.')) {
        event.preventDefault();
      }
      return;
    }
    if (!/[0-9]/.test(key)) {
      event.preventDefault();
    }
  }

  protected sanitizeDecimal(value: string): string {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot === -1) {
      return cleaned;
    }
    return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }

  protected onBagInput(index: number): void {
    const row = this.rows()[index];
    const cleaned = row.bag.replace(/[^0-9]/g, '');
    this.updateRow(index, { bag: cleaned });
    this.markEdited(index);
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

  protected recalcRowRate(index: number): void {
    const row = this.rows()[index];
    if (!row.enabled) {
      return;
    }
    if (row.weight.trim() !== '' && row.amount.trim() !== '') {
      const weight = parseFloat(row.weight);
      const amount = parseFloat(row.amount);
      if (!Number.isNaN(weight) && !Number.isNaN(amount) && weight !== 0) {
        this.updateRow(index, { rate: String(roundOff(amount / weight)) });
      }
    }
    this.markEdited(index);
  }

  protected onQtyChange(index: number): void {
    const row = this.rows()[index];
    if (!row.enabled || row.weight.trim() === '') {
      return;
    }
    if (row.rate.trim() !== '') {
      this.recalcRowAmount(index);
    } else if (row.amount.trim() !== '') {
      this.recalcRowRate(index);
    }
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

  protected openDeleteConfirm(index: number): void {
    const row = this.rows()[index];
    if (row) {
      this.deleteTarget.set(row);
    }
  }

  protected closeDelete(): void {
    this.deleteTarget.set(null);
  }

  protected onDeleteOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeDelete();
    }
  }

  protected confirmDelete(): void {
    const row = this.deleteTarget();
    if (!row || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.salesEditService.delete(row.salesId).subscribe({
      next: (response) => {
        this.deleting.set(false);
        if (response.success) {
          this.closeDelete();
          this.toast.success(response.message);
          this.fetchData();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('sales.edit.error.delete.failed')));
      },
    });
  }

  protected async printReport(format: ReceiptFormat): Promise<void> {
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

    const summary = this.summary();
    const t = this.i18n.translate.bind(this.i18n);
    const bagLimits = this.bagLimits();

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

    const salesBagMap = new Map<string, number>();
    rows.forEach((row) => {
      const flower = (row.flower || '').trim();
      if (!flower) return;
      const lower = flower.toLowerCase();
      salesBagMap.set(lower, (salesBagMap.get(lower) || 0) + (parseInt(row.bag) || 0));
    });
    let bagSideHtml = '';
    if (bagLimits.length > 0) {
      let bagSideBody = '';
      bagLimits.forEach((config) => {
        const flowerName: string = config.flowerName;
        const lower = flowerName.trim().toLowerCase();
        const salesBagCount = salesBagMap.get(lower) || 0;
        const configuredDisplay =
          config.bagCount != null && (config.bagCount as number) > 0 ? String(config.bagCount) : '—';
        bagSideBody +=
          '<div style="margin-bottom:4px;">' +
          '<div style="font-weight:700; font-size:8px; text-transform:uppercase; letter-spacing:0.3px;">' +
          flowerName +
          '</div>' +
          '<div style="font-size:7.5px; line-height:1.4;">' +
          t('bag.limit.configured') +
          ': ' +
          configuredDisplay +
          '</div>' +
          '<div style="font-size:7.5px; line-height:1.4;">' +
          t('bag.limit.sales.count') +
          ': ' +
          salesBagCount +
          '</div>' +
          '</div>';
      });
      bagSideHtml =
        '<div style="min-width:90px; max-width:110px; text-align:left; border-left:1px dashed #000; padding-left:6px; margin-left:6px;">' +
        '<div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; text-align:center; margin-bottom:3px;">' +
        t('bag.limit.title') +
        '</div>' +
        bagSideBody +
        '</div>';
    }

    const content =
      '<div class="bl-head">' +
      '<div class="print-info">' +
      '<span><strong>' + t('report.farmer') + '</strong> ' + farmer + '</span>' +
      '<span><strong>' + t('report.date') + '</strong> ' + date + '</span>' +
      '</div>' +
      bagSideHtml +
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
      '</div>';

    const result = await this.receipt.output(content, {
      title: t('print.receipt.title'),
      fileBase: 'sales-receipt',
      format,
    });
    if (result.status !== 'ok') {
      this.toast.error(result.message);
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
      if (row.enabled) {
        const customer = row.customer.trim();
        if (!customer) {
          this.toast.error(this.i18n.translate('sales.error.customer.required.row', i + 1));
          return;
        }
        if (!this.matchesMaster(customer, this.master().buyers)) {
          this.toast.error(this.i18n.translate('sales.error.buyer.notfound.row', i + 1));
          return;
        }
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

      editedRows.push({ salesId: row.salesId, flowerType: flower, bagCount: row.bag, totalWeight: weight, price: rate, amount, customerName: row.customer.trim() });
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
