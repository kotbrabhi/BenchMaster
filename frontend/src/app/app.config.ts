import { LOCALE_ID, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TitleStrategy, provideRouter } from '@angular/router';

import { authInterceptor } from './core/auth.interceptor';
import { routes } from './app.routes';
import { LocalizedTitleStrategy } from './core/localized-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    {
      provide: TitleStrategy,
      useClass: LocalizedTitleStrategy
    },
    {
      provide: LOCALE_ID,
      useValue: 'fr'
    }
  ]
};
