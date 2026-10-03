import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { QUIET } from './api.service';
import { problemOf } from './problem-details';

// Shows a toast for failed API calls. 400 is left to the form that sent it (field errors),
// and so is anything sent with the QUIET context (login, signup, session restore).
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !req.context.get(QUIET)) {
        if (err.status === 0) notify.error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง');
        else if (err.status !== 400 && err.status !== 401)
          notify.error(problemOf(err)?.title ?? `เกิดข้อผิดพลาด (HTTP ${err.status})`);
      }
      return throwError(() => err);
    }),
  );
};
