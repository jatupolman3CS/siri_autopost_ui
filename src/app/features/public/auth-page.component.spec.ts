import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../../core/data/session.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { USER, provideApiTesting, settle } from '../../testing/api-testing';
import { AuthPageComponent } from './auth-page.component';

describe('AuthPageComponent', () => {
  let http: HttpTestingController;

  async function open(mode: 'login' | 'signup', inputs: Record<string, unknown> = {}) {
    http = provideApiTesting({
      imports: [AuthPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.componentRef.setInput('mode', mode);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/auth/config').flush({ googleClientId: null });
    await settle();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    const errors = () =>
      [...el.querySelectorAll('.su-field-err')].map((e) => e.textContent!.trim());
    return { fixture, el, type, submit, errors };
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('shows the field message of a 400 under its own field, not always "password min 8"', async () => {
    const { fixture, type, submit, errors } = await open('signup');
    type('input[type=email]', 'long@shop.co');
    type('input[type=password]', 'password1');
    await submit();
    http
      .expectOne('/api/auth/signup')
      .flush(
        { title: 'x', errors: { Email: ['อีเมลยาวเกิน 254 ตัวอักษร'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    fixture.detectChanges();
    expect(errors()).toEqual(['อีเมลยาวเกิน 254 ตัวอักษร']);

    // The password's message, in the server's words, goes under the password.
    type('input[type=password]', 'password22');
    await submit();
    http
      .expectOne('/api/auth/signup')
      .flush(
        { title: 'x', errors: { password: ['รหัสผ่านยาวเกิน 100 ตัวอักษร'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    fixture.detectChanges();
    expect(errors()).toEqual(['รหัสผ่านยาวเกิน 100 ตัวอักษร']);
  });

  it('stops the inputs at what the API accepts', async () => {
    const { el } = await open('signup');
    expect(el.querySelector('input[type=email]')!.getAttribute('maxlength')).toBe('254');
    expect(el.querySelector('input[type=password]')!.getAttribute('maxlength')).toBe('100');
  });

  it('points to the Google button when a password login fails and Google sign-in is on', async () => {
    const { fixture } = await open('login');
    const page = fixture.componentInstance as unknown as {
      googleId: { set(v: string): void };
      explain(e: unknown): [string, string];
    };
    const api = TestBed.inject(I18nService).t().api;
    const wrong = new HttpErrorResponse({ status: 401 });
    expect(page.explain(wrong)).toEqual(['pass', api.authInvalid]);
    page.googleId.set('client-id');
    expect(page.explain(wrong)).toEqual(['pass', `${api.authInvalid} ${api.authTryGoogle}`]);
  });

  it('goes back to the page the person was sent away from', async () => {
    const { type, submit } = await open('login', {
      returnUrl: '/app/billing?checkout=success&session_id=cs_1',
    });
    const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    type('input[type=email]', USER.email);
    type('input[type=password]', 'password1');
    await submit();
    http.expectOne('/api/auth/login').flush({ token: 't', expiresAt: '2099-01-01', user: USER });
    await settle();
    expect(go).toHaveBeenCalledWith('/app/billing?checkout=success&session_id=cs_1');
  });

  it('ignores a return address that is not a page of the app', async () => {
    const { type, submit } = await open('login', { returnUrl: 'https://evil.example/app' });
    const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    type('input[type=email]', USER.email);
    type('input[type=password]', 'password1');
    await submit();
    http.expectOne('/api/auth/login').flush({ token: 't', expiresAt: '2099-01-01', user: USER });
    await settle();
    expect(go).toHaveBeenCalledWith('/app/overview');
  });

  it('says when the stored sign-in could not be checked', async () => {
    http = provideApiTesting({
      imports: [AuthPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(SessionStore).restoreFailed.set(true);
    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/auth/config').flush({ googleClientId: null });
    await settle();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=status]')).not.toBeNull();
  });
});
