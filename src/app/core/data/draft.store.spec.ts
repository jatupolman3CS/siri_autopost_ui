import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WORKSPACE, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { INPUT_LIMITS } from '../http/input-limits';
import { CollectionsStore } from './collections.store';
import { DraftStore, blankDraft } from './draft.store';
import { WorkspaceStore } from './workspace.store';

const a1 = apiCollectionPost({ id: 'a1', text: 'one', mediaIds: ['m1', 'm2'] });
const a2 = apiCollectionPost({ id: 'a2', text: 'two' });
/** A post that sits in both collections. */
const both = apiCollectionPost({ id: 'ab', text: 'in both', collectionIds: ['a', 'b'] });

describe('DraftStore', () => {
  let http: HttpTestingController;
  let draft: DraftStore;
  let collections: CollectionsStore;

  beforeEach(async () => {
    http = provideApiTesting();
    draft = TestBed.inject(DraftStore);
    collections = TestBed.inject(CollectionsStore);
    await signIn(http, {
      collections: [
        apiCollection({ id: 'a', name: 'Condo', posts: [a1, a2, both] }),
        apiCollection({ id: 'b', name: 'Tickets', posts: [both] }),
      ],
    });
  });

  afterEach(() => http.verify());

  it('starts blank', () => {
    expect(draft.draft()).toEqual(blankDraft());
    expect(draft.hasDraft()).toBe(false);
  });

  it('has a draft once there is text or media, not for blanks', () => {
    draft.patch({ text: '   ' });
    expect(draft.hasDraft()).toBe(false);
    draft.patch({ text: 'hello' });
    expect(draft.hasDraft()).toBe(true);
    draft.reset();
    draft.addMedia('m1');
    expect(draft.hasDraft()).toBe(true);
  });

  it('drops the draft when another workspace is opened: its media and post mean nothing there', async () => {
    draft.edit(collections.byId('a')!, a1);
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    ws.switchTo('ws-2');
    await settle();
    expect(draft.draft()).toEqual(blankDraft());
    for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
  });

  describe('which collection a new post goes to', () => {
    it('is the one last saved to, else the open one, else none', () => {
      collections.openId.set('b');
      collections.lastId.set('a');
      draft.startNew();
      expect(draft.draft().collectionId).toBe('a');
      collections.lastId.set(null);
      draft.startNew();
      expect(draft.draft().collectionId).toBe('b');
      collections.openId.set(null);
      draft.startNew();
      expect(draft.draft().collectionId).toBe('');
    });

    it('ignores a collection that does not exist (any more)', () => {
      collections.lastId.set('gone');
      collections.openId.set('b');
      draft.startNew();
      expect(draft.draft().collectionId).toBe('b');
    });

    it('is the one asked for when there is one', () => {
      draft.patch({ text: 'old', postId: 'x' });
      draft.startNew('b');
      expect(draft.draft()).toEqual(blankDraft('b'));
    });
  });

  describe('editing a saved post', () => {
    it('loads its text, media and collection into the draft', () => {
      draft.edit(collections.byId('a')!, a1);
      expect(draft.draft()).toEqual({
        text: 'one',
        media: ['m1', 'm2'],
        collectionId: 'a',
        postId: 'a1',
        errText: '',
        errCol: '',
      });
    });

    it('works on a copy of the media list', () => {
      draft.edit(collections.byId('a')!, a1);
      draft.addMedia('m3');
      expect(a1.mediaIds).toEqual(['m1', 'm2']);
    });
  });

  describe('open(): what the address of the composer asks for', () => {
    it('loads the post asked for', () => {
      expect(draft.open('a', 'a2')).toBe('loaded');
      expect(draft.draft()).toMatchObject({ text: 'two', postId: 'a2', collectionId: 'a' });
    });

    it('opens a post that sits in several collections in the collection the address names', () => {
      expect(draft.open('b', 'ab')).toBe('loaded');
      expect(draft.draft()).toMatchObject({ postId: 'ab', collectionId: 'b' });
      draft.reset();
      expect(draft.open('a', 'ab')).toBe('loaded');
      expect(draft.draft().collectionId).toBe('a');
      draft.reset();
      expect(draft.open(undefined, 'ab')).toBe('loaded');
      expect(draft.draft().collectionId).toBe('a');
    });

    it('finds the post even when the collection in the address is wrong or missing', () => {
      expect(draft.open(undefined, 'a2')).toBe('loaded');
      expect(draft.draft().collectionId).toBe('a');
    });

    it('keeps what was typed when the draft already is that post (a trip to the library and back)', () => {
      draft.open('a', 'a2');
      draft.patch({ text: 'two, rewritten' });
      draft.addMedia('m9');
      expect(draft.open('a', 'a2')).toBe('kept');
      expect(draft.draft()).toMatchObject({ text: 'two, rewritten', media: ['m9'] });
    });

    it('starts a blank post in the asked collection when the post is gone, and says so', () => {
      expect(draft.open('b', 'deleted')).toBe('missing');
      expect(draft.draft()).toEqual(blankDraft('b'));
    });

    it('keeps the text of a new post and only sets the collection', () => {
      draft.patch({ text: 'half written' });
      expect(draft.open('b', undefined)).toBe('started');
      expect(draft.draft()).toMatchObject({
        text: 'half written',
        collectionId: 'b',
        postId: null,
      });
      expect(draft.open('b', undefined)).toBe('kept');
    });

    it('starts blank for a collection when another post was being edited', () => {
      draft.open('a', 'a1');
      expect(draft.open('b', undefined)).toBe('started');
      expect(draft.draft()).toEqual(blankDraft('b'));
    });

    it('with no address parameters keeps the draft, and gives a draft without a collection the default one', () => {
      collections.lastId.set('b');
      draft.patch({ text: 'typed' });
      expect(draft.open(undefined, undefined)).toBe('kept');
      expect(draft.draft()).toMatchObject({ text: 'typed', collectionId: 'b' });
      draft.patch({ collectionId: 'a' });
      draft.open(undefined, undefined);
      expect(draft.draft().collectionId).toBe('a');
    });
  });

  describe('text', () => {
    it('adds text on a new line and cuts it at the most the API takes', () => {
      draft.patch({ text: 'first', errText: 'oops' });
      draft.appendText('second');
      expect(draft.draft()).toMatchObject({ text: 'first\nsecond', errText: '' });
      draft.patch({ text: 'x'.repeat(INPUT_LIMITS.postText - 3) });
      draft.appendText('abcdef');
      expect(draft.draft().text.length).toBe(INPUT_LIMITS.postText);
    });

    it('puts {{code}} in front once, and says so when it is there already', () => {
      draft.patch({ text: 'hello' });
      expect(draft.insertCode()).toBe(true);
      expect(draft.draft().text).toBe('{{code}}\nhello');
      expect(draft.insertCode()).toBe(false);
      expect(draft.draft().text).toBe('{{code}}\nhello');
      // The Thai spelling counts too.
      draft.patch({ text: 'สวัสดี {{ รหัส }}' });
      expect(draft.insertCode()).toBe(false);
    });

    it('puts a sample spintax group in front', () => {
      draft.patch({ text: 'hello' });
      draft.insertSpin('{Hi|Hey} ');
      expect(draft.draft().text).toBe('{Hi|Hey} hello');
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
  });
});
