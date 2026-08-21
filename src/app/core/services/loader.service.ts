import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private activeCount = 0;

  readonly loading = signal(false);

  show(): void {
    this.activeCount += 1;
    this.loading.set(true);
  }

  hide(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (this.activeCount === 0) {
      this.loading.set(false);
    }
  }
}
