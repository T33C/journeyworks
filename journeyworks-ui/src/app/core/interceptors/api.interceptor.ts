/**
 * API Interceptor
 *
 * Adds base URL and error handling for API requests.
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // Add base URL for relative paths
  let apiReq = req;
  if (!req.url.startsWith('http')) {
    apiReq = req.clone({
      url: `${environment.apiUrl}${req.url}`,
      setHeaders: {
        'Content-Type': 'application/json',
      },
    });
  }

  return next(apiReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('API Error:', error);

      // Could add toast notification here
      let errorMessage = 'An error occurred';
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return throwError(() => new Error(errorMessage));
    }),
  );
};
