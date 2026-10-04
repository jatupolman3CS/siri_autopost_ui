import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal.component';

@Component({
  imports: [ModalComponent],
  template: `
    <button id="opener" type="button" (click)="show.set(true)">open</button>
    <app-modal
      [open]="show()"
      [title]="title()"
      [closable]="closable()"
      (closed)="show.set(false); closes = closes + 1"
    >
      <input id="first" />
      <input id="secret" type="hidden" />
      <div hidden><button id="hid" type="button">hidden</button></div>
      <button id="dis" type="button" disabled>disabled</button>
      <button id="skip" type="button" tabindex="-1">skipped</button>
      <div modal-footer>
        <button id="cancel" type="button">cancel</button>
        <button id="ok" type="button">ok</button>
        <button id="tail-dis" type="button" disabled>disabled</button>
        <input id="tail-hidden" type="hidden" />
        <button id="tail-skip" type="button" tabindex="-1">skipped</button>
        <div hidden><button id="tail-hid" type="button">hidden</button></div>
      </div>
    </app-modal>
  `,
})
class HostComponent {
  readonly show = signal(false);
  readonly title = signal('Edit post');
  readonly closable = signal(true);
  closes = 0;
}

@Component({
  imports: [ModalComponent],
  template: `
    <app-modal [open]="outer()" title="Outer" (closed)="outer.set(false)">
      <input id="outer-input" />
      <app-modal [open]="inner()" title="Inner" (closed)="inner.set(false)">
        <input id="inner-input" />
      </app-modal>
    </app-modal>
  `,
})
class StackedComponent {
  readonly outer = signal(false);
  readonly inner = signal(false);
}

describe('ModalComponent', () => {
  async function setup(): Promise<{
    fixture: ComponentFixture<HostComponent>;
    el: HTMLElement;
    host: HostComponent;
  }> {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement, host: fixture.componentInstance };
  }

  const key = (name: string, shift = false) => {
    const e = new KeyboardEvent('keydown', {
      key: name,
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    document.activeElement?.dispatchEvent(e);
    return e;
  };
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  const panel = () => document.querySelector<HTMLElement>('.su-modal-panel');

  async function show(fixture: ComponentFixture<HostComponent>): Promise<void> {
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function hide(fixture: ComponentFixture<HostComponent>): Promise<void> {
    fixture.componentInstance.show.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('as a dialog', () => {
    it('is drawn only while open', async () => {
      const { fixture } = await setup();
      expect(panel()).toBeNull();
      await show(fixture);
      expect(panel()).not.toBeNull();
      await hide(fixture);
      expect(panel()).toBeNull();
    });

    it('has the dialog role, is modal and is named by its title', async () => {
      const { fixture } = await setup();
      await show(fixture);
      const p = panel()!;
      expect(p.getAttribute('role')).toBe('dialog');
      expect(p.getAttribute('aria-modal')).toBe('true');
      const heading = document.getElementById(p.getAttribute('aria-labelledby')!);
      expect(heading?.textContent).toBe('Edit post');
      expect(heading?.classList.contains('su-modal-title')).toBe(true);
    });

    it('does not point at an empty heading when there is no title', async () => {
      const { fixture, host } = await setup();
      host.title.set('');
      await show(fixture);
      expect(panel()!.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('gives every dialog its own heading id', async () => {
      TestBed.configureTestingModule({ imports: [StackedComponent] });
      const fixture = TestBed.createComponent(StackedComponent);
      fixture.componentInstance.outer.set(true);
      fixture.componentInstance.inner.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const ids = [...document.querySelectorAll('.su-modal-panel')].map((p) =>
        p.getAttribute('aria-labelledby'),
      );
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });
  });

  describe('focus', () => {
    it('moves into the dialog when it opens: the first control of the body, not the close button', async () => {
      const { fixture } = await setup();
      byId('opener').focus();
      await show(fixture);
      expect(document.activeElement).toBe(byId('first'));
    });

    it('goes back to what had it before when it closes', async () => {
      const { fixture } = await setup();
      byId('opener').focus();
      await show(fixture);
      expect(document.activeElement).toBe(byId('first'));
      await hide(fixture);
      expect(document.activeElement).toBe(byId('opener'));
    });

    it('goes back after a close through the dialog itself (Esc)', async () => {
      const { fixture, host } = await setup();
      byId('opener').focus();
      await show(fixture);
      key('Escape');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.closes).toBe(1);
      expect(document.activeElement).toBe(byId('opener'));
    });

    it('leaves the focus alone when the person has moved on to another control', async () => {
      const { fixture } = await setup();
      byId('opener').focus();
      await show(fixture);
      const other = document.createElement('button');
      document.body.append(other);
      other.focus();
      await hide(fixture);
      expect(document.activeElement).toBe(other);
      other.remove();
    });

    it('focuses the close button when the body has nothing to focus', async () => {
      TestBed.configureTestingModule({ imports: [ModalComponent] });
      const fixture = TestBed.createComponent(ModalComponent);
      fixture.componentRef.setInput('open', true);
      fixture.componentRef.setInput('title', 'Only text');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement?.classList.contains('su-x')).toBe(true);
    });

    it('focuses the panel itself when nothing in it can be focused', async () => {
      TestBed.configureTestingModule({ imports: [ModalComponent] });
      const fixture = TestBed.createComponent(ModalComponent);
      fixture.componentRef.setInput('open', true);
      fixture.componentRef.setInput('closable', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(panel());
      const e = key('Tab');
      expect(e.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(panel());
    });
  });

  describe('the Tab key', () => {
    it('goes from the last control to the first, and back with Shift+Tab', async () => {
      const { fixture } = await setup();
      await show(fixture);
      // The close button comes first in the dialog, the footer buttons last.
      const first = document.querySelector<HTMLElement>('.su-x')!;
      byId('ok').focus();
      const forward = key('Tab');
      expect(forward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);
      const backward = key('Tab', true);
      expect(backward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(byId('ok'));
    });

    it('lets the browser move between controls in the middle', async () => {
      const { fixture } = await setup();
      await show(fixture);
      byId('first').focus();
      expect(key('Tab').defaultPrevented).toBe(false);
      expect(key('Tab', true).defaultPrevented).toBe(false);
    });

    it('ignores disabled, hidden and tabindex -1 controls when it looks for the ends', async () => {
      const { fixture } = await setup();
      await show(fixture);
      // The last real control is "ok", although other things follow it in the footer.
      byId('ok').focus();
      key('Tab');
      expect(document.activeElement?.classList.contains('su-x')).toBe(true);
      key('Tab', true);
      expect(document.activeElement).toBe(byId('ok'));
    });

    it('brings the focus back in when it is outside the dialog', async () => {
      const { fixture } = await setup();
      await show(fixture);
      byId('opener').focus();
      expect(key('Tab').defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(document.querySelector('.su-x'));
      byId('opener').focus();
      expect(key('Tab', true).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(byId('ok'));
    });

    it('does nothing while the dialog is closed', async () => {
      await setup();
      byId('opener').focus();
      expect(key('Tab').defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(byId('opener'));
    });
  });

  describe('closing', () => {
    it('closes on Esc', async () => {
      const { fixture, host } = await setup();
      await show(fixture);
      key('Escape');
      expect(host.closes).toBe(1);
    });

    it('does not close on Esc when it is not closable, and has no close button', async () => {
      const { fixture, host } = await setup();
      host.closable.set(false);
      await show(fixture);
      key('Escape');
      expect(host.closes).toBe(0);
      expect(document.querySelector('.su-x')).toBeNull();
      expect(panel()).not.toBeNull();
    });

    it('ignores Esc while closed', async () => {
      const { host } = await setup();
      key('Escape');
      expect(host.closes).toBe(0);
    });

    it('closes from the close button and from a click on the backdrop, not from one inside', async () => {
      const { fixture, host } = await setup();
      await show(fixture);
      panel()!.click();
      byId('first').click();
      expect(host.closes).toBe(0);
      document.querySelector<HTMLElement>('.su-modal-overlay')!.click();
      expect(host.closes).toBe(1);
      await show(fixture);
      document.querySelector<HTMLElement>('.su-x')!.click();
      expect(host.closes).toBe(2);
    });

    it('does not close on the backdrop when it is not closable', async () => {
      const { fixture, host } = await setup();
      host.closable.set(false);
      await show(fixture);
      document.querySelector<HTMLElement>('.su-modal-overlay')!.click();
      expect(host.closes).toBe(0);
    });

    it('lets only the dialog on top answer Esc and Tab', async () => {
      TestBed.configureTestingModule({ imports: [StackedComponent] });
      const fixture = TestBed.createComponent(StackedComponent);
      const host = fixture.componentInstance;
      host.outer.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      host.inner.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(document.activeElement?.id).toBe('inner-input');

      key('Escape');
      expect(host.inner()).toBe(false);
      expect(host.outer()).toBe(true);
      fixture.detectChanges();
      await fixture.whenStable();
      // The outer one is on top again, with the focus where it was.
      expect(document.activeElement?.id).toBe('outer-input');
      key('Escape');
      expect(host.outer()).toBe(false);
    });
  });

  it('forgets a dialog that is destroyed while open, so the next one answers Esc', async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const first = TestBed.createComponent(HostComponent);
    first.componentInstance.show.set(true);
    first.detectChanges();
    await first.whenStable();
    first.destroy();

    const second = TestBed.createComponent(HostComponent);
    second.componentInstance.show.set(true);
    second.detectChanges();
    await second.whenStable();
    second.detectChanges();
    key('Escape');
    expect(second.componentInstance.closes).toBe(1);
  });
});
