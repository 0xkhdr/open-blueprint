import { compileTemplate, renderCompiled } from "./engine.js";

const cache = new Map<string, HandlebarsTemplateDelegate>();

export function getOrCompile(
  backend: string,
  templatePack: string,
  templateName: string,
  source: string
): HandlebarsTemplateDelegate {
  const key = `${backend}::${templatePack}::${templateName}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const compiled = compileTemplate(source);
  cache.set(key, compiled);
  return compiled;
}

export function renderFromRegistry(
  backend: string,
  templatePack: string,
  templateName: string,
  source: string,
  context: Record<string, unknown>
): string {
  const compiled = getOrCompile(backend, templatePack, templateName, source);
  return renderCompiled(compiled, context);
}

export function clearForTesting(): void {
  if (process.env.NODE_ENV !== "test") return;
  cache.clear();
}
