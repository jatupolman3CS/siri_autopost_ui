import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WORKSPACE, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { INPUT_LIMITS } from '../http/input-limits';
import { DraftStore, blankDraft } from './draft.store';
import { WorkspaceStore } from './workspace.store';

describe('DraftStore', () => {
  let http: HttpTestingController;
  let draft: DraftStore;

  beforeEach(async () => {
    http = provideApiTesting();
    draft = TestBed.inject(DraftStore);
    await signIn(http);
  });

  afterEach(() => http.verify());

  it('starts blank: no text, no media, no collection', () => {
    expect(draft.draft()).toEqual(blankDraft());
    expect(draft.draft()).toEqual({ text: '', media: [], collectionIds: [] });
    expect(draft.hasDraft()).toBe(false);
  });

  it('has a draft once there is text or media, not for blanks or a collection alone', () => {
    draft.patch({ text: '   ' });
    expect(draft.hasDraft()).toBe(false);
    draft.patch({ collectionIds: ['a'] });
    expect(draft.hasDraft()).toBe(false);
    draft.patch({ text: 'hello' });
    expect(draft.hasDraft()).toBe(true);
    draft.reset();
    draft.addMedia('m1');
    expect(draft.hasDraft()).toBe(true);
  });

  it('drops the draft when another workspace is opened: its media and collections mean nothing there', async () => {
    draft.patch({ text: 'x', media: ['m1'], collectionIds: ['a'] });
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    ws.switchTo('ws-2');
    await settle();
    expect(draft.draft()).toEqual(blankDraft());
    for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
  });

  it('has no post being edited: only a NEW post lives here', () => {
    expect(Object.keys(draft.draft()).sort()).toEqual(['collectionIds', 'media', 'text']);
  });

  describe('collections', () => {
    it('keeps a list of collection ids, and startNew puts a blank post in them', () => {
      draft.patch({ text: 'old', media: ['m1'] });
      draft.startNew(['b', 'a']);
      expect(draft.draft()).toEqual({ text: '', media: [], collectionIds: ['b', 'a'] });
      draft.startNew();
      expect(draft.draft()).toEqual(blankDraft());
    });

    it('copies the list it is given', () => {
      const ids = ['a'];
      draft.startNew(ids);
      ids.push('b');
      expect(draft.draft().collectionIds).toEqual(['a']);
    });
  });

  describe('open(): what the address of the editor asks for', () => {
    it('keeps the draft as it is without a collection in the address', () => {
      draft.patch({ text: 'typed', collectionIds: ['a', 'b'] });
      expect(draft.open(undefined)).toBe('kept');
      expect(draft.open(null)).toBe('kept');
      expect(draft.open('')).toBe('kept');
      expect(draft.draft()).toEqual({ text: 'typed', media: [], collectionIds: ['a', 'b'] });
    });

    it('makes the collection of the address THE collection of the draft and keeps the text', () => {
      draft.patch({ text: 'half written', media: ['m1'], collectionIds: ['a', 'b'] });
      expect(draft.open('c')).toBe('started');
      expect(draft.draft()).toEqual({ text: 'half written', media: ['m1'], collectionIds: ['c'] });
    });

    it('does nothing when the draft is already only in that collection', () => {
      draft.patch({ collectionIds: ['c'] });
      const before = draft.draft();
      expect(draft.open('c')).toBe('kept');
      expect(draft.draft()).toBe(before);
    });

    it('preselects the collection of a blank draft', () => {
      expect(draft.open('a')).toBe('started');
      expect(draft.draft().collectionIds).toEqual(['a']);
    });
  });

  describe('text', () => {
    it('adds text on a new line and cuts it at the most the API takes', () => {
      draft.patch({ text: 'first' });
      draft.appendText('second');
      expect(draft.draft().text).toBe('first\nsecond');
      draft.patch({ text: 'x'.repeat(INPUT_LIMITS.postText - 3) });
      draft.appendText('abcdef');
      expect(draft.draft().text.length).toBe(INPUT_LIMITS.postText);
    });

    it('starts the text when there is none yet, without a blank first line', () => {
      draft.appendText('only');
      expect(draft.draft().text).toBe('only');
    });
  });

  describe('media', () => {
    it('refuses a 21st file, and attaching one again changes nothing', () => {
      for (let i = 0; i < INPUT_LIMITS.postMedia; i++) expect(draft.addMedia('m' + i)).toBe(true);
      expect(draft.addMedia('one-too-many')).toBe(false);
      expect(draft.addMedia('m0')).toBe(true);
      expect(draft.draft().media.length).toBe(INPUT_LIMITS.postMedia);
    });

    it('toggles a file on and off, and reports a refusal at the limit', () => {
      expect(draft.toggleMedia('m1')).toBe(true);
      expect(draft.draft().media).toEqual(['m1']);
      expect(draft.toggleMedia('m1')).toBe(true);
      expect(draft.draft().media).toEqual([]);
      for (let i = 0; i < INPUT_LIMITS.postMedia; i++) draft.addMedia('m' + i);
      expect(draft.toggleMedia('extra')).toBe(false);
      expect(draft.toggleMedia('m3')).toBe(true); // taking one off always works
    });

    it('takes deleted library files off the draft, and leaves it alone when none of them is there', () => {
      draft.patch({ media: ['m1', 'm2', 'm3'] });
      draft.dropMedia(['m2', 'zzz']);
      expect(draft.draft().media).toEqual(['m1', 'm3']);
      const before = draft.draft();
      draft.dropMedia(['nope']);
      expect(draft.draft()).toBe(before);
    });
  });
});
