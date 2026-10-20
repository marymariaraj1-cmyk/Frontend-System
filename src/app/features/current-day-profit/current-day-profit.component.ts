import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CurrentDayProfitRow, CurrentDayProfitSalesDetail } from '../../core/models/report';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { SalesReportService } from '../../core/services/sales-report.service';
import { FarmerCommissionConfigService } from '../../core/services/farmer-commission-config.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatDecimal } from '../../core/utils/round-off.util';

@Component({
  selector: 'app-current-day-profit',
  standalone: true,
  imports: [FormsModule, DraggableDirective, I18nPipe, DataTableComponent],
  templateUrl: './current-day-profit.html',
  styleUrl: './current-day-profit.css',
})
export class CurrentDayProfitComponent {
  private readonly service = inject(SalesReportService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  protected readonly commissionConfig = inject(FarmerCommissionConfigService);

  constructor() {
    this.commissionConfig.load();
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;
  protected readonly rows = signal<CurrentDayProfitRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  protected salesNameLabel(value: string | undefined | null): string {
    return value && value.trim() ? value : this.i18n.translate('fls.sale.label');
  }

  protected readonly columns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'txn.sno',
      type: 'text',
      align: 'center',
      width: '50px',
      sortable: false,
      filterable: false,
    },
    {
      key: 'farmerName',
      header: 'current.day.total.commission.col.farmer.name',
      type: 'text',
    },
    {
      key: 'totalSalesAmt',
      header: 'current.day.total.commission.col.total.sales.amt',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'totalNetAmt',
      header: 'current.day.total.commission.col.total.net.amt',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'debitAmt',
      header: 'current.day.total.commission.col.debit.amt',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'finalAmt',
      header: 'current.day.total.commission.col.final.amt',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'commissionAmt',
      header: 'current.day.total.commission.col.commission.amt',
      type: 'number',
      className: 'amount-col',
    },
  ];

  protected readonly popupColumns: DataTableColumn[] = [
    {
      key: 'farmerName',
      header: 'current.day.total.commission.popup.col.farmer.name',
      type: 'text',
    },
    {
      key: 'custName',
      header: 'current.day.total.commission.popup.col.customer.name',
      type: 'text',
    },
    {
      key: 'flowerType',
      header: 'current.day.total.commission.popup.col.flower.type',
      type: 'text',
    },
    {
      key: 'totalWeight',
      header: 'current.day.total.commission.popup.col.quantity',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'perKgRate',
      header: 'current.day.total.commission.popup.col.rate',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'price',
      header: 'current.day.total.commission.popup.col.amount',
      type: 'number',
      className: 'amount-col',
    },
  ];

  protected readonly popupOpen = signal(false);
  protected readonly popupLoading = signal(false);
  protected readonly popupTitle = signal('');
  protected readonly popupItems = signal<CurrentDayProfitSalesDetail[]>([]);

  protected search(): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.service.getCurrentDayProfit().subscribe({
      next: (response) => {
        this.loading.set(false);
        this.searched.set(true);
        if (response.success) {
          this.rows.set(response.data);
        } else {
          this.rows.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.searched.set(true);
        this.rows.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected totalSales(rows: CurrentDayProfitRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.totalSalesAmt) || 0), 0);
  }

  protected totalNet(rows: CurrentDayProfitRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.totalNetAmt) || 0), 0);
  }

  protected totalDebit(rows: CurrentDayProfitRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.debitAmt) || 0), 0);
  }

  protected totalFinal(rows: CurrentDayProfitRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.finalAmt) || 0), 0);
  }

  protected totalCommission(rows: CurrentDayProfitRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.commissionAmt) || 0), 0);
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

  protected openSalesDetail(farmerId: string, farmerName: string): void {
    this.popupLoading.set(true);
    this.popupOpen.set(true);
    this.popupTitle.set(
      farmerName
        ? `${this.i18n.translate('current.day.total.commission.popup.title')}: ${farmerName}`
        : this.i18n.translate('current.day.total.commission.popup.title'),
    );
    this.service.getCurrentDayProfitSalesDetails(farmerId).subscribe({
      next: (response) => {
        this.popupLoading.set(false);
        if (response.success) {
          this.popupItems.set(response.data);
        } else {
          this.popupItems.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.popupLoading.set(false);
        this.popupItems.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected closePopup(): void {
    this.popupOpen.set(false);
    this.popupItems.set([]);
  }

  protected onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closePopup();
    }
  }

  protected popupTotal(): number {
    return this.popupItems().reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }

  protected popupCommission(): number {
    return this.popupTotal() * this.commissionConfig.rate();
  }
}
