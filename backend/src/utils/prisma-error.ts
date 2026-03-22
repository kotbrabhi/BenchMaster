import { Prisma } from '@prisma/client';
import { HttpError } from './http-error';

export function rethrowPrismaError(
  error: unknown,
  mappings: Partial<Record<Prisma.PrismaClientKnownRequestError['code'], HttpError>>
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mappedError = mappings[error.code];

    if (mappedError) {
      throw mappedError;
    }
  }

  throw error;
}
