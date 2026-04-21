import type nunjucks from "nunjucks";
import type { KnowledgeArtifact, CapabilityEntry } from "../schemas";
import type { HarnessCapabilityName } from "./capabilities";

export interface OutputFile {
	relativePath: string;
	content: string;
	executable?: boolean;
}

export interface AdapterWarning {
	artifactName: string;
	harnessName: string;
	message: string;
}

export interface AdapterResult {
	files: OutputFile[];
	warnings: AdapterWarning[];
}

export interface AdapterContext {
	capabilities: Record<HarnessCapabilityName, CapabilityEntry>;
	strict: boolean;
}

export type HarnessAdapter = (
	artifact: KnowledgeArtifact,
	templateEnv: nunjucks.Environment,
	context?: AdapterContext,
) => AdapterResult;
