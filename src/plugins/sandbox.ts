import * as vm from "node:vm";
import type { ValidationError } from "../validator/structural.js";

export interface PluginAPI {
  validate(result: ValidationError): void;
  log(msg: string): void;
  error(msg: string): void;
}

export function createPluginContext(api: PluginAPI): vm.Context {
  return vm.createContext({
    console: {
      log: (msg: unknown) => api.log(String(msg)),
      error: (msg: unknown) => api.error(String(msg)),
      warn: (msg: unknown) => api.log(String(msg)),
    },
    validate: api.validate.bind(api),
    // Explicitly deny dangerous globals
    process: undefined,
    require: undefined,
    __dirname: undefined,
    __filename: undefined,
    global: undefined,
    globalThis: undefined,
    Buffer: undefined,
    fetch: undefined,
  });
}
