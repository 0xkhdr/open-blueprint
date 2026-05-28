import { describe, it, expect } from "vitest";
import { validateRBAC } from "../../../src/validator/rbac.js";
import type { BlueprintIR, Identity } from "../../../src/translator/ir.js";

describe("RBAC Validation", () => {
  const blueprintFile = "/.claude/blueprint.json";

  it("passes when RBAC is disabled", () => {
    const ir: { identity?: Identity } = {
      identity: { rbac_enabled: false },
    };
    const errors = validateRBAC(ir, blueprintFile);
    expect(errors).toHaveLength(0);
  });

  it("passes when RBAC is not defined", () => {
    const ir: { identity?: Identity } = {};
    const errors = validateRBAC(ir, blueprintFile);
    expect(errors).toHaveLength(0);
  });

  it("fails when RBAC is enabled but no roles defined", () => {
    const ir: { identity?: Identity } = {
      identity: { rbac_enabled: true, roles: [] },
    };
    const errors = validateRBAC(ir, blueprintFile);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("RBAC_ROLES_EMPTY");
    expect(errors[0]?.severity).toBe("error");
  });

  it("fails when RBAC is enabled but agent_owner not set", () => {
    const ir: { identity?: Identity } = {
      identity: {
        rbac_enabled: true,
        roles: [{ name: "admin", permissions: ["read", "write"] }],
        agent_owner: "",
      },
    };
    const errors = validateRBAC(ir, blueprintFile);
    const ownerError = errors.find((e) => e.type === "RBAC_OWNER_MISSING");
    expect(ownerError).toBeDefined();
    expect(ownerError?.severity).toBe("error");
  });

  it("detects empty role names", () => {
    const ir: { identity?: Identity } = {
      identity: {
        rbac_enabled: true,
        agent_owner: "owner",
        roles: [
          { name: "", permissions: ["read"] },
          { name: "admin", permissions: ["read", "write"] },
        ],
      },
    };
    const errors = validateRBAC(ir, blueprintFile);
    const nameError = errors.find((e) => e.type === "RBAC_ROLE_NAME_EMPTY");
    expect(nameError).toBeDefined();
  });

  it("detects duplicate role names", () => {
    const ir: { identity?: Identity } = {
      identity: {
        rbac_enabled: true,
        agent_owner: "owner",
        roles: [
          { name: "admin", permissions: ["read", "write"] },
          { name: "admin", permissions: ["read"] },
        ],
      },
    };
    const errors = validateRBAC(ir, blueprintFile);
    const dupError = errors.find((e) => e.type === "RBAC_DUPLICATE_ROLE");
    expect(dupError).toBeDefined();
    expect(dupError?.message).toContain('"admin" appears 2 times');
  });

  it("detects roles with no permissions", () => {
    const ir: { identity?: Identity } = {
      identity: {
        rbac_enabled: true,
        agent_owner: "owner",
        roles: [{ name: "admin", permissions: [] }],
      },
    };
    const errors = validateRBAC(ir, blueprintFile);
    const permError = errors.find((e) => e.type === "RBAC_ROLE_PERMISSIONS_EMPTY");
    expect(permError).toBeDefined();
    expect(permError?.message).toContain('"admin"');
  });

  it("detects wildcard permissions", () => {
    const ir: { identity?: Identity } = {
      identity: {
        rbac_enabled: true,
        agent_owner: "owner",
        roles: [{ name: "admin", permissions: ["*"] }],
      },
    };
    const errors = validateRBAC(ir, blueprintFile);
    const wildcardError = errors.find((e) => e.type === "RBAC_WILDCARD_PERMISSION");
    expect(wildcardError).toBeDefined();
    expect(wildcardError?.message).toContain("wildcard");
  });

  it("passes with valid RBAC configuration", () => {
    const ir: { identity?: Identity } = {
      identity: {
        rbac_enabled: true,
        agent_owner: "admin@example.com",
        roles: [
          {
            name: "admin",
            permissions: ["read:agents", "write:agents", "admin:users"],
          },
          {
            name: "developer",
            permissions: ["read:agents", "write:rules"],
          },
          {
            name: "viewer",
            permissions: ["read:agents"],
          },
        ],
      },
    };
    const errors = validateRBAC(ir, blueprintFile);
    expect(errors).toHaveLength(0);
  });

  it("catches multiple violations in one IR", () => {
    const ir: { identity?: Identity } = {
      identity: {
        rbac_enabled: true,
        agent_owner: "",
        roles: [
          { name: "admin", permissions: ["*"] },
          { name: "admin", permissions: ["read"] },
          { name: "viewer", permissions: [] },
        ],
      },
    };
    const errors = validateRBAC(ir, blueprintFile);
    expect(errors.length).toBeGreaterThan(2);
    expect(errors.some((e) => e.type === "RBAC_OWNER_MISSING")).toBe(true);
    expect(errors.some((e) => e.type === "RBAC_WILDCARD_PERMISSION")).toBe(true);
    expect(errors.some((e) => e.type === "RBAC_DUPLICATE_ROLE")).toBe(true);
    expect(errors.some((e) => e.type === "RBAC_ROLE_PERMISSIONS_EMPTY")).toBe(true);
  });
});
