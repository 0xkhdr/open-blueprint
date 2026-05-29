import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pino from "pino";

const correlationStorage = new AsyncLocalStorage<string>();

export function getCorrelationId(): string {
  return correlationStorage.getStore() ?? "no-correlation-id";
}

export function runWithCorrelationId<T>(id: string, fn: () => T): T {
  return correlationStorage.run(id, fn);
}

const isTest = process.env.NODE_ENV === "test";
const isTTY = process.stdout.isTTY === true;
const level = process.env.BP_LOG_LEVEL ?? (isTest ? "silent" : "info");

const transport =
  !isTest && isTTY
    ? pino.transport({ target: "pino-pretty", options: { colorize: true, translateTime: true } })
    : undefined;

const baseLogger = pino(
  {
    level,
    redact: [
      "apiKey",
      "token",
      "secret",
      "password",
      "credential",
      "auth",
      "authorization",
      "cookie",
      "privateKey",
      "*.apiKey",
      "*.token",
      "*.secret",
      "*.password",
      "*.credential",
      "*.auth",
      "*.authorization",
      "*.cookie",
      "*.privateKey",
    ],
    mixin() {
      const correlationId = correlationStorage.getStore();
      return correlationId ? { correlationId } : {};
    },
  },
  transport
);

export const logger = baseLogger;

export function initCorrelationId(): string {
  const id = randomUUID();
  return id;
}
