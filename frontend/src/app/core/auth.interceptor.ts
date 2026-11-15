import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from './api';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_BASE_URL)) {
    return next(request);
  }

  return next(request.clone({ withCredentials: true }));
};
