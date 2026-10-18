import {
  Component,
  ContentChild,
  Input,
  TemplateRef,
  computed,
  signal,
} from '@angular/core';

import { NgTemplateOutlet } from '@angular/common';

import { I18nPipe } from '../../pipes/i18n.pipe';

export type DataTableFilterType = 'text' | 'none' | 'select';
export type DataTableSortDir = 'asc' | 'desc';

export interface DataTableFilterOption {
  value: string;
  label: string;
}

export interface DataTableColumn {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'currency' | 'date';
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: DataTableFilterType;
  options?: DataTableFilterOption[];
  headerWrap?: boolean;
  icon?: string;
  value?: (row: unknown) => unknown;
}

interface SortState {
  key: string;
  dir: DataTableSortDir;
}

type FilterValue = string;

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [I18nPipe, NgTemplateOutlet],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent {
  @Input({ required: true }) set columns(value: DataTableColumn[]) {
    this.columnsSig.set(value ?? []);
  }

  @Input({ required: true }) set data(value: unknown[]) {
    this.dataSig.set(value ?? []);
  }

  @Input() set pageSize(value: number) {
    const size = Number(value);
    if (Number.isFinite(size) && size > 0) {
      this.pageSizeSig.set(size);
      this.pageSig.set(1);
    }
  }

  @Input() pageSizeOptions: number[] = [10, 25, 50, 100];
  @Input() enablePagination = true;
  @Input() enableSort = true;
  @Input() enableFilter = true;
  @Input() pageSizeSelector = true;
  @Input() resultInfo = true;
  @Input() tableClasses = 'report-table';
  @Input() wrapperClasses = 'table-container';
  @Input() trackKey: string | null = null;
  @Input() emptyKey = 'common.no.records';
  @Input() showClearFilters = true;

  @ContentChild('row', { static: true }) rowTemplate?: TemplateRef<unknown>;
  @ContentChild('footer', { static: true }) footerTemplate?: TemplateRef<unknown>;
  @ContentChild('bodyFooter', { static: true }) bodyFooterTemplate?: TemplateRef<unknown>;

  readonly columnsSig = signal<DataTableColumn[]>([]);
  readonly dataSig = signal<unknown[]>([]);
  readonly pageSizeSig = signal<number>(10);
  readonly pageSig = signal<number>(1);
  readonly sortSig = signal<SortState | null>(null);
  readonly filtersSig = signal<Record<string, FilterValue>>({});

  private readonly debounceTimers: Record<string, unknown> = {};

  readonly filteredRows = computed(() => {
    const rows = this.dataSig();
    const filters = this.filtersSig();
    const keys = Object.keys(filters);
    if (keys.length === 0) {
      return rows;
    }
    const cols = this.columnsSig();
    return rows.filter((row) =>
      keys.every((key) => {
        const col = cols.find((c) => c.key === key);
        return col ? this.matchesFilter(row, col, filters[key]) : true;
      }),
    );
  });

  readonly sortedRows = computed(() => {
    const sort = this.sortSig();
    const rows = this.filteredRows();
    if (!sort) {
      return rows;
    }
    const col = this.columnsSig().find((c) => c.key === sort.key);
    if (!col) {
      return rows;
    }
    const dir = sort.dir === 'asc' ? 1 : -1;
    const getter = (row: unknown): unknown => this.valueOf(row, col);
    return [...rows].sort((a, b) => dir * this.compare(getter(a), getter(b), col));
  });

  readonly pageCount = computed(() => {
    const size = this.pageSizeSig();
    const total = this.sortedRows().length;
    return Math.max(1, Math.ceil(total / size));
  });

  readonly pagedRows = computed(() => {
    const sorted = this.sortedRows();
    if (!this.enablePagination) {
      return sorted;
    }
    const size = this.pageSizeSig();
    const page = Math.min(this.pageSig(), this.pageCount());
    const start = (page - 1) * size;
    return sorted.slice(start, start + size);
  });

  readonly anyFilterActive = computed(() => Object.keys(this.filtersSig()).length > 0);

  readonly shouldShowPager = computed(() => {
    if (!this.enablePagination) {
      return false;
    }
    const min = this.pageSizeOptions.length > 0 ? Math.min(...this.pageSizeOptions) : this.pageSizeSig();
    return this.sortedRows().length > min;
  });

  readonly rangeLabel = computed(() => {
    const total = this.sortedRows().length;
    if (total === 0) {
      return '';
    }
    const size = this.pageSizeSig();
    const page = Math.min(this.pageSig(), this.pageCount());
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return `${from}–${to} of ${total}`;
  });

  readonly startIndex = computed(() => {
    const size = this.pageSizeSig();
    const page = Math.min(this.pageSig(), this.pageCount());
    return (page - 1) * size;
  });

  readonly visibleCount = computed(() => this.sortedRows().length);

  protected readonly pageNumbers = computed<(number | string)[]>(() => {
    const current = Math.min(this.pageSig(), this.pageCount());
    const total = this.pageCount();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (current > 4) {
      pages.push('…');
    }
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 3) {
      pages.push('…');
    }
    pages.push(total);
    return pages;
  });

  protected sortIcon(col: DataTableColumn): string {
    const sort = this.sortSig();
    if (!sort || sort.key !== col.key) {
      return 'swap_vert';
    }
    return sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  protected sortActive(col: DataTableColumn): boolean {
    return this.sortSig()?.key === col.key;
  }

  protected onSort(col: DataTableColumn): void {
    if (col.sortable === false) {
      return;
    }
    const current = this.sortSig();
    if (!current || current.key !== col.key) {
      this.sortSig.set({ key: col.key, dir: 'asc' });
      return;
    }
    if (current.dir === 'asc') {
      this.sortSig.set({ key: col.key, dir: 'desc' });
      return;
    }
    this.sortSig.set(null);
  }

  protected filterActive(col: DataTableColumn): boolean {
    return this.filtersSig()[col.key] !== undefined;
  }

  protected textFilter(col: DataTableColumn): string {
    const v = this.filtersSig()[col.key];
    return typeof v === 'string' ? v : '';
  }

  protected filterTypeFor(col: DataTableColumn): DataTableFilterType {
    return col.filterType ?? 'text';
  }

  protected filterOptions(col: DataTableColumn): DataTableFilterOption[] {
    return col.options ?? [];
  }

  protected selectFilter(col: DataTableColumn): string {
    const v = this.filtersSig()[col.key];
    return typeof v === 'string' ? v : '';
  }

  protected onSelectFilter(col: DataTableColumn, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.filtersSig.update((f) => {
      const next = { ...f };
      if (value) {
        next[col.key] = value;
      } else {
        delete next[col.key];
      }
      return next;
    });
    this.pageSig.set(1);
  }

  protected colAlign(col: DataTableColumn): string | undefined {
    if (col.align) {
      return col.align;
    }
    if (col.type === 'number' || col.type === 'currency') {
      return 'right';
    }
    return undefined;
  }

  protected onTextInput(col: DataTableColumn, event: Event): void {
    const input = event.target as HTMLInputElement;
    const key = `text:${col.key}`;
    clearTimeout(this.debounceTimers[key] as ReturnType<typeof setTimeout> | undefined);
    this.debounceTimers[key] = setTimeout(() => {
      const value = input.value.trim();
      this.filtersSig.update((f) => {
        const next = { ...f };
        if (value) {
          next[col.key] = value;
        } else {
          delete next[col.key];
        }
        return next;
      });
      this.pageSig.set(1);
    }, 300);
  }

  protected clearFilters(): void {
    this.filtersSig.set({});
    this.pageSig.set(1);
  }

  protected goFirst(): void {
    this.pageSig.set(1);
  }

  protected goPrev(): void {
    this.pageSig.update((p) => Math.max(1, p - 1));
  }

  protected goNext(): void {
    this.pageSig.update((p) => Math.min(this.pageCount(), p + 1));
  }

  protected goLast(): void {
    this.pageSig.set(this.pageCount());
  }

  protected goTo(page: number | string): void {
    if (typeof page === 'number') {
      this.pageSig.set(Math.min(Math.max(1, page), this.pageCount()));
    }
  }

  protected onPageSize(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSizeSig.set(Number(select.value));
    this.pageSig.set(1);
  }

  private valueOf(row: unknown, col: DataTableColumn): unknown {
    if (col.value) {
      return col.value(row);
    }
    const record = row as Record<string, unknown>;
    return record ? (record[col.key] ?? '') : '';
  }

  private matchesFilter(row: unknown, col: DataTableColumn, filter: FilterValue | undefined): boolean {
    if (!filter || typeof filter !== 'string') {
      return true;
    }
    const type = this.filterTypeFor(col);
    if (type === 'none') {
      return true;
    }
    const query = filter.toLowerCase().trim();
    if (!query) {
      return true;
    }
    const raw = String(this.valueOf(row, col) ?? '');
    if (type === 'select') {
      return raw.trim().toLowerCase() === query;
    }
    const qNorm = this.stripSymbols(query);
    return this.textVariants(raw).some(
      (v) => v.includes(query) || this.stripSymbols(v).includes(qNorm),
    );
  }

  private stripSymbols(value: string): string {
    return value.toLowerCase().replace(/[^0-9a-z]/g, '');
  }

  private textVariants(value: string): string[] {
    const text = String(value ?? '');
    const variants = [text.toLowerCase()];
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      variants.push(`${m[3]}-${m[2]}-${m[1]}`);
      variants.push(`${m[3]}/${m[2]}/${m[1]}`);
    }
    return variants;
  }

  private compare(a: unknown, b: unknown, col: DataTableColumn): number {
    const type = col.type ?? 'text';
    if (type === 'number' || type === 'currency') {
      const na = Number(a);
      const nb = Number(b);
      const va = Number.isNaN(na) ? Number.NEGATIVE_INFINITY : na;
      const vb = Number.isNaN(nb) ? Number.NEGATIVE_INFINITY : nb;
      return va === vb ? 0 : va > vb ? 1 : -1;
    }
    if (type === 'date') {
      const sa = String(a ?? '');
      const sb = String(b ?? '');
      return sa === sb ? 0 : sa > sb ? 1 : -1;
    }
    const sa = String(a ?? '').toLowerCase();
    const sb = String(b ?? '').toLowerCase();
    return sa === sb ? 0 : sa > sb ? 1 : -1;
  }

  protected trackRow(row: unknown, index: number): unknown {
    if (this.trackKey) {
      const value = (row as Record<string, unknown>)?.[this.trackKey];
      if (value !== undefined) {
        return value;
      }
    }
    return index;
  }
}