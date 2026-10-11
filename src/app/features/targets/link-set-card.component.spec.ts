import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiAccount, ApiDevice, ApiRole } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { ACCOUNTS, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { FB_CONNECTED, apiDevice, apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { LinkSetCardComponent } from './link-set-card.component';

// Which extension posts a set: the "post as" row, its automatic label and the line under it. A set that names an
// extension is posted by that browser and no other; a set with no choice goes to the first connected account.

/** The account of a browser that was unbound: it comes first in the list but cannot post. */
const OLD_PC = ACCOUNTS[0];
const LAPTOP: ApiAccount = { ...FB_CONNECTED, id: 'acc-fb2', name: 'Facebook · Laptop' };
const LAPTOP_DEVICE = apiDevice({ id: 'dev-2', name: 'Laptop', accountId: 'acc-fb2' });

describe('LinkSetCardComponent: who posts the set', () => {
  let http: HttpTestingController;

  async function open(
    opts: {
      /** The accounts the API lists, in its order (default: the unbound Old PC, Laptop, Shop PC). */
      accounts?: ApiAccount[];
      devices?: ApiDevice[];
      /** The extension (account id) the set names; null = automatic. */
      postAs?: string | null;
      /** Simple mode off: the "more options" start open. */
      simple?: boolean;
      role?: ApiRole;
      /** The set's rules for its groups (default: random order, no limit from the set). */
      rules?: { randomOrder?: boolean; dailyPerGroup?: number };
      /** The link's own max per day. */
      linkMax?: number;
    } = {},
  ) {
    http = provideApiTesting({
      imports: [LinkSetCardComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    const set = apiLinkSet({
      id: 's1',
      name: 'siri',
      links: [apiLink({ id: 'a', dailyMax: opts.linkMax ?? 0 })],
      postAsAccountId: opts.postAs ?? null,
      ...opts.rules,
    });
    const devices = opts.devices ?? [LAPTOP_DEVICE, apiDevice()];
    await signIn(http, { workspace: { role: opts.role ?? 'owner' }, linkSets: [set], devices });
    TestBed.inject(AccountsStore).list.set(opts.accounts ?? [OLD_PC, LAPTOP, FB_CONNECTED]);
    if (opts.simple === false) TestBed.inject(LinkSetsStore).setMore('s1', true);
    const fixture = TestBed.createComponent(LinkSetCardComponent);
    fixture.componentRef.setInput('set', set);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const postAs = (el: HTMLElement) => el.querySelector<HTMLElement>('.postas');
  const options = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLOptionElement>('.postas option')].map((o) => o.textContent);
  const status = (el: HTMLElement) => el.querySelector<HTMLElement>('.postas .status');
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('the "post as" row', () => {
    it('shows in simple mode when two extensions are connected', async () => {
      const { el } = await open();
      expect(postAs(el)).not.toBeNull();
      // The row sits outside the folded "more options", whose own parts stay folded.
      expect(el.querySelector('.eg')).toBeNull();
      expect(el.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe(
        'false',
      );
    });

    it('stays hidden in simple mode with one extension and no choice', async () => {
      const { fixture, el } = await open({ accounts: [OLD_PC, FB_CONNECTED] });
      expect(postAs(el)).toBeNull();
      // The extra, unbound account does not count: only a browser that posts is a choice.
      TestBed.inject(LinkSetsStore).setMore('s1', true);
      fixture.detectChanges();
      expect(postAs(el)).not.toBeNull();
    });

    it('shows in simple mode when the set already names an extension, even with one connected', async () => {
      const { el } = await open({ accounts: [FB_CONNECTED], postAs: 'acc-fb' });
      expect(postAs(el)).not.toBeNull();
      expect(el.querySelector<HTMLSelectElement>('.postas select')?.value).toBe('acc-fb');
    });

    it('follows the connected extensions as they come and go', async () => {
      const { fixture, el } = await open({ accounts: [FB_CONNECTED] });
      expect(postAs(el)).toBeNull();
      TestBed.inject(AccountsStore).list.set([FB_CONNECTED, LAPTOP]);
      fixture.detectChanges();
      expect(postAs(el)).not.toBeNull();
      TestBed.inject(AccountsStore).list.set([FB_CONNECTED, { ...LAPTOP, connected: false }]);
      fixture.detectChanges();
      expect(postAs(el)).toBeNull();
    });
  });

  // 2026-10-10: one link set, one extension. With two or more extensions there is no "first one" any more: a set that
  // names none shows a prompt, says it posts nothing yet, and the extensions are listed in the order of the accounts.
  describe('a set that names no extension', () => {
    it('with several extensions has a prompt instead of an automatic choice, then the connected ones', async () => {
      const { el } = await open();
      expect(options(el)).toEqual([t().api.flow.postAsPick, 'Laptop', 'Shop PC']);
    });

    it('follows the order of the accounts and a rename of the browser', async () => {
      const { fixture, el } = await open({ accounts: [FB_CONNECTED, LAPTOP] });
      expect(options(el)).toEqual([t().api.flow.postAsPick, 'Shop PC', 'Laptop']);
      TestBed.inject(DevicesStore).list.set([LAPTOP_DEVICE, apiDevice({ name: 'Front desk' })]);
      fixture.detectChanges();
      expect(options(el)).toEqual([t().api.flow.postAsPick, 'Front desk', 'Laptop']);
    });

    it('says it in English too', async () => {
      const { fixture, el } = await open();
      TestBed.inject(I18nService).setLang('en');
      fixture.detectChanges();
      expect(options(el)[0]).toBe('Choose the extension that posts this set…');
    });

    it('drops the prompt once an extension is chosen', async () => {
      const { el } = await open({ postAs: 'acc-fb' });
      expect(options(el)).toEqual(['Laptop', 'Shop PC']);
    });

    it('keeps the plain label when no extension is connected', async () => {
      const { el } = await open({ accounts: [OLD_PC], devices: [], simple: false });
      expect(options(el)).toEqual([t().api.flow.postAsAuto]);
      expect(status(el)).toBeNull();
    });

    it('with two or more extensions warns that nothing is posted until an extension is chosen', async () => {
      const { el } = await open();
      const line = status(el)!;
      expect(text(line)).toBe(t().api.flow.postAsNone);
      expect(line.classList.contains('warn')).toBe(true);
      expect(line.classList.contains('ok')).toBe(false);
    });

    it('does not take "no extension" back once two or more are connected', async () => {
      const { fixture, el } = await open({ postAs: 'acc-fb' });
      const select = el.querySelector<HTMLSelectElement>('.postas select')!;
      select.value = '';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(select.value).not.toBe('');
    });

    it('with one extension has no line under the select', async () => {
      const { el } = await open({ accounts: [FB_CONNECTED], simple: false });
      expect(status(el)).toBeNull();
    });
  });

  describe('a set that names an extension', () => {
    it('says the extension is ready when its browser is online', async () => {
      const { el } = await open({ postAs: 'acc-fb2' });
      const line = status(el)!;
      expect(text(line)).toBe(t().api.flow.postAsReady);
      expect(line.classList.contains('ok')).toBe(true);
      expect(el.querySelector('.postas .callout')).toBeNull();
    });

    it('warns that the set waits and goes to no other extension when it is not connected', async () => {
      const { el } = await open({ postAs: 'acc-page' });
      const line = status(el)!;
      expect(line.classList.contains('callout')).toBe(true);
      expect(line.classList.contains('warn')).toBe(true);
      expect(line.textContent).toContain(t().api.flow.postAsWaiting);
      // The chosen extension stays in the select, marked, instead of silently showing another one.
      const select = el.querySelector<HTMLSelectElement>('.postas select')!;
      expect(select.value).toBe('acc-page');
      expect([...select.options].at(-1)?.textContent).toBe(`Old PC · ${t().api.unboundAccount}`);
      // The owner gets the way to pair that browser again.
      const link = line.querySelector<HTMLAnchorElement>('a')!;
      expect(link.textContent).toBe(t().ov.pair);
      expect(link.getAttribute('href')).toBe('/app/team?pair=1');
    });

    it('offers no pairing link to someone who cannot pair devices', async () => {
      const { el } = await open({ postAs: 'acc-page', role: 'viewer' });
      expect(status(el)?.textContent).toContain(t().api.flow.postAsWaiting);
      expect(status(el)?.querySelector('a')).toBeNull();
    });

    it('warns that the posts wait when it is connected but its browser is offline', async () => {
      const { el } = await open({
        postAs: 'acc-fb',
        devices: [LAPTOP_DEVICE, apiDevice({ online: false })],
      });
      const line = status(el)!;
      expect(text(line)).toBe(t().api.flow.postAsOffline);
      expect(line.classList.contains('warn')).toBe(true);
      // Softer than the unbound case: a line, not the warning box, and no unbound option.
      expect(line.classList.contains('callout')).toBe(false);
      expect(options(el)).not.toContain(`Old PC · ${t().api.unboundAccount}`);
    });

    it('follows the browser going offline and coming back', async () => {
      const { fixture, el } = await open({ postAs: 'acc-fb2' });
      expect(text(status(el))).toBe(t().api.flow.postAsReady);
      TestBed.inject(DevicesStore).list.set([{ ...LAPTOP_DEVICE, online: false }, apiDevice()]);
      fixture.detectChanges();
      expect(text(status(el))).toBe(t().api.flow.postAsOffline);
      TestBed.inject(DevicesStore).list.set([LAPTOP_DEVICE, apiDevice()]);
      fixture.detectChanges();
      expect(text(status(el))).toBe(t().api.flow.postAsReady);
    });

    it('says nothing until the accounts have arrived, so a reload does not flash the warning', async () => {
      const { fixture, el } = await open({ postAs: 'acc-fb2', accounts: [] });
      TestBed.inject(AccountsStore).loaded.set(false);
      fixture.detectChanges();
      expect(postAs(el)).not.toBeNull();
      expect(status(el)).toBeNull();
      TestBed.inject(AccountsStore).loaded.set(true);
      fixture.detectChanges();
      expect(status(el)?.classList.contains('callout')).toBe(true);
    });
  });

  describe('the rules for the groups of the set', () => {
    const SET_URL = `/api/workspaces/${WS}/link-sets/s1`;
    const randomBox = (el: HTMLElement) =>
      el.querySelector<HTMLInputElement>('.rules app-checkbox input');
    const capInput = (el: HTMLElement) =>
      el.querySelector<HTMLInputElement>('.rules input[type=number]');
    // Saving a rule makes the schedules of the set queue again, so the card asks for the schedules (and their posts).
    const answerSchedules = () => http.match((r) => r.method === 'GET').forEach((r) => r.flush([]));

    it('shows random order on and no limit from the set by default', async () => {
      const { el } = await open();
      expect(text(el.querySelector('.rules .fw6'))).toBe(t().api.flow.setRulesTitle);
      expect(randomBox(el)?.checked).toBe(true);
      expect(capInput(el)?.value).toBe('0');
      expect(capInput(el)?.max).toBe('50');
    });

    it('shows what the set holds', async () => {
      const { el } = await open({ rules: { randomOrder: false, dailyPerGroup: 3 } });
      expect(randomBox(el)?.checked).toBe(false);
      expect(capInput(el)?.value).toBe('3');
    });

    it('saves the order switch with the complete set', async () => {
      const { el } = await open();
      randomBox(el)!.click();
      const req = http.expectOne({ method: 'PUT', url: SET_URL });
      expect(req.request.body).toEqual({
        name: 'siri',
        postAsAccountId: null,
        accountIds: [],
        randomOrder: false,
        dailyPerGroup: 0,
      });
      req.flush(apiLinkSet({ id: 's1', name: 'siri', randomOrder: false }));
      await settle();
      answerSchedules();
    });

    it('saves the posts a day per group, brought into range', async () => {
      const { el } = await open();
      const input = capInput(el)!;
      input.value = '99';
      input.dispatchEvent(new Event('change'));
      expect(input.value).toBe('50');
      const req = http.expectOne({ method: 'PUT', url: SET_URL });
      expect(req.request.body.dailyPerGroup).toBe(50);
      expect(req.request.body.randomOrder).toBe(true);
      req.flush(apiLinkSet({ id: 's1', name: 'siri', dailyPerGroup: 50 }));
      await settle();
      answerSchedules();
    });

    it('sends nothing when the number did not change', async () => {
      const { el } = await open({ rules: { dailyPerGroup: 2 } });
      const input = capInput(el)!;
      input.value = '2';
      input.dispatchEvent(new Event('change'));
      http.expectNone({ method: 'PUT', url: SET_URL });
    });

    it('is switched off for a viewer', async () => {
      const { el } = await open({ role: 'viewer' });
      expect(randomBox(el)?.disabled).toBe(true);
      expect(capInput(el)?.disabled).toBe(true);
    });

    it('tells a link with no limit of its own that it follows the set', async () => {
      const { el } = await open({ rules: { dailyPerGroup: 2 } });
      expect(text(el.querySelector('app-link-row .follow'))).toBe(
        fmt(t().api.flow.linkMaxFollowsSet, { n: 2 }),
      );
    });

    it('says nothing on a link with a limit of its own', async () => {
      const { el } = await open({ rules: { dailyPerGroup: 2 }, linkMax: 1 });
      expect(el.querySelector('app-link-row .follow')).toBeNull();
    });

    it('says nothing on a link when the set has no limit', async () => {
      const { el } = await open();
      expect(el.querySelector('app-link-row .follow')).toBeNull();
    });
  });
});
