import { describe, expect, test } from "bun:test";
import { resolveBody } from "../resolve-body";
import { makeArtifact } from "./test-helpers";

describe("resolveBody", () => {
	test("returns the override when present for the harness", () => {
		const artifact = makeArtifact({
			body: "canonical",
			bodyOverrides: { "claude-code": "claude body" },
		});
		expect(resolveBody(artifact, "claude-code")).toBe("claude body");
	});

	test("returns the canonical body when no override for the harness", () => {
		const artifact = makeArtifact({
			body: "canonical",
			bodyOverrides: { kiro: "kiro body" },
		});
		expect(resolveBody(artifact, "claude-code")).toBe("canonical");
	});

	test("returns the canonical body when no overrides at all", () => {
		const artifact = makeArtifact({ body: "canonical" });
		expect(resolveBody(artifact, "kiro")).toBe("canonical");
	});
});
