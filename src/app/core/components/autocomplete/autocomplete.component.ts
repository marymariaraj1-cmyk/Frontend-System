import { Component, ElementRef, computed, input, model, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

@Component({
  selector: 'app-autocomplete',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.css',
})
export class AutocompleteComponent {
  readonly value = model('');
  readonly items = input<string[]>([]);
  readonly placeholder = input('');
  readonly invalid = input(false);
  readonly onSelect = output<string>();
  readonly blur = output<void>();
  readonly enter = output<void>();

  readonly open = signal(false);
  readonly highlight = signal(-1);
  readonly position = signal<DropdownPosition | null>(null);

  private readonly wrapper = viewChild.required<ElementRef<HTMLDivElement>>('wrapper');

  readonly filtered = computed(() => {
    const query = this.value().trim().toLowerCase();
    const list = this.items() ?? [];
    if (query === '') {
      return [];
    }
    return list.filter((item) => item.toLowerCase().includes(query));
  });

  onInput(): void {
    if (this.filtered().length > 0) {
      this.openDropdown();
    } else {
      this.closeDropdown();
    }
    this.highlight.set(-1);
  }

  onFocus(): void {
    if (this.value().trim() !== '' && this.filtered().length > 0) {
      this.openDropdown();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.filtered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) {
        this.openDropdown();
      }
      this.highlight.set(Math.min(this.highlight() + 1, list.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlight.set(Math.max(this.highlight() - 1, 0));
    } else if (event.key === 'Enter') {
      if (this.open() && this.highlight() >= 0 && this.highlight() < list.length) {
        event.preventDefault();
        this.select(list[this.highlight()]);
      } else {
        this.enter.emit();
      }
    } else if (event.key === 'Escape') {
      if (this.open()) {
        event.preventDefault();
        this.closeDropdown();
      }
    } else if (event.key === 'Tab') {
      if (this.open() && this.highlight() >= 0 && this.highlight() < list.length) {
        this.select(list[this.highlight()]);
      }
    }
  }

  handleBlur(): void {
    this.blur.emit();
    setTimeout(() => this.closeDropdown(), 200);
  }

  select(item: string): void {
    this.value.set(item);
    this.onSelect.emit(item);
    this.closeDropdown();
    this.highlight.set(-1);
  }

  private openDropdown(): void {
    const el = this.wrapper().nativeElement;
    const rect = el.getBoundingClientRect();
    this.position.set({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    this.open.set(true);
    this.addWindowListeners();
  }

  private closeDropdown(): void {
    this.open.set(false);
    this.position.set(null);
    this.removeWindowListeners();
  }

  private readonly handleWindowChange = (): void => {
    this.closeDropdown();
  };

  private addWindowListeners(): void {
    window.addEventListener('scroll', this.handleWindowChange, true);
    window.addEventListener('resize', this.handleWindowChange);
  }

  private removeWindowListeners(): void {
    window.removeEventListener('scroll', this.handleWindowChange, true);
    window.removeEventListener('resize', this.handleWindowChange);
  }
}
