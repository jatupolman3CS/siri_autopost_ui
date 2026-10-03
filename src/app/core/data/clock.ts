// The sample data was authored around this moment. Everything is shifted so that
// ANCHOR lines up with the real current time when the app starts.
const ANCHOR = new Date(2026, 9, 3, 10, 30);
const DAY_MS = 864e5;

const now = new Date();
now.setSeconds(0, 0);

export const CLOCK = {
  now,
  /** Whole days between the anchor date and today. */
  dayShift: Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(ANCHOR.getFullYear(), ANCHOR.getMonth(), ANCHOR.getDate()).getTime()) /
      DAY_MS,
  ),
  /** Whole months between the anchor month and this month. */
  monthShift:
    now.getFullYear() * 12 + now.getMonth() - (ANCHOR.getFullYear() * 12 + ANCHOR.getMonth()),
  DAY_MS,
};

/** Seed [y, m0, d, h?, min?] -> real Date, moved by the day shift. */
export function seedDate(parts: number[]): Date {
  const [y, m, d, h = 0, mi = 0] = parts;
  return new Date(y, m, d + CLOCK.dayShift, h, mi);
}

/** Seed [y, m0, ...] -> [y, m0] moved by the month shift. */
export function seedMonth(parts: number[]): [number, number] {
  const d = new Date(parts[0], parts[1] + CLOCK.monthShift, 1);
  return [d.getFullYear(), d.getMonth()];
}

export function dateParts(d: Date): number[] {
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}
