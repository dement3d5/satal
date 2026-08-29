export type ErrorCode =
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'UNEXPECTED_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export class ExternalServiceUnavailableError extends AppError {
  constructor(service: string) {
    super('SERVICE_UNAVAILABLE', `${service} provider is not configured`, 503);
    this.name = 'ExternalServiceUnavailableError';
  }
}
