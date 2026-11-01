import { Pipe, PipeTransform } from '@angular/core';

import { formatDate } from '../utils/date.util';

@Pipe({
  name: 'dateFormat',
  standalone: true,
  pure: true,
})
export class DateFormatPipe implements PipeTransform {
  transform(value: Date | string | null | undefined): string {
    return formatDate(value);
  }
}
