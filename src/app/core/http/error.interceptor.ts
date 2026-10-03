import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { QUIET } from './api.service';
import { problemMessage } from './problem-details';

// Shows a toast for failed API calls, unless the request was sent with the QUIET context (login, signup,
// uploads, session restore, background refreshes): its caller shows the answer itself. A 400 is toasted
// with its first field message (the API answers in Thai), a 401 is the auth interceptor's business.
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !req.context.get(QUIET)) {
        if (err.status === 0) notify.error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง');
        else if (err.status !== 401)
          notify.error(problemMessage(err) ?? `เกิดข้อผิดพลาด (HTTP ${err.status})`);
      }
      return throwError(() => err);
    }),
  );
};
