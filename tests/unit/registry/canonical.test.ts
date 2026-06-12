import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../../src/registry/canonical.js";

const jsonValue = fc.jsonValue();

describe("canonicalJson", () => {
  it("sorts object keys and emits no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}'
    );
  });

  it("round-trips any JSON value (property)", () => {
    fc.assert(
      fc.property(jsonValue, (value) => {
        expect(JSON.parse(canonicalJson(value))).toEqual(JSON.parse(JSON.stringify(value)));
      })
    );
  });

  it("is stable: serializing twice gives identical bytes (property)", () => {
    fc.assert(
      fc.property(jsonValue, (value) => {
        const once = canonicalJson(value);
        expect(canonicalJson(JSON.parse(once))).toBe(once);
      })
    );
  });

  it("is independent of object key insertion order (property)", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), jsonValue), (obj) => {
        const reversed: Record<string, unknown> = {};
        for (const key of Object.keys(obj).reverse()) reversed[key] = obj[key];
        expect(canonicalJson(reversed)).toBe(canonicalJson(obj));
      })
    );
  });

  it("matches JSON.stringify semantics for undefined members", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalJson([undefined, 1])).toBe("[null,1]");
  });
});
