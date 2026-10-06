import {
  addDays,
  AUTO_DELETE_DAY_OPTIONS,
  bestHours,
  BUMP_HOUR_OPTIONS,
  dayMatches,
  hhmm,
  HORIZON_DAYS,
  hourChips,
  isTimesMode,
  localDateKey,
  memberSlots,
  normalizeTimes,
  overrideKeyOfLink,
  overridesFromInput,
  parseDateKey,
  parseTimes,
  previewDays,
  SCHEDULE_MODES,
  type ScheduleLike,
  scheduleCadence,
  slotBuckets,
  slotsOf,
  taskCountPerDay,
  toMinutes,
  utcOffsetMinutes,
  weekdayOf,
} from './schedule-math';

// Calendar anchors: 2026-10-01 is a Thursday, 10-02 Friday, 10-03 Saturday, 10-04 Sunday, 10-05 Monday.
const THU = '2026-10-01';
const FRI = '2026-10-02';
const SAT = '2026-10-03';
const SUN = '2026-10-04';
const MON = '2026-10-05';
const WEEK = [THU, FRI, SAT, SUN, MON, '2026-10-06', '2026-10-07'];

describe('constants', () => {
  it('match the prototype and the server', () => {
    expect(SCHEDULE_MODES).toEqual(['daily', 'weekdays', 'weekend', 'interval', 'drip', 'once']);
    expect(HORIZON_DAYS).toBe(14);
    expect(BUMP_HOUR_OPTIONS).toEqual([0, 1, 2, 3, 6, 12, 24]);
    expect(AUTO_DELETE_DAY_OPTIONS).toEqual([0, 3, 7, 14]);
  });

  it('isTimesMode is true for the modes with hand-picked times', () => {
    expect(SCHEDULE_MODES.filter(isTimesMode)).toEqual(['daily', 'weekdays', 'weekend']);
  });
});

describe('toMinutes', () => {
  it.each([
    ['00:00', 0],
    ['09:30', 570],
    ['9:30', 570],
    ['09.30', 570],
    [' 18:05 ', 1085],
    ['23:59', 1439],
  ])('%j -> %i', (text, minutes) => {
    expect(toMinutes(text)).toBe(minutes);
  });

  it.each(['24:00', '12:60', '9', '9:5', '09:300', 'abc', '', '12:30:00', '-1:00', '1e1:00'])(
    '%j is not a time',
    (text) => {
      expect(toMinutes(text)).toBeNull();
    },
  );

  it('is null for null and undefined', () => {
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes(undefined)).toBeNull();
  });
});

describe('hhmm', () => {
  it('formats minutes after midnight', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(5)).toBe('00:05');
    expect(hhmm(570)).toBe('09:30');
    expect(hhmm(1439)).toBe('23:59');
  });

  it('wraps around midnight in both directions', () => {
    expect(hhmm(1440)).toBe('00:00');
    expect(hhmm(1500)).toBe('01:00');
    expect(hhmm(-1)).toBe('23:59');
    expect(hhmm(-1440)).toBe('00:00');
  });

  it('rounds fractions and survives NaN', () => {
    expect(hhmm(570.4)).toBe('09:30');
    expect(hhmm(570.5)).toBe('09:31');
    expect(hhmm(Number.NaN)).toBe('00:00');
    expect(hhmm(Number.POSITIVE_INFINITY)).toBe('00:00');
  });

  it('round-trips with toMinutes', () => {
    for (let m = 0; m < 1440; m += 7) expect(toMinutes(hhmm(m))).toBe(m);
  });
});

describe('normalizeTimes', () => {
  it('keeps valid times as distinct sorted HH:mm', () => {
    expect(normalizeTimes(['18:00', '9:30', '09:30', '09.30', 'x', '', '24:00', '00:00'])).toEqual([
      '00:00',
      '09:30',
      '18:00',
    ]);
  });

  it('is empty for nothing', () => {
    expect(normalizeTimes([])).toEqual([]);
    expect(normalizeTimes(null)).toEqual([]);
    expect(normalizeTimes(undefined)).toEqual([]);
    expect(normalizeTimes([null, undefined])).toEqual([]);
  });
});

describe('parseTimes', () => {
  it('reads comma and space separated times, sorted and distinct', () => {
    expect(parseTimes('18:00, 9:30  09.30\n12:00,,')).toEqual({
      times: ['09:30', '12:00', '18:00'],
      bad: false,
    });
  });

  it('flags unreadable parts but keeps the readable ones', () => {
    expect(parseTimes('9:30 abc')).toEqual({ times: ['09:30'], bad: true });
    expect(parseTimes('24:00')).toEqual({ times: [], bad: true });
    expect(parseTimes('12:60, 10:00')).toEqual({ times: ['10:00'], bad: true });
    expect(parseTimes('9')).toEqual({ times: [], bad: true });
    expect(parseTimes('9:5')).toEqual({ times: [], bad: true });
  });

  it('is empty and not bad for blank input', () => {
    expect(parseTimes('')).toEqual({ times: [], bad: false });
    expect(parseTimes('  , , ')).toEqual({ times: [], bad: false });
    expect(parseTimes(null)).toEqual({ times: [], bad: false });
    expect(parseTimes(undefined)).toEqual({ times: [], bad: false });
  });
});

describe('hourChips', () => {
  it('offers 06:00 to 22:00 by default', () => {
    const chips = hourChips();
    expect(chips).toHaveLength(17);
    expect(chips[0]).toBe('06:00');
    expect(chips[16]).toBe('22:00');
  });

  it('adds chosen times in their place without repeating hours', () => {
    const chips = hourChips(6, 22, ['09:30', '07:00', '23:15', '04:45']);
    expect(chips).toHaveLength(17 + 3);
    expect(chips.slice(0, 2)).toEqual(['04:45', '06:00']);
    expect(chips).toContain('09:30');
    expect(chips.indexOf('09:30')).toBe(chips.indexOf('09:00') + 1);
    expect(chips[chips.length - 1]).toBe('23:15');
  });

  it('drops unreadable extras', () => {
    expect(hourChips(8, 9, ['x', '25:00'])).toEqual(['08:00', '09:00']);
  });

  it('takes a custom range and clamps it to the day', () => {
    expect(hourChips(8, 10)).toEqual(['08:00', '09:00', '10:00']);
    expect(hourChips(-3, 30)).toHaveLength(24);
    expect(hourChips(5, 5)).toEqual(['05:00']);
  });

  it('is only the extras for an empty range', () => {
    expect(hourChips(10, 8)).toEqual([]);
    expect(hourChips(10, 8, ['09:15'])).toEqual(['09:15']);
  });
});

describe('slotsOf: picked times', () => {
  it.each(['daily', 'weekdays', 'weekend'] as const)(
    '%s uses its times, sorted and distinct',
    (mode) => {
      expect(slotsOf({ mode, times: ['18:00', '9:00', '09:00', ''] })).toEqual(['09:00', '18:00']);
    },
  );

  it('is empty without times', () => {
    expect(slotsOf({ mode: 'daily' })).toEqual([]);
    expect(slotsOf({ mode: 'daily', times: [] })).toEqual([]);
    expect(slotsOf({ mode: 'weekend', times: null })).toEqual([]);
  });

  it('ignores interval and drip fields for the picked-times modes', () => {
    expect(
      slotsOf({ mode: 'daily', times: ['10:00'], everyHours: 2, firstTime: '06:00', dripCount: 5 }),
    ).toEqual(['10:00']);
  });
});

describe('slotsOf: once', () => {
  it('is its single time', () => {
    expect(slotsOf({ mode: 'once', onceTime: '14:00' })).toEqual(['14:00']);
    expect(slotsOf({ mode: 'once', onceTime: '9:05', times: ['10:00'] })).toEqual(['09:05']);
  });

  it('falls back to the picked times when no once time is set', () => {
    expect(slotsOf({ mode: 'once', times: ['10:00', '09:00'] })).toEqual(['09:00', '10:00']);
    expect(slotsOf({ mode: 'once', onceTime: 'bad', times: ['10:00'] })).toEqual(['10:00']);
  });

  it('is empty without any time', () => {
    expect(slotsOf({ mode: 'once' })).toEqual([]);
  });
});

describe('slotsOf: interval', () => {
  const interval = (
    firstTime: string,
    everyHours: number,
    extra: Partial<ScheduleLike> = {},
  ): ScheduleLike => ({
    mode: 'interval',
    firstTime,
    everyHours,
    ...extra,
  });

  it('repeats every N hours from the first time until midnight', () => {
    expect(slotsOf(interval('09:00', 6))).toEqual(['09:00', '15:00', '21:00']);
    expect(slotsOf(interval('08:00', 4))).toEqual(['08:00', '12:00', '16:00', '20:00']);
    expect(slotsOf(interval('00:00', 12))).toEqual(['00:00', '12:00']);
    expect(slotsOf(interval('08:00', 5))).toEqual(['08:00', '13:00', '18:00', '23:00']);
  });

  it('does not cross midnight: a round that would fall on the next day is not made', () => {
    expect(slotsOf(interval('22:00', 6))).toEqual(['22:00']);
    expect(slotsOf(interval('20:00', 3))).toEqual(['20:00', '23:00']);
    expect(slotsOf(interval('22:00', 1))).toEqual(['22:00', '23:00']);
    expect(slotsOf(interval('23:59', 1))).toEqual(['23:59']);
  });

  it('is a single round when the step is a day or longer', () => {
    expect(slotsOf(interval('10:30', 24))).toEqual(['10:30']);
    expect(slotsOf(interval('10:30', 48))).toEqual(['10:30']);
  });

  it('keeps minutes of the first time', () => {
    expect(slotsOf(interval('09:30', 6))).toEqual(['09:30', '15:30', '21:30']);
  });

  it('defaults to every 6 hours when the step is missing or zero', () => {
    expect(slotsOf(interval('09:00', 0))).toEqual(['09:00', '15:00', '21:00']);
    expect(slotsOf({ mode: 'interval', firstTime: '09:00' })).toEqual(['09:00', '15:00', '21:00']);
  });

  it('starts from the first picked time, else 08:00, when the first time is missing or unreadable', () => {
    expect(slotsOf(interval('', 6, { times: ['10:00'] }))).toEqual(['10:00', '16:00', '22:00']);
    expect(slotsOf(interval('xx', 6))).toEqual(['08:00', '14:00', '20:00']);
    expect(slotsOf({ mode: 'interval', everyHours: 8 })).toEqual(['08:00', '16:00']);
  });

  it('treats a step below one hour as one hour', () => {
    expect(slotsOf(interval('22:00', -2))).toEqual(['22:00', '23:00']);
  });
});

describe('slotsOf: drip', () => {
  const drip = (dripFrom: string, dripTo: string, dripCount: number): ScheduleLike => ({
    mode: 'drip',
    dripFrom,
    dripTo,
    dripCount,
  });

  it('spreads the count evenly from the first to the last time, both included', () => {
    expect(slotsOf(drip('09:00', '21:00', 3))).toEqual(['09:00', '15:00', '21:00']);
    expect(slotsOf(drip('09:00', '21:00', 2))).toEqual(['09:00', '21:00']);
    expect(slotsOf(drip('09:00', '21:00', 4))).toEqual(['09:00', '13:00', '17:00', '21:00']);
  });

  it('puts a single post in the middle of the span', () => {
    expect(slotsOf(drip('09:00', '21:00', 1))).toEqual(['15:00']);
    expect(slotsOf(drip('09:00', '10:00', 1))).toEqual(['09:30']);
    expect(slotsOf(drip('09:00', '09:01', 1))).toEqual(['09:01']);
  });

  it('rounds half up', () => {
    // span 2 minutes, 5 posts: offsets 0, .5, 1, 1.5, 2 -> 0, 1, 1, 2, 2
    expect(slotsOf(drip('09:00', '09:02', 5))).toEqual(['09:00', '09:01', '09:02']);
  });

  it('spreads twelve posts over a day window', () => {
    expect(slotsOf(drip('09:00', '21:00', 12))).toEqual([
      '09:00',
      '10:05',
      '11:11',
      '12:16',
      '13:22',
      '14:27',
      '15:33',
      '16:38',
      '17:44',
      '18:49',
      '19:55',
      '21:00',
    ]);
  });

  it('is one slot when the window is empty or reversed', () => {
    expect(slotsOf(drip('10:00', '10:00', 4))).toEqual(['10:00']);
    expect(slotsOf(drip('21:00', '09:00', 3))).toEqual(['21:00']);
  });

  it('keeps the count between 1 and 12 and defaults a missing one to 3', () => {
    expect(slotsOf(drip('00:00', '23:00', 50))).toHaveLength(12);
    expect(slotsOf(drip('09:00', '21:00', 0))).toEqual(['09:00', '15:00', '21:00']);
    expect(slotsOf(drip('09:00', '21:00', -5))).toEqual(['15:00']);
    expect(slotsOf({ mode: 'drip', dripFrom: '09:00', dripTo: '21:00' })).toEqual([
      '09:00',
      '15:00',
      '21:00',
    ]);
    expect(slotsOf(drip('09:00', '21:00', 2.9))).toEqual(['09:00', '21:00']);
  });

  it('defaults the window to 09:00-21:00', () => {
    expect(slotsOf({ mode: 'drip', dripCount: 3 })).toEqual(['09:00', '15:00', '21:00']);
    expect(slotsOf(drip('bad', '', 3))).toEqual(['09:00', '15:00', '21:00']);
  });

  it('returns ascending times', () => {
    const slots = slotsOf(drip('06:07', '22:53', 7));
    expect(slots).toEqual([...slots].sort());
    expect(slots[0]).toBe('06:07');
    expect(slots[slots.length - 1]).toBe('22:53');
  });
});

describe('calendar helpers', () => {
  it('parseDateKey accepts real dates only', () => {
    expect(parseDateKey('2026-10-04')).toEqual([2026, 10, 4]);
    expect(parseDateKey('2028-02-29')).toEqual([2028, 2, 29]);
    for (const bad of [
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-10-32',
      '2026-1-1',
      '2026/10/04',
      '',
      'x',
    ]) {
      expect(parseDateKey(bad)).toBeNull();
    }
    expect(parseDateKey(null)).toBeNull();
    expect(parseDateKey(undefined)).toBeNull();
  });

  it('localDateKey uses the local calendar day', () => {
    expect(localDateKey(new Date(2026, 9, 4, 23, 59, 59))).toBe('2026-10-04');
    expect(localDateKey(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
    expect(localDateKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
  });

  it('addDays moves across months, years and leap days', () => {
    expect(addDays('2026-10-04', 0)).toBe('2026-10-04');
    expect(addDays('2026-10-04', 1)).toBe('2026-10-05');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-10-04', 14)).toBe('2026-10-18');
    expect(addDays('2026-10-04', 400)).toBe('2027-11-08');
  });

  it('addDays is not thrown off by daylight saving changes', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('addDays gives an empty key for an invalid one', () => {
    expect(addDays('nope', 1)).toBe('');
    expect(addDays('', 1)).toBe('');
  });

  it('weekdayOf counts from Sunday = 0', () => {
    expect(WEEK.map(weekdayOf)).toEqual([4, 5, 6, 0, 1, 2, 3]);
    expect(weekdayOf('2026-02-30')).toBe(-1);
  });

  it('utcOffsetMinutes is the browser offset from UTC, east positive', () => {
    const spy = vi.spyOn(Date.prototype, 'getTimezoneOffset');
    try {
      spy.mockReturnValue(-420);
      expect(utcOffsetMinutes()).toBe(420);
      spy.mockReturnValue(300);
      expect(utcOffsetMinutes()).toBe(-300);
      spy.mockReturnValue(0);
      expect(utcOffsetMinutes()).toBe(0);
      spy.mockReturnValue(-330);
      expect(utcOffsetMinutes(new Date(2026, 5, 1))).toBe(330);
    } finally {
      spy.mockRestore();
    }
  });

  it('utcOffsetMinutes answers a whole number within one day without any mocking', () => {
    const v = utcOffsetMinutes();
    expect(Number.isInteger(v)).toBe(true);
    expect(Math.abs(v)).toBeLessThanOrEqual(840);
  });
});

describe('dayMatches', () => {
  const days = (s: ScheduleLike) => WEEK.map((d) => dayMatches(s, d));

  it('daily, interval and drip run every day', () => {
    for (const mode of ['daily', 'interval', 'drip'] as const) {
      expect(days({ mode })).toEqual([true, true, true, true, true, true, true]);
    }
  });

  it('weekdays runs Monday to Friday', () => {
    expect(days({ mode: 'weekdays' })).toEqual([true, true, false, false, true, true, true]);
  });

  it('weekend runs Friday, Saturday and Sunday', () => {
    expect(days({ mode: 'weekend' })).toEqual([false, true, true, true, false, false, false]);
  });

  it('weekend includes Friday and excludes Monday to Thursday', () => {
    expect(dayMatches({ mode: 'weekend' }, FRI)).toBe(true);
    expect(dayMatches({ mode: 'weekend' }, SAT)).toBe(true);
    expect(dayMatches({ mode: 'weekend' }, SUN)).toBe(true);
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) {
      expect(dayMatches({ mode: 'weekend' }, d)).toBe(false);
    }
  });

  it('never runs before its start date, and runs from it on', () => {
    const s: ScheduleLike = { mode: 'daily', startDate: SAT };
    expect(days(s)).toEqual([false, false, true, true, true, true, true]);
    expect(dayMatches({ mode: 'weekend', startDate: SUN }, SAT)).toBe(false);
    expect(dayMatches({ mode: 'weekend', startDate: SUN }, SUN)).toBe(true);
    expect(dayMatches({ mode: 'weekdays', startDate: THU }, THU)).toBe(true);
    expect(dayMatches({ mode: 'drip', startDate: THU }, '2026-09-30')).toBe(false);
  });

  it('treats an empty start date as no limit', () => {
    expect(dayMatches({ mode: 'daily', startDate: '' }, '2020-01-01')).toBe(true);
    expect(dayMatches({ mode: 'daily', startDate: null }, '2020-01-01')).toBe(true);
  });

  it('once runs on its start date only', () => {
    const s: ScheduleLike = { mode: 'once', startDate: SAT };
    expect(days(s)).toEqual([false, false, true, false, false, false, false]);
    expect(dayMatches({ mode: 'once' }, SAT)).toBe(false);
    expect(dayMatches({ mode: 'once', startDate: '' }, '')).toBe(false);
  });

  it('is false for an invalid day', () => {
    expect(dayMatches({ mode: 'daily' }, '')).toBe(false);
    expect(dayMatches({ mode: 'daily' }, 'x')).toBe(false);
    expect(dayMatches({ mode: 'daily' }, '2026-02-30')).toBe(false);
  });
});

describe('overrides and members', () => {
  const schedule: ScheduleLike = {
    mode: 'daily',
    times: ['09:00', '18:00'],
    overrides: { a: ['10:00'], b: [], c: ['x', '25:00'], d: ['12:00', '08:00', '12:00'] },
  };

  it('memberSlots uses the override when it has readable times, else the schedule slots', () => {
    expect(memberSlots(schedule, 'a')).toEqual(['10:00']);
    expect(memberSlots(schedule, 'b')).toEqual(['09:00', '18:00']);
    expect(memberSlots(schedule, 'c')).toEqual(['09:00', '18:00']);
    expect(memberSlots(schedule, 'd')).toEqual(['08:00', '12:00']);
    expect(memberSlots(schedule, 'unknown')).toEqual(['09:00', '18:00']);
    expect(memberSlots({ mode: 'daily', times: ['09:00'] }, 'a')).toEqual(['09:00']);
  });

  it('memberSlots follows an interval or drip schedule', () => {
    expect(memberSlots({ mode: 'interval', firstTime: '20:00', everyHours: 3 }, 'x')).toEqual([
      '20:00',
      '23:00',
    ]);
    expect(memberSlots({ mode: 'drip', dripCount: 1, overrides: { x: ['07:00'] } }, 'x')).toEqual([
      '07:00',
    ]);
    expect(memberSlots({ mode: 'drip', dripCount: 1 }, 'x')).toEqual(['15:00']);
  });

  it("taskCountPerDay adds each member's own count or the schedule's", () => {
    expect(taskCountPerDay(schedule, ['a', 'b', 'c', 'd', 'e'])).toBe(1 + 2 + 2 + 2 + 2);
    expect(taskCountPerDay(schedule, ['a'])).toBe(1);
    expect(taskCountPerDay(schedule, [])).toBe(0);
    expect(taskCountPerDay({ mode: 'daily' }, ['a', 'b'])).toBe(0);
  });

  it('taskCountPerDay with no overrides is members times slots', () => {
    expect(taskCountPerDay({ mode: 'drip', dripCount: 4 }, ['a', 'b', 'c'])).toBe(12);
    expect(taskCountPerDay({ mode: 'once', onceTime: '10:00' }, ['a', 'b', 'c'])).toBe(3);
    expect(
      taskCountPerDay({ mode: 'interval', firstTime: '08:00', everyHours: 4 }, ['a', 'b']),
    ).toBe(8);
  });

  it('slotBuckets groups members by slot, ascending, keeping member order', () => {
    expect(slotBuckets(schedule, ['e', 'a', 'd'])).toEqual([
      { time: '08:00', members: ['d'] },
      { time: '09:00', members: ['e'] },
      { time: '10:00', members: ['a'] },
      { time: '12:00', members: ['d'] },
      { time: '18:00', members: ['e'] },
    ]);
    expect(slotBuckets({ mode: 'daily', times: ['09:00'] }, ['z', 'y', 'x'])).toEqual([
      { time: '09:00', members: ['z', 'y', 'x'] },
    ]);
    expect(slotBuckets(schedule, [])).toEqual([]);
  });

  it('builds override keys like the server', () => {
    expect(overrideKeyOfLink('3F2504E0-4F89-11D3-9A0C-0305E82C3301')).toBe(
      '3f2504e04f8911d39a0c0305e82c3301',
    );
    expect(overrideKeyOfLink('3f2504e04f8911d39a0c0305e82c3301')).toBe(
      '3f2504e04f8911d39a0c0305e82c3301',
    );
  });

  it('overridesFromInput keeps readable non-empty texts and reports bad ones', () => {
    expect(
      overridesFromInput({ a: '10:00, 9:30', b: '', c: '   ', d: 'x', e: '08:00 nope' }),
    ).toEqual({
      overrides: { a: ['09:30', '10:00'], e: ['08:00'] },
      bad: true,
    });
    expect(overridesFromInput({ a: '10:00', b: null, c: undefined })).toEqual({
      overrides: { a: ['10:00'] },
      bad: false,
    });
    expect(overridesFromInput({})).toEqual({ overrides: {}, bad: false });
  });

  it('scheduleCadence summarises slots, posts per day and members with their own times', () => {
    expect(scheduleCadence(schedule, ['a', 'b', 'x'])).toEqual({
      mode: 'daily',
      slots: ['09:00', '18:00'],
      perDay: 1 + 2 + 2,
      overrides: 2,
    });
    expect(scheduleCadence({ mode: 'drip', dripCount: 3 }, ['a'])).toEqual({
      mode: 'drip',
      slots: ['09:00', '15:00', '21:00'],
      perDay: 3,
      overrides: 0,
    });
  });
});

describe('previewDays', () => {
  const members = ['m1', 'm2'];

  it('lists the slots of each day the schedule runs on', () => {
    const days = previewDays({ mode: 'daily', times: ['09:00', '18:00'] }, members, THU, 3);
    expect(days.map((d) => d.date)).toEqual([THU, FRI, SAT]);
    expect(days.map((d) => d.weekday)).toEqual([4, 5, 6]);
    for (const d of days) {
      expect(d.matches).toBe(true);
      expect(d.tasks).toBe(4);
      expect(d.slots).toEqual([
        { time: '09:00', members },
        { time: '18:00', members },
      ]);
    }
  });

  it('leaves days the schedule does not run on empty', () => {
    const days = previewDays({ mode: 'weekend', times: ['10:00'] }, members, THU, 7);
    expect(days.map((d) => d.matches)).toEqual([false, true, true, true, false, false, false]);
    expect(days.map((d) => d.tasks)).toEqual([0, 2, 2, 2, 0, 0, 0]);
    expect(days[0].slots).toEqual([]);
  });

  it('skips days before the start date', () => {
    const days = previewDays({ mode: 'daily', times: ['10:00'], startDate: FRI }, members, THU, 3);
    expect(days.map((d) => d.matches)).toEqual([false, true, true]);
  });

  it('shows a once schedule on its day only', () => {
    const days = previewDays({ mode: 'once', startDate: SAT, onceTime: '14:00' }, members, THU, 14);
    expect(days.filter((d) => d.matches).map((d) => d.date)).toEqual([SAT]);
    expect(days[2].slots).toEqual([{ time: '14:00', members }]);
  });

  it('follows member overrides', () => {
    const days = previewDays(
      { mode: 'daily', times: ['09:00'], overrides: { m2: ['20:00', '21:00'] } },
      members,
      THU,
      1,
    );
    expect(days[0].slots).toEqual([
      { time: '09:00', members: ['m1'] },
      { time: '20:00', members: ['m2'] },
      { time: '21:00', members: ['m2'] },
    ]);
    expect(days[0].tasks).toBe(3);
  });

  it('has no slots without members', () => {
    const days = previewDays({ mode: 'daily', times: ['09:00'] }, [], THU, 2);
    expect(days.map((d) => d.tasks)).toEqual([0, 0]);
    expect(days[0].slots).toEqual([]);
    expect(days[0].matches).toBe(true);
  });

  it('crosses month and year ends', () => {
    expect(
      previewDays({ mode: 'daily', times: ['09:00'] }, members, '2026-12-30', 4).map((d) => d.date),
    ).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('returns nothing for a bad start or count, and at most a year', () => {
    const s: ScheduleLike = { mode: 'daily', times: ['09:00'] };
    expect(previewDays(s, members, 'x', 3)).toEqual([]);
    expect(previewDays(s, members, THU, 0)).toEqual([]);
    expect(previewDays(s, members, THU, -4)).toEqual([]);
    expect(previewDays(s, members, THU, Number.NaN)).toEqual([]);
    expect(previewDays(s, members, THU, 5000)).toHaveLength(366);
  });

  it('gives each day its own copy of the slots', () => {
    const days = previewDays({ mode: 'daily', times: ['09:00'] }, members, THU, 2);
    days[0].slots[0].members.push('extra');
    expect(days[1].slots[0].members).toEqual(members);
  });
});

describe('bestHours', () => {
  it('returns the three busiest hours, sorted by time', () => {
    const times = [
      '19:05',
      '19:40',
      '19:59',
      '09:10',
      '09:30',
      '09:31',
      '09:32',
      '12:00',
      '12:01',
      '12:02',
      '07:15',
      '21:00',
    ];
    expect(bestHours(times)).toEqual(['09:00', '12:00', '19:00']);
  });

  it('prefers the hour seen first on ties', () => {
    expect(bestHours(['10:00', '11:00', '12:00', '13:00'])).toEqual(['10:00', '11:00', '12:00']);
    expect(bestHours(['13:00', '12:00', '11:00', '10:00'])).toEqual(['11:00', '12:00', '13:00']);
  });

  it('returns fewer when there are fewer hours', () => {
    expect(bestHours(['10:30', '10:45'])).toEqual(['10:00']);
    expect(bestHours([])).toEqual([]);
  });

  it('skips unreadable times and accepts a limit', () => {
    expect(bestHours(['x', '', '09:15'])).toEqual(['09:00']);
    expect(bestHours(['09:00', '09:10', '10:00', '11:00'], 1)).toEqual(['09:00']);
    expect(bestHours(['09:00'], 0)).toEqual([]);
    expect(bestHours(['09:00'], -1)).toEqual([]);
  });
});
