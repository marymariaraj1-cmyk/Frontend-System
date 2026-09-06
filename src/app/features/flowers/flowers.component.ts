import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Flower, emptyFlower } from '../../core/models/flower';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FlowerService } from '../../core/services/flower.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-flowers',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './flowers.html',
  styleUrl: './flowers.css',
})
export class FlowersComponent implements OnInit {
  private readonly flowerService = inject(FlowerService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<Flower[]>([]);
  protected readonly showForm = signal(false);
  protected readonly nameFilter = signal('');
  protected readonly filteredRows = computed(() => {
    const name = this.nameFilter().trim().toLowerCase();
    if (!name) {
      return this.rows();
    }
    return this.rows().filter((row) =>
      (row.flowerName ?? '').toLowerCase().includes(name),
    );
  });
  protected initials(name: string): string {
    return (name || '').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
  }

  protected form = emptyFlower();
  protected editing = false;
  protected submitting = false;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.flowerService.getFlowers().subscribe({
      next: (response) => {
        if (response.success) {
          this.rows.set(response.data);
        } else {
          this.toast.error(response.message);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
  }

  protected startAdd(): void {
    this.editing = false;
    this.showForm.set(true);
    this.form = emptyFlower();
  }

  protected startEdit(row: Flower): void {
    this.editing = true;
    this.showForm.set(true);
    this.form = { ...row };
  }

  protected cancel(): void {
    this.showForm.set(false);
  }

  protected submit(): void {
    if (this.submitting) {
      return;
    }
    if (!this.form.flowerName?.trim()) {
      this.toast.error(this.i18n.translate('flower.name.required'));
      return;
    }
    this.submitting = true;
    this.flowerService.saveFlower(this.form).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.success) {
          this.toast.success(response.message);
          this.showForm.set(false);
          this.form = emptyFlower();
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: () => {
        this.submitting = false;
        this.toast.error(this.i18n.translate('common.save.failed'));
      },
    });
  }
}
