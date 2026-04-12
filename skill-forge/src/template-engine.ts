import nunjucks from "nunjucks";
import { resolve } from "node:path";

export interface TemplateError {
  templatePath: string;
  message: string;
}

/**
 * Create a Nunjucks environment rooted at the given templates directory.
 * Supports template inheritance ({% extends %}, {% block %}).
 */
export function createTemplateEnv(templatesDir: string): nunjucks.Environment {
  const absPath = resolve(templatesDir);
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(absPath, { noCache: true }),
    { autoescape: false, throwOnUndefined: false, trimBlocks: true, lstripBlocks: true },
  );

  // Custom filter: kebab-case to Title Case
  env.addFilter("titleCase", (str: string) => {
    if (!str) return "";
    return str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  });

  return env;
}

/**
 * Render a template with the given context.
 * Returns the rendered string or throws a TemplateError.
 */
export function renderTemplate(
  env: nunjucks.Environment,
  templatePath: string,
  context: Record<string, unknown>,
): string {
  try {
    return env.render(templatePath, context);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const err: TemplateError = { templatePath, message: msg };
    throw err;
  }
}
