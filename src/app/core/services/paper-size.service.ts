import { Injectable, signal } from '@angular/core';

export type PaperSize = '3in' | '4in';

const STORAGE_KEY = 'bb_paper';

function loadStoredSize(): PaperSize {
  try {
    return localStorage.getItem(STORAGE_KEY) === '4in' ? '4in' : '3in';
  } catch {
    return '3in';
  }
}

@Injectable({ providedIn: 'root' })
export class PaperSizeService {
  readonly size = signal<PaperSize>(loadStoredSize());

  setSize(size: PaperSize): void {
    this.size.set(size);
    try {
      localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // ignore
    }
  }
}
