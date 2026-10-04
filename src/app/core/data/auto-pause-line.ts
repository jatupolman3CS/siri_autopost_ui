import { dkey, fmtDate, hm } from '../i18n/format';
import '../i18n/i18n.engine';
import { Dict, fmt } from '../i18n/i18n.service';

/**
 * "Paused automatically until 14:30: <reason>" for a browser the engine paused itself (the team page and the
 * extension preview). The time carries the date when it is not today; the reason is the API's own text.
 */
export function autoPauseLine(
  pause: { until: Date; reason: string },
  now: Date,
  t: Dict,
  li: number,
): string {
  const a = t.api.engine;
  const when =
    dkey(pause.until) === dkey(now)
      ? hm(pause.until)
      : `${fmtDate(pause.until, li)} ${hm(pause.until)}`;
  return pause.reason
    ? fmt(a.devAutoPaused, { t: when, r: pause.reason })
    : fmt(a.devAutoPausedNoReason, { t: when });
}
