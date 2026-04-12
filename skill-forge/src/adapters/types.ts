import type nunjucks from "nunjucks";
import type { KnowledgeArtifact } from "../schemas";

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

export type HarnessAdapter = (
  artifact: KnowledgeArtifact,
  templateEnv: nunjucks.Environment,
) => AdapterResult;
