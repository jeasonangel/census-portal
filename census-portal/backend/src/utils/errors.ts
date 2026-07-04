// backend/src/utils/errors.ts

export function BadRequest(message: string) {
  const err = new Error(message);
  (err as any).statusCode = 400;
  return err;
}

export function Unauthorized(message: string = 'Unauthorized') {
  const err = new Error(message);
  (err as any).statusCode = 401;
  return err;
}

export function Forbidden(message: string = 'Forbidden', code?: string) {
  const err = new Error(message);
  (err as any).statusCode = 403;
  if (code) (err as any).code = code;
  return err;
}

export function NotFound(message: string = 'Not found') {
  const err = new Error(message);
  (err as any).statusCode = 404;
  return err;
}

export function Conflict(message: string = 'Conflict') {
  const err = new Error(message);
  (err as any).statusCode = 409;
  return err;
}

export function TooManyRequests(message: string = 'Too many requests') {
  const err = new Error(message);
  (err as any).statusCode = 429;
  return err;
}

export function InternalError(message: string = 'Internal server error') {
  const err = new Error(message);
  (err as any).statusCode = 500;
  return err;
}