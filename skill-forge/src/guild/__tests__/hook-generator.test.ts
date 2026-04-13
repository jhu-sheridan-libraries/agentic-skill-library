import { describe, test, expect, afterEach } from "bun:test";
import { generateHookSnippet, detectShell } from "../hook-generator";
import type { ShellType } from "../hook-generator";

/**
 * Unit tests for shell snippet generation per shell type.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

// Save original SHELL env var to restore after tests
const originalShell = process.env.SHELL;

afterEach(() => {
  if (originalShell !== undefined) {
    process.env.SHELL = originalShell;
  } else {
    delete process.env.SHELL;
  }
});

// ---------------------------------------------------------------------------
// Tests: Bash snippet (Req 7.1, 7.2, 7.3, 7.4)
// ---------------------------------------------------------------------------

describe("generateHookSnippet — bash", () => {
  test("contains manifest check (Req 7.2)", () => {
    const snippet = generateHookSnippet("bash");
    expect(snippet).toContain(".forge/manifest.yaml");
  });

  test("contains sync invocation (Req 7.2)", () => {
    const snippet = generateHookSnippet("bash");
    expect(snippet).toContain("forge guild sync --auto-update");
  });

  test("redirects output to /dev/null (Req 7.3)", () => {
    const snippet = generateHookSnippet("bash");
    expect(snippet).toContain("/dev/null");
  });

  test("runs sync in background", () => {
    const snippet = generateHookSnippet("bash");
    // Background execution indicated by &
    expect(snippet).toContain("&");
  });

  test("overrides cd to trigger auto-sync", () => {
    const snippet = generateHookSnippet("bash");
    expect(snippet).toContain("cd()");
    expect(snippet).toContain("builtin cd");
  });
});

// ---------------------------------------------------------------------------
// Tests: Zsh snippet (Req 7.4)
// ---------------------------------------------------------------------------

describe("generateHookSnippet — zsh", () => {
  test("contains manifest check", () => {
    const snippet = generateHookSnippet("zsh");
    expect(snippet).toContain(".forge/manifest.yaml");
  });

  test("contains sync invocation", () => {
    const snippet = generateHookSnippet("zsh");
    expect(snippet).toContain("forge guild sync --auto-update");
  });

  test("redirects output to /dev/null", () => {
    const snippet = generateHookSnippet("zsh");
    expect(snippet).toContain("/dev/null");
  });

  test("uses zsh chpwd hook", () => {
    const snippet = generateHookSnippet("zsh");
    expect(snippet).toContain("add-zsh-hook");
    expect(snippet).toContain("chpwd");
  });
});

// ---------------------------------------------------------------------------
// Tests: Fish snippet (Req 7.4)
// ---------------------------------------------------------------------------

describe("generateHookSnippet — fish", () => {
  test("contains manifest check", () => {
    const snippet = generateHookSnippet("fish");
    expect(snippet).toContain(".forge/manifest.yaml");
  });

  test("contains sync invocation", () => {
    const snippet = generateHookSnippet("fish");
    expect(snippet).toContain("forge guild sync --auto-update");
  });

  test("redirects output to /dev/null", () => {
    const snippet = generateHookSnippet("fish");
    expect(snippet).toContain("/dev/null");
  });

  test("uses fish PWD variable event", () => {
    const snippet = generateHookSnippet("fish");
    expect(snippet).toContain("--on-variable PWD");
  });
});

// ---------------------------------------------------------------------------
// Tests: PowerShell snippet (Req 7.7)
// ---------------------------------------------------------------------------

describe("generateHookSnippet — powershell", () => {
  test("contains manifest check", () => {
    const snippet = generateHookSnippet("powershell");
    expect(snippet).toContain(".forge/manifest.yaml");
  });

  test("contains sync invocation", () => {
    const snippet = generateHookSnippet("powershell");
    expect(snippet).toContain("forge");
    expect(snippet).toContain("guild");
    expect(snippet).toContain("sync");
    expect(snippet).toContain("--auto-update");
  });

  test("suppresses output via $null", () => {
    const snippet = generateHookSnippet("powershell");
    expect(snippet).toContain("$null");
  });

  test("overrides Set-Location for directory change detection", () => {
    const snippet = generateHookSnippet("powershell");
    expect(snippet).toContain("Set-Location");
  });
});

// ---------------------------------------------------------------------------
// Tests: All shell types have required elements
// ---------------------------------------------------------------------------

describe("generateHookSnippet — all shells", () => {
  const shells: ShellType[] = ["bash", "zsh", "fish", "powershell"];

  for (const shell of shells) {
    test(`${shell} snippet contains manifest check`, () => {
      const snippet = generateHookSnippet(shell);
      expect(snippet).toContain(".forge/manifest.yaml");
    });

    test(`${shell} snippet contains sync command`, () => {
      const snippet = generateHookSnippet(shell);
      expect(snippet).toContain("forge");
      expect(snippet).toContain("sync");
      expect(snippet).toContain("--auto-update");
    });

    test(`${shell} snippet contains output suppression`, () => {
      const snippet = generateHookSnippet(shell);
      // Either /dev/null (POSIX) or $null (PowerShell)
      const hasDevNull = snippet.includes("/dev/null");
      const hasPsNull = snippet.includes("$null");
      expect(hasDevNull || hasPsNull).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: Shell detection from SHELL env var (Req 7.5, 7.6)
// ---------------------------------------------------------------------------

describe("detectShell", () => {
  test("detects bash from SHELL env var (Req 7.5)", () => {
    process.env.SHELL = "/bin/bash";
    expect(detectShell()).toBe("bash");
  });

  test("detects zsh from SHELL env var (Req 7.5)", () => {
    process.env.SHELL = "/bin/zsh";
    expect(detectShell()).toBe("zsh");
  });

  test("detects fish from SHELL env var (Req 7.5)", () => {
    process.env.SHELL = "/usr/bin/fish";
    expect(detectShell()).toBe("fish");
  });

  test("detects zsh from path containing zsh", () => {
    process.env.SHELL = "/usr/local/bin/zsh";
    expect(detectShell()).toBe("zsh");
  });

  test("returns null when SHELL is not set (Req 7.6)", () => {
    delete process.env.SHELL;
    expect(detectShell()).toBeNull();
  });

  test("returns null for unrecognized shell", () => {
    process.env.SHELL = "/usr/bin/tcsh";
    expect(detectShell()).toBeNull();
  });
});
