export class ResourceLimitError extends Error {
  readonly actual: number;
  readonly limit: number;

  constructor(message: string, actual: number, limit: number) {
    super(message);
    this.name = "ResourceLimitError";
    this.actual = actual;
    this.limit = limit;
  }
}

export class ValidationTimeoutError extends Error {
  readonly elapsedMs: number;
  readonly timeoutMs: number;

  constructor(elapsedMs: number, timeoutMs: number) {
    super(`Validation timed out after ${elapsedMs}ms (limit: ${timeoutMs}ms)`);
    this.name = "ValidationTimeoutError";
    this.elapsedMs = elapsedMs;
    this.timeoutMs = timeoutMs;
  }
}
