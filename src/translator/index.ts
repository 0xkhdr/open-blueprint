import type { BlueprintIR } from "./ir.js";

export interface BlueprintAdapter {
  parse(projectRoot: string): Promise<BlueprintIR>;
  render(ir: BlueprintIR, projectRoot: string): Promise<string[]>; // Returns list of written files
}

export type { BlueprintIR };
