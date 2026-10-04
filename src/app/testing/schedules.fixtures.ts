import { HttpTestingController } from '@angular/common/http/testing';
import { utcOffsetMinutes } from '../core/flow/schedule-math';
import { ApiSaveSchedule, ApiSchedule, ApiScheduleCreated } from '../core/http/api.service';
import { WS } from './api-testing';

// Fixtures of the schedule specs (store and pages): rows as the API answers them.

export const SCHEDULES_URL = `/api/workspaces/${WS}/schedules`;

export function apiSchedule(over: Partial<ApiSchedule> & { id: string }): ApiSchedule {
  return {
    name: 'Morning posts',
    collectionId: 'c1',
    linkSetId: 's1',
    mode: 'daily',
    times: ['09:00', '18:00'],
    everyHours: 6,
    firstTime: '09:00',
    startDate: '2026-10-01',
    onceTime: '14:00',
    order: 'shuffle',
    dripFrom: '09:00',
    dripTo: '21:00',
    dripCount: 3,
    bumpHours: 0,
    autoDeleteDays: 0,
    overrides: {},
    active: true,
    utcOffsetMinutes: 420,
    slots: ['09:00', '18:00'],
    targetCount: 2,
    perDay: 4,
    usablePosts: 3,
    todayCount: 0,
    nextRunAt: null,
    ...over,
  };
}

export function apiScheduleCreated(
  schedule: ApiSchedule,
  over: Partial<ApiScheduleCreated> = {},
): ApiScheduleCreated {
  return { schedule, created: 28, firstAt: null, lastAt: null, ...over };
}

/** The request body of a daily schedule the builder sends with nothing changed but the two pickers. */
export function saveBody(over: Partial<ApiSaveSchedule> = {}): ApiSaveSchedule {
  return {
    name: null,
    collectionId: 'c1',
    linkSetId: 's1',
    mode: 'daily',
    times: ['09:00', '18:00'],
    everyHours: 6,
    firstTime: '09:00',
    startDate: null,
    onceTime: '14:00',
    order: 'shuffle',
    dripFrom: '09:00',
    dripTo: '21:00',
    dripCount: 3,
    bumpHours: 0,
    autoDeleteDays: 0,
    overrides: {},
    utcOffsetMinutes: utcOffsetMinutes(),
    ...over,
  };
}

/**
 * Answers the reads a schedule change sets off (the queue, the error reports, the collections and the link
 * sets of the workspace) with what is given, or with nothing.
 */
export function answerChangeRefresh(
  http: HttpTestingController,
  data: { posts?: unknown[]; collections?: unknown[]; linkSets?: unknown[] } = {},
): void {
  for (const r of http.match((x) => x.url === `/api/workspaces/${WS}/posts`))
    r.flush(data.posts ?? []);
  for (const r of http.match(`/api/workspaces/${WS}/errors`)) r.flush([]);
  for (const r of http.match(`/api/workspaces/${WS}/collections`)) r.flush(data.collections ?? []);
  for (const r of http.match(`/api/workspaces/${WS}/link-sets`)) r.flush(data.linkSets ?? []);
}
