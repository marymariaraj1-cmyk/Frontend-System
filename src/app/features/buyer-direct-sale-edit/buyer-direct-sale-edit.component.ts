import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { IntakeDirectEditRow, SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BuyerDirectSaleEditService } from '../../core/services/buyer-direct-sale-edit.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatTotalWithPrecision, maxDecimalPlaces } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';

interface EditRow {
  salesId: number;
  bag: string;
  origBag: string;
  flowerType: string;
  origFlowerType: string;
  qty: string;
  origQty: string;
  rate: string;
  origRate: string;
  amount: string;
  origAmount: string;
  enabled: boolean;
  edited: boolean;
  flowerInvalid: boolean;
}

@Component({
  selector: 'app-buyer-direct-sale-edit',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent, DraggableDirective, DataTableComponent],
  templateUrl: './buyer-direct-sale-edit.html',
  styleUrl: './buyer-direct-sale-edit.css',
})
export class BuyerDirectSaleEditComponent implements OnInit {
  private readonly editService = inject(BuyerDirectSaleEditService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly master = signal<SalesMasterData>({ farmers: [], flowers: [], buyers: [] });
  protected readonly buyerName = signal('');
  protected readonly buyerInvalid = signal(false);
  protected readonly salesDate = signal(formatApiDate(new Date()));
  protected readonly rows = signal<EditRow[]>([]);
  protected readonly fetching = signal(false);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteTarget = signal<EditRow | null>(null);
  protected readonly noData = signal(false);

  protected currentBuyer = '';
  protected currentDate = '';

  protected readonly totals = computed(() => {
    let bag = 0;
    let qty = 0;
    let amount = 0;
    const qtyValues: string[] = [];
    const amountValues: string[] = [];
    for (const row of this.rows()) {
      const b = parseInt(row.bag, 10);
      if (!Number.isNaN(b)) {
        bag += b;
      }
      const q = parseFloat(row.qty);
      if (!Number.isNaN(q)) {
        qty += q;
        qtyValues.push(row.qty);
      }
      const a = parseFloat(row.amount);
      if (!Number.isNaN(a)) {
        amount += a;
        amountValues.push(row.amount);
      }
    }
    return {
      bag: String(bag),
      qty: formatTotalWithPrecision(qty, maxDecimalPlaces(qtyValues)),
      amount: formatTotalWithPrecision(amount, maxDecimalPlaces(amountValues)),
    };
  });

  protected readonly columns: DataTableColumn[] = [
    { key: 'sno', header: 'flower.sno', icon: 'format_list_numbered', type: 'text', align: 'center', width: '56px', className: 'col-center', sortable: false, filterable: false },
    { key: 'bag', header: 'sales.bag', icon: 'shopping_basket', type: 'text', align: 'right', width: '90px', className: 'col-num', sortable: false, filterable: false },
    { key: 'flowerType', header: 'flower.name', icon: 'local_florist', type: 'text', width: '26%', className: 'col-text col-name', sortable: false, filterable: false },
    { key: 'qty', header: 'sales.qty', icon: 'weight', type: 'text', align: 'right', width: '100px', className: 'col-num', sortable: false, filterable: false },
    { key: 'rate', header: 'sales.rate', icon: 'payments', type: 'text', align: 'right', width: '100px', className: 'col-num', sortable: false, filterable: false },
    { key: 'amount', header: 'sales.amount', icon: 'currency_rupee', type: 'text', align: 'right', width: '110px', className: 'col-num', sortable: false, filterable: false },
    { key: 'actions', header: 'flower.actions', icon: 'more_horiz', type: 'text', align: 'center', width: '110px', className: 'col-center col-actions', sortable: false, filterable: false },
  ];

  ngOnInit(): void {
    this.loadMasterData();
  }

  private loadMasterData(): void {
    this.editService.getMasterData().subscribe({
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

  protected validateBuyer(): void {
    const value = this.buyerName().trim();
    if (value !== '') {
      this.buyerInvalid.set(!this.matchesMaster(value, this.master().buyers));
    }
  }

  private matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  protected updateRow(index: number, patch: Partial<EditRow>): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected fetchData(): void {
    if (this.fetching()) {
      return;
    }
    const buyer = this.buyerName().trim();
    const date = this.salesDate();

    if (!buyer) {
      this.toast.error(this.i18n.translate('sales.error.buyer.required'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(buyer, this.master().buyers)) {
      this.toast.error(this.i18n.translate('sales.error.buyer.notfound'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!date) {
      this.toast.error(this.i18n.translate('fls.error.date.required'));
      return;
    }

    this.fetching.set(true);
    this.editService.fetch(buyer, date).subscribe({
      next: (response) => {
        this.fetching.set(false);
        if (!response.success) {
          this.toast.error(response.message);
          return;
        }
        const data = response.data;
        this.rows.set((data.rows ?? []).map((entry) => this.mapRow(entry)));
        this.currentBuyer = buyer;
        this.currentDate = date;
        const empty = (data.rows ?? []).length === 0;
        this.noData.set(empty);
        if (empty) {
          this.toast.error(this.i18n.translate('sales.edit.no.rows'));
        }
      },
      error: (error) => {
        this.fetching.set(false);
        this.toast.error(
          extractErrorMessage(error, this.i18n.translate('sales.edit.error.fetch.failed')),
        );
      },
    });
  }

  private mapRow(entry: IntakeDirectEditRow): EditRow {
    return {
      salesId: entry.salesId,
      bag: this.formatDecimal(entry.bag),
      origBag: this.formatDecimal(entry.bag),
      flowerType: entry.flowerType ?? '',
      origFlowerType: entry.flowerType ?? '',
      qty: this.formatDecimal(entry.totalWeight),
      origQty: this.formatDecimal(entry.totalWeight),
      rate: this.formatDecimal(entry.rate),
      origRate: this.formatDecimal(entry.rate),
      amount: this.formatDecimal(entry.amount),
      origAmount: this.formatDecimal(entry.amount),
      enabled: false,
      edited: false,
      flowerInvalid: false,
    };
  }

  private formatDecimal(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return String(value);
  }

  protected toggleRowEdit(index: number): void {
    const row = this.rows()[index];
    if (row.enabled) {
      this.updateRow(index, { enabled: false, edited: this.isEdited(index) });
    } else {
      this.updateRow(index, { enabled: true });
    }
  }

  protected markEdited(index: number): void {
    this.updateRow(index, { edited: this.isEdited(index) });
  }

  private isEdited(index: number): boolean {
    const row = this.rows()[index];
    return (
      row.bag !== row.origBag ||
      row.flowerType.trim() !== row.origFlowerType.trim() ||
      row.qty !== row.origQty ||
      row.rate !== row.origRate ||
      row.amount !== row.origAmount
    );
  }

  protected validateFlower(index: number): void {
    const row = this.rows()[index];
    const value = row.flowerType.trim();
    const invalid = value !== '' && !this.matchesMaster(value, this.master().flowers);
    this.updateRow(index, { flowerInvalid: invalid });
  }

  protected onDecimalKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = event.key;
    if (
      key.length !== 1 ||
      key === 'Backspace' || key === 'Delete' || key === 'Tab' || key === 'Enter' ||
      key === 'Escape' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' ||
      key === 'ArrowDown' || key === 'Home' || key === 'End'
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

  protected sanitizeBag(value: string): string {
    return (value ?? '').replace(/[^0-9]/g, '');
  }

  protected recalcAmount(index: number): void {
    const row = this.rows()[index];
    if (!row.enabled) {
      return;
    }
    if (row.qty.trim() !== '' && row.rate.trim() !== '') {
      const qty = parseFloat(row.qty);
      const rate = parseFloat(row.rate);
      if (!Number.isNaN(qty) && !Number.isNaN(rate)) {
        this.updateRow(index, { amount: String(roundOff(qty * rate)) });
      }
    }
    this.markEdited(index);
  }

  protected recalcRate(index: number): void {
    const row = this.rows()[index];
    if (!row.enabled) {
      return;
    }
    if (row.qty.trim() !== '' && row.amount.trim() !== '') {
      const qty = parseFloat(row.qty);
      const amount = parseFloat(row.amount);
      if (!Number.isNaN(qty) && !Number.isNaN(amount) && qty !== 0) {
        this.updateRow(index, { rate: String(roundOff(amount / qty)) });
      }
    }
    this.markEdited(index);
  }

  protected onQtyChange(index: number): void {
    const row = this.rows()[index];
    if (!row.enabled || row.qty.trim() === '') {
      return;
    }
    if (row.rate.trim() !== '') {
      this.recalcAmount(index);
    } else if (row.amount.trim() !== '') {
      this.recalcRate(index);
    }
  }

  protected clearForm(): void {
    this.buyerName.set('');
    this.buyerInvalid.set(false);
    this.salesDate.set(formatApiDate(new Date()));
    this.rows.set([]);
    this.currentBuyer = '';
    this.currentDate = '';
    this.noData.set(false);
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
    this.editService.delete(row.salesId).subscribe({
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
        this.toast.error(
          extractErrorMessage(error, this.i18n.translate('sales.edit.error.delete.failed')),
        );
      },
    });
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const buyer = this.buyerName().trim();
    const date = this.salesDate();

    if (!buyer) {
      this.toast.error(this.i18n.translate('sales.error.buyer.required'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(buyer, this.master().buyers)) {
      this.toast.error(this.i18n.translate('sales.error.buyer.notfound'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!date) {
      this.toast.error(this.i18n.translate('fls.error.date.required'));
      return;
    }
    if (
      !this.currentBuyer ||
      this.currentBuyer !== buyer ||
      !this.currentDate ||
      this.currentDate !== date
    ) {
      this.toast.error(this.i18n.translate('sales.edit.error.fetch.first'));
      return;
    }

    const edits = [];
    for (let i = 0; i < this.rows().length; i++) {
      const row = this.rows()[i];
      if (!row.edited) {
        continue;
      }
      if (!this.validateEditableRow(row, i + 1)) {
        return;
      }
      edits.push({
        salesId: row.salesId,
        flowerType: row.flowerType.trim(),
        bagCount: row.bag.trim() || undefined,
        totalWeight: row.qty.trim(),
        rate: row.rate.trim(),
        amount: row.amount.trim(),
      });
    }

    if (edits.length === 0) {
      this.toast.error(this.i18n.translate('sales.edit.error.no.edits'));
      return;
    }

    this.saving.set(true);
    this.editService.save({ buyerName: buyer, salesDate: date, rows: edits }).subscribe({
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
        this.toast.error(
          extractErrorMessage(error, this.i18n.translate('direct.edit.error.save.failed')),
        );
      },
    });
  }

  private validateEditableRow(row: EditRow, rowNo: number): boolean {
    const flower = row.flowerType.trim();
    if (!flower) {
      this.toast.error(this.i18n.translate('sales.error.flower.required'));
      return false;
    }
    if (!this.matchesMaster(flower, this.master().flowers)) {
      this.toast.error(this.i18n.translate('sales.error.flower.notfound'));
      return false;
    }
    const qty = row.qty.trim();
    if (qty === '' || !isDecimal(qty)) {
      this.toast.error(this.i18n.translate('fls.edit.error.qty.row', rowNo));
      return false;
    }
    const rate = row.rate.trim();
    if (rate === '' || !isDecimal(rate)) {
      this.toast.error(this.i18n.translate('fls.edit.error.rate.row', rowNo));
      return false;
    }
    const amount = row.amount.trim();
    if (amount === '' || !isDecimal(amount)) {
      this.toast.error(this.i18n.translate('sales.error.amount.row', rowNo));
      return false;
    }
    if (parseFloat(amount) <= 0) {
      this.toast.error(this.i18n.translate('sales.error.amount.positive.row', rowNo));
      return false;
    }
    return true;
  }
}
