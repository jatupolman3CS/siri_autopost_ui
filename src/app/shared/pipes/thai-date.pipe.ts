import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

// ISO date string -> "3 ต.ค. 2569 16:00" (Thai Buddhist calendar, Bangkok time). Empty -> '-'.
@Pipe({ name: 'thaiDate' })
export class ThaiDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : formatter.format(date);
  }
}
