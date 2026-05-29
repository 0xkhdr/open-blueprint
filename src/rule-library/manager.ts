import type { BlueprintIR, Rule } from "../translator/ir.js";
import { BUILT_IN_PACKS, getRulePack } from "./packs.js";
import type { InstallOptions, RuleLibraryIndex, RulePack, RulePackMetadata } from "./types.js";

export class RuleLibraryManager {
  installPack(
    blueprint: BlueprintIR,
    packId: string,
    options: InstallOptions = {}
  ): { success: boolean; blueprint: BlueprintIR; message: string } {
    const pack = getRulePack(packId);
    if (!pack) {
      return {
        success: false,
        blueprint,
        message: `Rule pack not found: ${packId}`,
      };
    }

    // Validate rules if requested
    if (options.validate) {
      const validation = this.validateRules(pack.rules);
      if (!validation.valid) {
        return {
          success: false,
          blueprint,
          message: `Validation failed: ${validation.errors.join(", ")}`,
        };
      }
    }

    // Clone blueprint
    const updated = JSON.parse(JSON.stringify(blueprint)) as BlueprintIR;

    if (options.merge) {
      // Merge: add rules that don't already exist
      const existingIds = new Set(updated.rules.map((r) => r.id));
      const newRules = pack.rules.filter((r) => !existingIds.has(r.id));
      updated.rules.push(...newRules);
    } else if (options.force) {
      // Force: replace all rules with pack rules
      updated.rules = [...pack.rules];
    } else {
      // Default: add new rules, skip existing
      const existingIds = new Set(updated.rules.map((r) => r.id));
      const newRules = pack.rules.filter((r) => !existingIds.has(r.id));
      updated.rules.push(...newRules);
    }

    return {
      success: true,
      blueprint: updated,
      message: `Successfully installed ${pack.name} (${pack.rules.length} rules)`,
    };
  }

  private validateRules(rules: Rule[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of rules) {
      if (!rule.id || rule.id.length === 0) {
        errors.push("Rule missing id");
      }
      if (!rule.scope || rule.scope.length === 0) {
        errors.push(`Rule ${rule.id}: missing scope`);
      }
      if (!["hard", "soft"].includes(rule.severity)) {
        errors.push(`Rule ${rule.id}: invalid severity`);
      }
      if (!rule.action || rule.action.length === 0) {
        errors.push(`Rule ${rule.id}: missing action`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  generateIndex(): RuleLibraryIndex {
    const packs = BUILT_IN_PACKS.map(
      (pack) =>
        ({
          id: pack.id,
          name: pack.name,
          version: pack.version,
          framework: pack.framework,
          description: pack.description,
          rules_count: pack.rules.length,
          author: pack.author,
          tags: pack.tags,
        }) as RulePackMetadata
    );

    return {
      version: "1.0",
      timestamp: new Date().toISOString(),
      packs,
    };
  }

  searchPacks(query: string): RulePack[] {
    const lowerQuery = query.toLowerCase();
    return BUILT_IN_PACKS.filter(
      (pack) =>
        pack.name.toLowerCase().includes(lowerQuery) ||
        pack.description.toLowerCase().includes(lowerQuery) ||
        pack.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getPackInfo(packId: string): RulePackMetadata | undefined {
    const pack = getRulePack(packId);
    if (!pack) return undefined;

    return {
      id: pack.id,
      name: pack.name,
      version: pack.version,
      framework: pack.framework,
      description: pack.description,
      rules_count: pack.rules.length,
      author: pack.author,
      tags: pack.tags,
    };
  }
}

export function createRuleLibraryManager(): RuleLibraryManager {
  return new RuleLibraryManager();
}
