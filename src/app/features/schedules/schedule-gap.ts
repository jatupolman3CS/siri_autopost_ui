import { GapPlan, hhmm } from '../../core/flow/schedule-math';
import { Dict, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { SelectOption } from '../../shared/components/select-field/select-field.component';

/** The most minutes a schedule may keep between two groups (Schedule.MaxGroupGapMinutes). */
export const GAP_MAX = 120;
/** The gaps the select offers (minutes); anything else is "custom". */
export const GAP_PRESETS: readonly number[] = [3, 5, 8, 10, 15, 20, 30, 45, 60];

/** The select of "how many minutes between two groups": the smart delay (0), the usual gaps and "custom". */
export function gapOptions(t: Dict): SelectOption[] {
  const f = t.api.flow;
  return [
    { value: '0', label: f.schGapAuto },
    ...GAP_PRESETS.map((n) => ({ value: String(n), label: fmt(f.schGapN, { n }) })),
    { value: 'custom', label: f.schGapCustom },
  ];
}

/** The select's value for a gap: the preset's minutes ('0' = the smart delay), or 'custom'. */
export function gapChoiceOf(gap: number, custom: boolean): string {
  return custom || (gap !== 0 && !GAP_PRESETS.includes(gap)) ? 'custom' : String(gap);
}

/** "2 h 10 min" / "45 min". */
export function durationText(t: Dict, minutes: number): string {
  const f = t.api.flow;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? fmt(f.schGapDurHM, { h, m }) : fmt(f.schGapDurM, { m });
}

/**
 * What a gap means, in words: the note under the field (the smart delay's range for 0, else the minimum gap and how
 * long a round takes) and the things worth knowing before saving (rounds that run into each other, a day that runs
 * past midnight). `plan` is null while the schedule has no group or time yet.
 */
export function gapLines(
  t: Dict,
  gap: number,
  plan: GapPlan | null,
  smartDelay: { min: number; max: number },
): { note: string; warnings: string[] } {
  const f = t.api.flow;
  if (gap <= 0)
    return { note: fmt(f.schGapAutoNote, { a: smartDelay.min, b: smartDelay.max }), warnings: [] };
  if (!plan) return { note: fmt(f.schGapNoteShort, { n: gap }), warnings: [] };
  const warnings: string[] = [];
  if (plan.overlap) warnings.push(f.schGapOverlap);
  if (plan.pastMidnight)
    warnings.push(fmt(f.schGapMidnight, { t: hhmm(plan.endMin), d: durationText(t, plan.dayMin) }));
  return {
    note: fmt(f.schGapNote, { n: gap, m: plan.members, d: durationText(t, plan.roundMin) }),
    warnings,
  };
}
