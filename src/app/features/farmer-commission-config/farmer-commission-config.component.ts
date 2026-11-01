import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { ApiService } from '../../core/services/api.service';
import { I18nService } from '../../core/services/i18n.service';
import { FarmerCommissionConfigService } from '../../core/services/farmer-commission-config.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-farmer-commission-config',
  standalone: true,
  imports: [FormsModule, DataTableComponent, I18nPipe, DatePipe],
  templateUrl: './farmer-commission-config.html',
  styleUrls: ['./farmer-commission-config.css']
})
export class FarmerCommissionConfigComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  private commissionConfig = inject(FarmerCommissionConfigService);

  protected rows = signal<any[]>([]);
  protected showForm = signal(false);
  protected submitting = false;
  protected editing = false;

  protected form = {
    commissionPercent: 10.00,
    description: ''
  };

  protected columns: DataTableColumn[] = [
    { key: 'commissionConfigId', header: 'common.sno', align: 'left' },
    { key: 'commissionPercent', header: 'farmer.commission.config.col.percent', align: 'right' },
    { key: 'description', header: 'farmer.commission.config.col.description', align: 'left' },
    { key: 'updatedDate', header: 'farmer.commission.config.col.updated', align: 'center' },
    { key: 'actions', header: '', sortable: false, align: 'center', width: '120px' }
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api.get<any[]>('/commission-config/list').subscribe({
      next: (res) => {
        if (res && res.success) {
          this.rows.set(res.data || []);
        } else {
          this.toast.error(res?.message || this.i18n.translate('farmer.commission.config.load.failed'));
        }
      },
      error: () => this.toast.error(this.i18n.translate('farmer.commission.config.load.failed'))
    });
  }

  protected startAdd(): void {
    this.form = { commissionPercent: 10.00, description: '' };
    this.editing = false;
    this.showForm.set(true);
  }

  protected edit(config: any): void {
    this.form = {
      commissionPercent: config.commissionPercent,
      description: config.description ?? ''
    };
    this.editing = true;
    this.showForm.set(true);
  }

  protected submit(): void {
    this.submitting = true;
    const body = {
      commissionPercent: this.form.commissionPercent,
      description: this.form.description
    };
    this.api.post<any>('/commission-config/save', body).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showForm.set(false);
        if (res && res.success) {
          this.toast.success(this.i18n.translate('farmer.commission.config.save.success'));
          this.commissionConfig.load(true);
          this.load();
        } else {
          this.toast.error(res?.message || this.i18n.translate('farmer.commission.config.save.failed'));
        }
      },
      error: () => {
        this.submitting = false;
        this.toast.error(this.i18n.translate('farmer.commission.config.save.failed'));
      }
    });
  }

  protected cancel(): void {
    this.showForm.set(false);
  }
}
