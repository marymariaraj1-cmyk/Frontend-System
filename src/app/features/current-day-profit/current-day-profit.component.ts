import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CurrentDayProfitRow, CurrentDayProfitSalesDetail } from '../../core/models/report';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { SalesReportService } from '../../core/services/sales-report.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatDecimal } from '../../core/utils/round-off.util';

@Component({
  selector: 'app-current-day-profit',
  standalone: true,
  imports: [FormsModule, DraggableDirective, I18nPipe],
  templateUrl: './current-day-profit.html',
  styleUrl: './current-day-profit.css',
})
export class CurrentDayProfitComponent {
  private readonly service = inject(SalesReportService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;
  protected readonly rows = signal<CurrentDayProfitRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

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

  protected totalSales(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.totalSalesAmt) || 0), 0);
  }

  protected totalNet(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.totalNetAmt) || 0), 0);
  }

  protected totalDebit(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.debitAmt) || 0), 0);
  }

  protected totalFinal(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.finalAmt) || 0), 0);
  }

  protected totalCommission(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.commissionAmt) || 0), 0);
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
    return this.popupTotal() * 0.1;
  }
}
