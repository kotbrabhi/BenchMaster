import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';
import { TranslationKey } from '../../core/translations';

type TranslationParams = Record<string, string | number>;

@Pipe({
  name: 't',
  standalone: true
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: TranslationParams) {
    return this.i18n.t(key, params);
  }
}
