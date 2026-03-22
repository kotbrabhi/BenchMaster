import { environment } from '../../environments/environment.generated';

export const API_BASE_URL = environment.apiBaseUrl.replace(/\/$/, '');

export function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const candidate = (error as { error?: { message?: string } }).error?.message;

    if (candidate) {
      return candidate;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Une erreur est survenue. Veuillez réessayer.';
}
