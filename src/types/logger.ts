/**
 * Minimal structured-logging interface the engines depend on.
 *
 * Engines (detector, templater, validator, translator) accept an `ILogger`
 * by injection instead of importing a concrete logger; the CLI composition
 * root wires the default Pino instance (`src/logger.ts`), which satisfies
 * this interface structurally.
 *
 * Call shape follows Pino: optional structured-context object first, then
 * the message.
 */
export interface ILogger {
  debug(obj: unknown, msg?: string, ...args: unknown[]): void;
  info(obj: unknown, msg?: string, ...args: unknown[]): void;
  warn(obj: unknown, msg?: string, ...args: unknown[]): void;
  error(obj: unknown, msg?: string, ...args: unknown[]): void;
}
