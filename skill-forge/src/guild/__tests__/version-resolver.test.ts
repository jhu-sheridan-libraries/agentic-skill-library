import { describe, expect, test } from "bun:test";
import { resolveVersion, type ResolutionResult } from "../version-resolver";

describe("resolveVersion", () => {
  const versions = ["1.0.0", "1.2.3", "1.5.0", "2.0.0", "2.1.0"];

  test("resolves exact version match", () => {
    const result = resolveVersion("my-artifact", "1.2.3", versions);
    expect(result.resolvedVersion).toBe("1.2.3");
    expect(result.name).toBe("my-artifact");
    expect(result.requestedVersion).toBe("1.2.3");
  });

  test("resolves caret range to highest satisfying version", () => {
    const result = resolveVersion("my-artifact", "^1.0.0", versions);
    expect(result.resolvedVersion).toBe("1.5.0");
  });

  test("resolves tilde range to highest satisfying version", () => {
    const result = resolveVersion("my-artifact", "~1.2.0", versions);
    expect(result.resolvedVersion).toBe("1.2.3");
  });

  test("returns null when no version satisfies the pin", () => {
    const result = resolveVersion("my-artifact", "^3.0.0", versions);
    expect(result.resolvedVersion).toBeNull();
  });

  test("returns null for empty available versions", () => {
    const result = resolveVersion("my-artifact", "^1.0.0", []);
    expect(result.resolvedVersion).toBeNull();
  });

  test("includes availableVersions in result for error reporting", () => {
    const result = resolveVersion("my-artifact", "^9.0.0", versions);
    expect(result.availableVersions).toEqual(versions);
    expect(result.resolvedVersion).toBeNull();
  });

  test("picks highest from multiple satisfying versions", () => {
    const result = resolveVersion("pkg", "^2.0.0", versions);
    expect(result.resolvedVersion).toBe("2.1.0");
  });

  test("handles single version list", () => {
    const result = resolveVersion("pkg", "^1.0.0", ["1.3.0"]);
    expect(result.resolvedVersion).toBe("1.3.0");
  });

  test("exact version that does not exist returns null", () => {
    const result = resolveVersion("pkg", "9.9.9", versions);
    expect(result.resolvedVersion).toBeNull();
  });
});
