export type { RulePack } from "../packs/schema.js";

export interface RuleLibraryIndex {
  version: "1.0";
  timestamp: string;
  packs: RulePackMetadata[];
}

export interface RulePackMetadata {
  id: string;
  name: string;
  version: string;
  framework: string;
  description: string;
  url?: string;
  rules_count: number;
  author: string;
  tags: string[];
}

export interface InstallOptions {
  force?: boolean;
  merge?: boolean;
  validate?: boolean;
}
