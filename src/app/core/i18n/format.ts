import { SEED } from '../data/seed.data';

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
    ? `${d.getDate()} ${SEED.thMonths[d.getMonth()]}${year ? ' ' + (d.getFullYear() + 543) : ''}`
    : `${d.getDate()} ${SEED.enMonths[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`;
}

/** ฿1,990 */
export function baht(n: number): string {
  return '฿' + Number(n).toLocaleString('en-US');
}

export function monthName(m: number, li: number, full = false): string {
  if (full) return (li ? SEED.enMonthsFull : SEED.thMonthsFull)[m];
  return (li ? SEED.enMonths : SEED.thMonths)[m];
}

export function dayNames(li: number): string[] {
  return li ? SEED.enDays : SEED.thDays;
}

/** Calendar year as shown: Buddhist era in Thai. */
export function displayYear(y: number, li: number): number {
  return li ? y : y + 543;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "+4.2", "−1.0", "±0.0": a change with its sign (the minus is a real minus sign). */
export function signed(n: number, digits = 1): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;
}
