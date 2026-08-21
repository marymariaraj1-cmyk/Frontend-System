import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AuthService } from '../../core/services/auth.service';
import { I18nService, Language } from '../../core/services/i18n.service';

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
  protected error = '';
  protected submitting = false;

  protected switchLang(lang: Language): void {
    this.i18n.switchLang(lang);
  }

  protected onSubmit(): void {
    if (this.submitting || !this.username.trim() || !this.password) {
      return;
    }
    this.submitting = true;
    this.error = '';
    this.auth.login(this.username.trim(), this.password).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.error = response.message;
        }
      },
      error: () => {
        this.submitting = false;
        this.error = 'Invalid username or password';
      },
    });
  }
}
