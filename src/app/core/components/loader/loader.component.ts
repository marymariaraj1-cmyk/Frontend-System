import { Component, inject } from '@angular/core';

import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  template: `
    @if (loader.loading()) {
      <div class="global-loader-overlay active">
        <div class="global-loader-spinner">
          <div class="loader-ring"></div>
          <div class="loader-text">Loading...</div>
        </div>
      </div>
    }
  `,
})
export class LoaderComponent {
  protected readonly loader = inject(LoaderService);
}
