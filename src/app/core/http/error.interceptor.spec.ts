import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { QUIET } from './api.service';
import { errorInterceptor } from './error.interceptor';
import { HttpContext } from '@angular/common/http';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let notify: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
  });

  afterEach(() => backend.verify());

  const toasts = () => notify.toasts().map((t) => t.message);

  async function fail(status: number, body: object | null, quiet = false): Promise<void> {
    const ctx = quiet ? new HttpContext().set(QUIET, true) : new HttpContext();
    const done = firstValueFrom(http.get('/api/x', { context: ctx })).catch(() => undefined);
    backend.expectOne('/api/x').flush(body, { status, statusText: 'x' });
    await done;
  }

  it('toasts the first field message of a 400 the caller did not handle', async () => {
    await fail(400, {
      title: 'One or more validation errors occurred.',
      errors: { name: ['ชื่อยาวเกิน 120 ตัวอักษร'], other: ['x'] },
    });
    expect(toasts()).toEqual(['ชื่อยาวเกิน 120 ตัวอักษร']);
  });

  it('falls back to the title of a 400 without field messages', async () => {
    await fail(400, { title: 'ค่าที่ส่งมาไม่ถูกต้อง' });
    expect(toasts()).toEqual(['ค่าที่ส่งมาไม่ถูกต้อง']);
  });

  it('leaves a 400 to a caller that sent the request quietly', async () => {
    await fail(400, { title: 'x', errors: { a: ['y'] } }, true);
    expect(toasts()).toEqual([]);
  });

  it('leaves a 401 to the sign-in handling', async () => {
    await fail(401, { title: 'no' });
    expect(toasts()).toEqual([]);
  });

  it('toasts the title of other refusals and a fallback without a body', async () => {
    await fail(403, { title: 'ไม่มีสิทธิ์' });
    await fail(500, null);
    expect(toasts()).toEqual(['ไม่มีสิทธิ์', 'เกิดข้อผิดพลาด (HTTP 500)']);
  });

  it('does not stack the same message twice while it is on screen', async () => {
    await fail(500, { title: 'ล่ม' });
    await fail(500, { title: 'ล่ม' });
    expect(toasts()).toEqual(['ล่ม']);
  });
});
