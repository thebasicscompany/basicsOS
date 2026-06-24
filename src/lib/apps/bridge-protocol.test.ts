import { describe, expect, it } from "vitest";
import {
  isAcceptableOrigin,
  isSafeInternalPath,
  isValidBridgeRequest,
  sanitizeNavPath,
  BRIDGE_VERSION,
} from "@/lib/apps/bridge-protocol";

describe("isValidBridgeRequest", () => {
  it("accepts a well-formed request", () => {
    expect(isValidBridgeRequest({ v: BRIDGE_VERSION, id: "1", method: "tools.list" })).toBe(true);
  });
  it("rejects wrong version / missing fields", () => {
    expect(isValidBridgeRequest({ v: 2, id: "1", method: "x" })).toBe(false);
    expect(isValidBridgeRequest({ v: 1, id: "", method: "x" })).toBe(false);
    expect(isValidBridgeRequest({ v: 1, id: "1" })).toBe(false);
    expect(isValidBridgeRequest(null)).toBe(false);
    expect(isValidBridgeRequest("nope")).toBe(false);
  });
});

describe("isAcceptableOrigin", () => {
  it("accepts the opaque-sandbox 'null' origin", () => {
    expect(isAcceptableOrigin("null", "https://app.example.com")).toBe(true);
  });
  it("accepts the exact registered origin", () => {
    expect(isAcceptableOrigin("https://app.example.com", "https://app.example.com")).toBe(true);
  });
  it("rejects a different origin", () => {
    expect(isAcceptableOrigin("https://evil.com", "https://app.example.com")).toBe(false);
    expect(isAcceptableOrigin("https://app.example.com.evil.com", "https://app.example.com")).toBe(false);
  });
});

describe("isSafeInternalPath / sanitizeNavPath", () => {
  it("accepts app-internal absolute paths", () => {
    expect(isSafeInternalPath("/objects/contacts")).toBe(true);
    expect(sanitizeNavPath("/apps/renewals")).toBe("/apps/renewals");
  });
  it("rejects external / protocol-relative / non-absolute targets", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalPath("relative")).toBe(false);
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
    expect(sanitizeNavPath("//evil.com")).toBeNull();
  });
});
