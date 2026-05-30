import { NetworkError } from "../errors.js";
import { normalizeError } from "./errors.js";

export interface RetryOptions {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.3);
}

function backoff(attempt: number, baseMs: number, maxMs: number): number {
  const delay = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
  return jitter(delay);
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseMs = 500, maxMs = 8000 } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const delay = backoff(attempt, baseMs, maxMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const msg = normalizeError(lastError).message;
  throw new NetworkError(
    `Operation failed after ${attempts} attempts: ${msg}. Fix: Check network connectivity and retry.`,
    attempts
  );
}
