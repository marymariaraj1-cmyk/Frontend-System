import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LoaderComponent } from './core/components/loader/loader.component';
import { ToastComponent } from './core/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoaderComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('BloomBuddy');
}
