import { Component, inject } from '@angular/core';

import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  template: `
    @if (loader.loading()) {
      <div class="global-loader-overlay active">
        <div class="global-loader-spinner">
          <div class="flower-loader">
            @for (petal of petals; track petal) {
              <span class="flower-petal" [style.--i]="petal"></span>
            }
            <span class="flower-core"></span>
          </div>
          <div class="loader-text">Loading...</div>
        </div>
      </div>
    }
  `,
})
export class LoaderComponent {
  protected readonly loader = inject(LoaderService);
  protected readonly petals = [0, 1, 2, 3, 4, 5];
}
