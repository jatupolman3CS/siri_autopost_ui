import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceStore } from '../../core/data/workspace.store';
import '../../core/i18n/i18n.engine';
import { I18nService } from '../../core/i18n/i18n.service';
import { answerWorkspaceLoads, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { device } from '../../testing/test-post.fixtures';
import { ExtensionPageComponent } from './extension-page.component';

describe('ExtensionPageComponent', () => {
  let http: HttpTestingController;
  const t = () => TestBed.inject(I18nService).t();
  const inHours = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();

  async function open(devices: ReturnType<typeof device>[]) {
    http = provideApiTesting({
      imports: [ExtensionPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(WorkspaceStore);
    await signIn(http, { devices });
    const fixture = TestBed.createComponent(ExtensionPageComponent);
    fixture.detectChanges();
    await settle();
    answerWorkspaceLoads(http, { devices });
    await settle();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('shows the popup preview with the page title', async () => {
    const el = await open([device()]);
    expect(el.querySelector('h1')!.textContent).toBe(t().ext.title);
    expect(el.querySelector('.pop-head')).not.toBeNull();
    expect(el.querySelector('.auto')).toBeNull();
  });

  it('says in the popup that the engine paused the browser, until when and why', async () => {
    const el = await open([
      device({ autoPausedUntil: inHours(1), autoPauseReason: 'Facebook เตือนว่าโพสต์ถี่เกินไป' }),
    ]);
    const line = el.querySelector('.pop-body .auto')!;
    expect(line.textContent).toContain('Facebook เตือนว่าโพสต์ถี่เกินไป');
    expect(line.textContent).toMatch(/พักอัตโนมัติถึง/);
    // The header says it as well.
    expect(el.querySelector('.pop-head .small')!.textContent).toBe(t().api.engine.devAutoPausedTag);
  });

  it('forgets a pause that has run out', async () => {
    const el = await open([device({ autoPausedUntil: inHours(-1), autoPauseReason: 'เก่า' })]);
    expect(el.querySelector('.auto')).toBeNull();
    expect(el.querySelector('.pop-head .small')!.textContent).not.toBe(
      t().api.engine.devAutoPausedTag,
    );
  });
});
