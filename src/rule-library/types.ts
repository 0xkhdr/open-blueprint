import type { Rule } from "../translator/ir.js";

export interface RulePack {
  id: string;
  name: string;
  version: string;
  description: string;
  framework: "gdpr" | "soc2" | "hipaa" | "pci-dss" | "iso-27001" | "custom";
  author: string;
  tags: string[];
  rules: Rule[];
  metadata?: {
    created_at?: string;
    updated_at?: string;
    compliance_standard?: string;
    coverage?: number; // percentage
  };
}

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
