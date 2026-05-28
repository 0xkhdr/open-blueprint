import type { Identity } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

export function validateRBAC(
  ir: { identity?: Identity },
  blueprintFile: string = ""
): ValidationError[] {
  const errors: ValidationError[] = [];
  const identity = ir.identity;

  if (!identity?.rbac_enabled) {
    return errors;
  }

  // If RBAC is enabled, roles must be non-empty
  if (!identity.roles || identity.roles.length === 0) {
    errors.push({
      file: blueprintFile,
      type: "RBAC_ROLES_EMPTY",
      severity: "error",
      message: "RBAC is enabled but no roles are defined",
      resolution: "Define at least one role in identity.roles when rbac_enabled=true",
    });
    return errors;
  }

  // If RBAC is enabled, agent_owner must be defined
  if (!identity.agent_owner || identity.agent_owner.trim() === "") {
    errors.push({
      file: blueprintFile,
      type: "RBAC_OWNER_MISSING",
      severity: "error",
      message: "RBAC is enabled but agent_owner is not defined",
      resolution: "Set identity.agent_owner to a valid owner identifier when rbac_enabled=true",
    });
  }

  // Check for duplicate role names
  const roleNames = new Set<string>();
  const roleNameCounts: Record<string, number> = {};

  for (const role of identity.roles) {
    if (!role.name || role.name.trim() === "") {
      errors.push({
        file: blueprintFile,
        type: "RBAC_ROLE_NAME_EMPTY",
        severity: "error",
        message: "Found role with empty name",
        resolution: "Ensure all roles have non-empty names",
      });
    } else {
      roleNameCounts[role.name] = (roleNameCounts[role.name] || 0) + 1;
      roleNames.add(role.name);
    }
  }

  for (const [name, count] of Object.entries(roleNameCounts)) {
    if (count > 1) {
      errors.push({
        file: blueprintFile,
        type: "RBAC_DUPLICATE_ROLE",
        severity: "error",
        message: `Found duplicate role name: "${name}" appears ${count} times`,
        resolution: `Ensure all role names are unique; rename or remove duplicate "${name}"`,
      });
    }
  }

  // Check each role's permissions
  for (let i = 0; i < identity.roles.length; i++) {
    const role = identity.roles[i];
    if (!role) continue;

    if (!role.permissions || role.permissions.length === 0) {
      errors.push({
        file: blueprintFile,
        type: "RBAC_ROLE_PERMISSIONS_EMPTY",
        severity: "error",
        message: `Role "${role.name}" has no permissions defined`,
        resolution: `Add at least one permission to role "${role.name}", or remove the role if not needed`,
      });
    }

    // Check for wildcard permissions
    for (let j = 0; j < (role.permissions?.length || 0); j++) {
      const perm = role.permissions?.[j];
      if (perm === "*") {
        errors.push({
          file: blueprintFile,
          type: "RBAC_WILDCARD_PERMISSION",
          severity: "error",
          message: `Role "${role.name}" grants wildcard permission "*" which is too permissive`,
          resolution: `Replace "*" with specific permissions (e.g., "read:agents", "write:rules") for role "${role.name}"`,
        });
      }
    }
  }

  return errors;
}
