import type { HarnessName } from "../schemas";
import { SUPPORTED_HARNESSES } from "../schemas";
import { claudeCodeAdapter } from "./claude-code";
import { clineAdapter } from "./cline";
import { copilotAdapter } from "./copilot";
import { cursorAdapter } from "./cursor";
import { kiroAdapter } from "./kiro";
import { qdeveloperAdapter } from "./qdeveloper";
import type { HarnessAdapter } from "./types";
import { windsurfAdapter } from "./windsurf";

export type { HarnessName };
export { SUPPORTED_HARNESSES };

export const adapterRegistry: Record<HarnessName, HarnessAdapter> = {
	kiro: kiroAdapter,
	"claude-code": claudeCodeAdapter,
	copilot: copilotAdapter,
	cursor: cursorAdapter,
	windsurf: windsurfAdapter,
	cline: clineAdapter,
	qdeveloper: qdeveloperAdapter,
};
