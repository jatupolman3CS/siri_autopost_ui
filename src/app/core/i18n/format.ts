import {
  EN_DAYS,
  EN_MONTHS,
  EN_MONTHS_FULL,
  TH_DAYS,
  TH_MONTHS,
  TH_MONTHS_FULL,
} from '../data/reference';

// Date and money formatting shared by every screen (Thai dates use the Buddhist year).

/** 2026-10-03 */
export function dkey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 14:05 */
export function hm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "3 ต.ค." / "3 Oct", with the year when asked ("3 ต.ค. 2569"). */
export function fmtDate(d: Date, li: number, year = false): string {
  return li === 0
    ? `${d.getDate()} ${TH_MONTHS[d.getMonth()]}${year ? ' ' + (d.getFullYear() + 543) : ''}`
    : `${d.getDate()} ${EN_MONTHS[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`;
}

/** ฿1,990 */
export function baht(n: number): string {
  return '฿' + Number(n).toLocaleString('en-US');
}

export function monthName(m: number, li: number, full = false): string {
  if (full) return (li ? EN_MONTHS_FULL : TH_MONTHS_FULL)[m];
  return (li ? EN_MONTHS : TH_MONTHS)[m];
}

export function dayNames(li: number): string[] {
  return li ? EN_DAYS : TH_DAYS;
}

/** Calendar year as shown: Buddhist era in Thai. */
export function displayYear(y: number, li: number): number {
  return li ? y : y + 543;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
