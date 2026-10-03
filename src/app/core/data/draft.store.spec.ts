import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ACCOUNTS, WORKSPACE, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { INPUT_LIMITS } from '../http/input-limits';
import { AccountsStore } from './accounts.store';
import { DraftStore, blankDraft, canTarget, defaultTargets } from './draft.store';
import { SocialAccount } from './models';
import { WorkspaceStore } from './workspace.store';

describe('defaultTargets', () => {
  it('uses the design default (page groups + Instagram) when nothing is connected', () => {
    expect(defaultTargets(ACCOUNTS)).toEqual({
      targets: { 'acc-page': true, 'acc-ig': true },
      groups: ['G1', 'G2', 'G3'],
    });
  });

  it('prefers the account of a paired browser', () => {
    const paired: SocialAccount = {
      ...ACCOUNTS[0],
      id: 'acc-paired',
      name: 'Facebook · Office PC',
      groups: ['Plants', 'Condos'],
      connected: true,
    };
    expect(defaultTargets([...ACCOUNTS, paired])).toEqual({
      targets: { 'acc-paired': true },
      groups: ['Plants', 'Condos'],
    });
  });

  it('never picks a connected account that has not synced its groups yet', () => {
    const empty: SocialAccount = { ...ACCOUNTS[0], id: 'acc-new', connected: true, groups: [] };
    expect(defaultTargets([empty, ...ACCOUNTS]).targets).toEqual({
      'acc-page': true,
      'acc-ig': true,
    });
  });
});

describe('canTarget', () => {
  const fb = ACCOUNTS[0];

  it('refuses an account that asks for a new login', () => {
    expect(canTarget({ ...fb, health: 'relogin' })).toBe(false);
  });

  it('refuses a connected account without groups: the API would reject it', () => {
    expect(canTarget({ ...fb, connected: true, groups: [] })).toBe(false);
    expect(canTarget({ ...fb, connected: true, groups: ['G1'] })).toBe(true);
  });

  it('accepts sample accounts, with or without groups', () => {
    expect(canTarget({ ...fb, groups: [] })).toBe(true);
    expect(canTarget(ACCOUNTS[1])).toBe(true);
  });
});

describe('DraftStore', () => {
  let http: HttpTestingController;
  let draft: DraftStore;

  beforeEach(async () => {
    http = provideApiTesting();
    draft = TestBed.inject(DraftStore);
    await signIn(http);
  });

  afterEach(() => http.verify());

  it('drops the draft when another workspace is opened: its media and the post being edited are not valid there', async () => {
    draft.patch({
      text: 'for the shop',
      media: ['m1'],
      replaces: 'post-1',
      targets: { 'acc-ig': true },
      autoTargets: false,
    });
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    ws.switchTo('ws-2');
    await settle();
    const d = draft.draft();
    expect(d.text).toBe('');
    expect(d.media).toEqual([]);
    expect(d.replaces).toBeNull();
    expect(d.autoTargets).toBe(true);
    for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
  });

  it('keeps only targets the accounts still allow', async () => {
    draft.patch({ targets: { 'acc-ig': true, 'acc-tt': true }, autoTargets: false });
    // The accounts are read again (a device synced): the targets are checked against the new list.
    TestBed.inject(AccountsStore).list.set([...ACCOUNTS]);
    await settle();
    // acc-tt asks for a new login: it cannot stay selected.
    expect(draft.draft().targets).toEqual({ 'acc-ig': true });
  });

  it('refuses a 21st media file and cuts appended text at the most the API takes', () => {
    for (let i = 0; i < INPUT_LIMITS.postMedia; i++) expect(draft.addMedia('m' + i)).toBe(true);
    expect(draft.addMedia('one-too-many')).toBe(false);
    expect(draft.addMedia('m0')).toBe(true); // already attached: nothing to add
    expect(draft.draft().media.length).toBe(INPUT_LIMITS.postMedia);

    draft.patch({ text: 'x'.repeat(INPUT_LIMITS.postText - 3) });
    draft.appendText('abcdef');
    expect(draft.draft().text.length).toBe(INPUT_LIMITS.postText);
  });

  it('starts blank', () => {
    expect(blankDraft().text).toBe('');
  });
});
