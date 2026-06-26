export class AppError extends Error {
  readonly code: string | undefined;
  readonly originalError: unknown;

  constructor(message: string, code?: string, originalError?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
  }

  static fromUnknown(err: unknown): AppError {
    if (err instanceof AppError) return err;
    if (err instanceof Error) return new AppError(err.message, undefined, err);
    return new AppError('Error desconocido', undefined, err);
  }
}
