import type { HarnessAdapter } from "./types";
import type { HarnessName } from "../schemas";
import { SUPPORTED_HARNESSES } from "../schemas";
import { kiroAdapter } from "./kiro";
import { claudeCodeAdapter } from "./claude-code";
import { copilotAdapter } from "./copilot";
import { cursorAdapter } from "./cursor";
import { windsurfAdapter } from "./windsurf";
import { clineAdapter } from "./cline";
import { qdeveloperAdapter } from "./qdeveloper";

export { SUPPORTED_HARNESSES };
export type { HarnessName };

export const adapterRegistry: Record<HarnessName, HarnessAdapter> = {
  kiro: kiroAdapter,
  "claude-code": claudeCodeAdapter,
  copilot: copilotAdapter,
  cursor: cursorAdapter,
  windsurf: windsurfAdapter,
  cline: clineAdapter,
  qdeveloper: qdeveloperAdapter,
};
