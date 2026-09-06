import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AuthService } from '../../core/services/auth.service';
import { I18nService, Language } from '../../core/services/i18n.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  protected readonly i18n = inject(I18nService);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected username = '';
  protected password = '';
  protected readonly error = signal('');
  protected readonly submitting = signal(false);

  protected switchLang(lang: Language): void {
    this.i18n.switchLang(lang);
  }

  protected onSubmit(): void {
    if (this.submitting() || !this.username.trim() || !this.password) {
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.auth
      .login(this.username.trim(), this.password)
      .pipe(
        timeout(5_000),
        finalize(() => {
          this.submitting.set(false);
        }),
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.router.navigate(['/dashboard']);
          } else {
            this.error.set(response.message || this.i18n.translate('login.error'));
          }
        },
        error: (err: unknown) => {
          this.error.set(extractErrorMessage(err, this.i18n.translate('login.error')));
        },
      });
  }
}
