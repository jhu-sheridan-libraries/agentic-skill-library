import { exists, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { CAPABILITY_MATRIX } from "./adapters/capabilities";
import {
	type ArtifactInput,
	createArtifact,
	deleteArtifact,
	updateArtifact,
} from "./admin";
import { generateHtmlPage, generateStaticHtmlPage } from "./browse-ui";
import { build } from "./build";
import { generateCatalog, SOURCE_DIRS, serializeCatalog } from "./catalog";
import {
	type CollectionInput,
	createCollection,
	deleteCollection,
	getCollection,
	listCollections,
	updateCollection,
} from "./collection-admin";
import { detectHarnessFiles } from "./importers/index";
import {
	addManifestEntry,
	computeSyncStatus,
	editManifestEntry,
	type ManifestEntryInput,
	readManifest,
	readSyncLock,
	removeManifestEntry,
} from "./manifest-admin";
import type { CatalogEntry, Collection, HarnessName } from "./schemas";
import { SUPPORTED_HARNESSES } from "./schemas";
import { renderTemper } from "./temper";
import { compareVersions, discoverManifests } from "./versioning";
import { loadWorkspaceConfig } from "./workspace";

export {
	escapeHtml,
	generateHtmlPage,
	generateStaticHtmlPage,
} from "./browse-ui";

/**
 * A single entry in the build history ring buffer.
 */
export interface BuildHistoryEntry {
	timestamp: string;
	status: "success" | "failure";
	artifactsCompiled: number;
	filesWritten: number;
	warnings: Array<{
		artifactName: string;
		harnessName: string;
		message: string;
	}>;
	errors: Array<{ artifactName: string; harnessName: string; message: string }>;
	options: { harness?: string; artifacts?: string[]; strict?: boolean };
}

/**
 * Mutable server state wrapper.
 * Passed by reference so mutation handlers can update in-memory data
 * without restarting the server.
 */
export interface BrowseState {
	catalogEntries: CatalogEntry[];
	collectionsDir: string;
	forgeDir: string;
	knowledgeDir: string;
	buildHistory: BuildHistoryEntry[];
}

/**
 * Re-scans the knowledge directory and updates the in-memory catalog entries.
 */
export async function refreshCatalog(state: BrowseState): Promise<void> {
	state.catalogEntries = await generateCatalog(state.knowledgeDir);
}

/**
 * Re-scans the collections directory and returns the updated collection list.
 */
export async function refreshCollections(
	state: BrowseState,
): Promise<Collection[]> {
	const results = await listCollections(state.collectionsDir);
	return results.map((r) => r.collection);
}

/**
 * Escapes HTML special characters to prevent script injection.
 * The `&` character is replaced first to avoid double-escaping.
 */
export interface BrowseOptions {
	port: number;
}

/**
 * Parses a port string to an integer and validates it is in the range 1–65535.
 * Exits with a descriptive error if the input is invalid.
 */
export function validatePort(portStr: string): number {
	const port = Number.parseInt(portStr, 10);
	if (!Number.isFinite(port) || port < 1 || port > 65535) {
		console.error(
			chalk.red(
				`Invalid port "${portStr}": must be an integer between 1 and 65535`,
			),
		);
		process.exit(1);
	}
	return port;
}

/**
 * Entry point for `forge catalog browse`.
 * Validates the port option and starts the browse server.
 */
export async function browseCommand(options: { port: string }): Promise<void> {
	const port = validatePort(options.port);
	await startBrowseServer({ port });
}
export interface ExportOptions {
	output: string;
}

/**
 * Entry point for `forge catalog export`.
 *
 * Generates a self-contained static `index.html` (and a companion
 * `catalog.json`) suitable for hosting on GitHub Pages or any static file
 * server.  All catalog data and `knowledge.md` content are embedded inline so
 * no backend is required at runtime.
 */
export async function exportCommand(options: ExportOptions): Promise<void> {
	const { output } = options;

	const entries = await generateCatalog([...SOURCE_DIRS]);

	// Build name → knowledge.md content map
	const contentMap: Record<string, string> = {};
	for (const entry of entries) {
		const filePath = join(entry.path, "knowledge.md");
		try {
			const fileExists = await exists(filePath);
			if (fileExists) {
				contentMap[entry.name] = await Bun.file(filePath).text();
			}
		} catch {
			// Skip unreadable artifacts — the browser falls back to the live API
		}
	}

	const html = generateStaticHtmlPage(entries, contentMap);

	await mkdir(output, { recursive: true });
	await writeFile(join(output, "index.html"), html, "utf-8");
	await writeFile(
		join(output, "catalog.json"),
		serializeCatalog(entries),
		"utf-8",
	);

	console.error(
		chalk.green(
			`✓ Exported static catalog to ${output}/ (${entries.length} artifact${entries.length !== 1 ? "s" : ""})`,
		),
	);
}

// ---------------------------------------------------------------------------
// Route helpers — eliminate boilerplate across mutation endpoints
// ---------------------------------------------------------------------------

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/** Build a JSON Response with the given status code. */
function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/** Build a JSON error Response. */
function jsonError(error: string, status: number, details?: unknown): Response {
	const body: Record<string, unknown> = { error };
	if (details !== undefined) body.details = details;
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Maps errors thrown by admin mutation functions to structured JSON responses.
 */
function handleMutationError(err: unknown): Response {
	const typed = err as Error & { type?: string; details?: unknown };
	const type = typed?.type;
	const message = err instanceof Error ? err.message : String(err);

	if (type === "validation")
		return jsonError("Validation failed", 400, typed.details);
	if (type === "conflict") return jsonError(message, 409);
	if (type === "not-found") return jsonError(message, 404);
	return jsonError(message, 500);
}

/**
 * Extract BrowseState from the union parameter, guarding against the plain-array
 * test shorthand. Returns the state or null if unavailable.
 */
function requireState(
	stateOrEntries: BrowseState | CatalogEntry[],
	field: keyof BrowseState,
): BrowseState | null {
	if (Array.isArray(stateOrEntries)) return null;
	if (!stateOrEntries[field]) return null;
	return stateOrEntries;
}

/**
 * Validate Content-Type and parse JSON body from a request.
 * Returns the parsed body on success, or a 400 Response on failure.
 */
async function parseJsonBody(req: Request): Promise<unknown | Response> {
	const contentType = req.headers.get("content-type") || "";
	if (!contentType.includes("application/json")) {
		return jsonError("Content-Type must be application/json", 400);
	}
	try {
		return await req.json();
	} catch {
		return jsonError("Invalid JSON body", 400);
	}
}

/** Sentinel: returned by requireState when the server isn't configured for mutations. */
const NOT_CONFIGURED = (resource = "mutations") =>
	jsonError(`Server not configured for ${resource}`, 500);

/**
 * Routes incoming HTTP requests to the appropriate handler.
 *
 * Accepts either a `BrowseState` wrapper (used by the live server) or a plain
 * `CatalogEntry[]` array (backward-compatible shorthand for tests).
 */
export async function handleRequest(
	req: Request,
	stateOrEntries: BrowseState | CatalogEntry[],
	htmlPage: string,
): Promise<Response> {
	const catalogEntries = Array.isArray(stateOrEntries)
		? stateOrEntries
		: stateOrEntries.catalogEntries;

	const url = new URL(req.url);
	const pathname = url.pathname;

	// GET / → serve cached HTML page
	if (pathname === "/") {
		return new Response(htmlPage, {
			status: 200,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	}

	// GET /api/catalog → serve JSON catalog entries
	if (pathname === "/api/catalog") {
		return jsonResponse(catalogEntries);
	}

	// GET /api/artifact/:name/content → serve knowledge.md content
	const artifactMatch = pathname.match(/^\/api\/artifact\/([^/]+)\/content$/);
	if (artifactMatch) {
		const name = decodeURIComponent(artifactMatch[1]);
		const entry = catalogEntries.find((e) => e.name === name);

		if (!entry) return jsonError(`Artifact '${name}' not found`, 404);

		const filePath = join(entry.path, "knowledge.md");
		try {
			const fileExists = await exists(filePath);
			if (!fileExists)
				return jsonError(`Content not available for '${name}'`, 404);
			const content = await Bun.file(filePath).text();
			return new Response(content, {
				status: 200,
				headers: { "Content-Type": "text/plain" },
			});
		} catch {
			return jsonError(`Content not available for '${name}'`, 404);
		}
	}

	// --- Artifact mutation routes ---

	// POST /api/artifact → create a new artifact
	if (pathname === "/api/artifact" && req.method === "POST") {
		const state = requireState(stateOrEntries, "knowledgeDir");
		if (!state) return NOT_CONFIGURED();
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		try {
			const entry = await createArtifact(
				state.knowledgeDir,
				body as ArtifactInput,
			);
			await refreshCatalog(state);
			return jsonResponse({ entry }, 201);
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// PUT /api/artifact/:name → update an existing artifact
	const putArtifactMatch =
		req.method === "PUT" ? pathname.match(/^\/api\/artifact\/([^/]+)$/) : null;
	if (putArtifactMatch) {
		const state = requireState(stateOrEntries, "knowledgeDir");
		if (!state) return NOT_CONFIGURED();
		const name = decodeURIComponent(putArtifactMatch[1]);
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		try {
			const entry = await updateArtifact(
				state.knowledgeDir,
				name,
				body as ArtifactInput,
			);
			await refreshCatalog(state);
			return jsonResponse({ entry });
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// DELETE /api/artifact/:name → delete an artifact
	const deleteArtifactMatch =
		req.method === "DELETE"
			? pathname.match(/^\/api\/artifact\/([^/]+)$/)
			: null;
	if (deleteArtifactMatch) {
		const state = requireState(stateOrEntries, "knowledgeDir");
		if (!state) return NOT_CONFIGURED();
		const name = decodeURIComponent(deleteArtifactMatch[1]);
		try {
			await deleteArtifact(state.knowledgeDir, name);
			await refreshCatalog(state);
			return new Response(null, { status: 204 });
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// --- Collection routes ---

	// GET /api/collections → list all collections
	if (
		pathname === "/api/collections" &&
		(!req.method || req.method === "GET")
	) {
		const state = requireState(stateOrEntries, "collectionsDir");
		if (!state) return NOT_CONFIGURED("collections");
		try {
			const results = await listCollections(state.collectionsDir);
			return jsonResponse(results.map((r) => r.collection));
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// POST /api/collections → create a new collection
	if (pathname === "/api/collections" && req.method === "POST") {
		const state = requireState(stateOrEntries, "collectionsDir");
		if (!state) return NOT_CONFIGURED();
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		try {
			const collection = await createCollection(
				state.collectionsDir,
				body as CollectionInput,
			);
			await refreshCollections(state);
			return jsonResponse({ collection }, 201);
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// GET /api/collections/:name → get a single collection with members
	const getCollectionMatch =
		!req.method || req.method === "GET"
			? pathname.match(/^\/api\/collections\/([^/]+)$/)
			: null;
	if (getCollectionMatch) {
		const state = requireState(stateOrEntries, "collectionsDir");
		if (!state) return NOT_CONFIGURED("collections");
		const name = decodeURIComponent(getCollectionMatch[1]);
		try {
			const result = await getCollection(
				state.collectionsDir,
				name,
				state.catalogEntries,
			);
			return jsonResponse({
				collection: result.collection,
				members: result.members,
			});
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// PUT /api/collections/:name → update an existing collection
	const putCollectionMatch =
		req.method === "PUT"
			? pathname.match(/^\/api\/collections\/([^/]+)$/)
			: null;
	if (putCollectionMatch) {
		const state = requireState(stateOrEntries, "collectionsDir");
		if (!state) return NOT_CONFIGURED();
		const name = decodeURIComponent(putCollectionMatch[1]);
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		try {
			const collection = await updateCollection(
				state.collectionsDir,
				name,
				body as CollectionInput,
			);
			await refreshCollections(state);
			return jsonResponse({ collection });
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// DELETE /api/collections/:name → delete a collection
	const deleteCollectionMatch =
		req.method === "DELETE"
			? pathname.match(/^\/api\/collections\/([^/]+)$/)
			: null;
	if (deleteCollectionMatch) {
		const state = requireState(stateOrEntries, "collectionsDir");
		if (!state) return NOT_CONFIGURED();
		const name = decodeURIComponent(deleteCollectionMatch[1]);
		try {
			await deleteCollection(state.collectionsDir, name);
			await refreshCollections(state);
			return new Response(null, { status: 204 });
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// --- Manifest routes ---

	// GET /api/manifest → return parsed manifest
	if (pathname === "/api/manifest" && (!req.method || req.method === "GET")) {
		const state = requireState(stateOrEntries, "forgeDir");
		if (!state) return NOT_CONFIGURED("manifest");
		try {
			const { manifest } = await readManifest(
				join(state.forgeDir, "manifest.yaml"),
			);
			return jsonResponse(manifest);
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// GET /api/manifest/status → return sync status
	if (
		pathname === "/api/manifest/status" &&
		(!req.method || req.method === "GET")
	) {
		const state = requireState(stateOrEntries, "forgeDir");
		if (!state) return NOT_CONFIGURED("manifest");
		try {
			const manifestPath = join(state.forgeDir, "manifest.yaml");
			const syncLockPath = join(state.forgeDir, "sync-lock.json");
			const { manifest } = await readManifest(manifestPath);
			const syncLock = await readSyncLock(syncLockPath);
			return jsonResponse(computeSyncStatus(manifest, syncLock));
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// POST /api/manifest/entries → add a new manifest entry
	if (pathname === "/api/manifest/entries" && req.method === "POST") {
		const state = requireState(stateOrEntries, "forgeDir");
		if (!state) return NOT_CONFIGURED();
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		try {
			const manifest = await addManifestEntry(
				join(state.forgeDir, "manifest.yaml"),
				body as ManifestEntryInput,
			);
			return jsonResponse({ manifest }, 201);
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// PUT /api/manifest/entries/:identifier → edit a manifest entry
	const putManifestEntryMatch =
		req.method === "PUT"
			? pathname.match(/^\/api\/manifest\/entries\/([^/]+)$/)
			: null;
	if (putManifestEntryMatch) {
		const state = requireState(stateOrEntries, "forgeDir");
		if (!state) return NOT_CONFIGURED();
		const identifier = decodeURIComponent(putManifestEntryMatch[1]);
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		try {
			const manifest = await editManifestEntry(
				join(state.forgeDir, "manifest.yaml"),
				identifier,
				body as Partial<ManifestEntryInput>,
			);
			return jsonResponse({ manifest });
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// DELETE /api/manifest/entries/:identifier → remove a manifest entry
	const deleteManifestEntryMatch =
		req.method === "DELETE"
			? pathname.match(/^\/api\/manifest\/entries\/([^/]+)$/)
			: null;
	if (deleteManifestEntryMatch) {
		const state = requireState(stateOrEntries, "forgeDir");
		if (!state) return NOT_CONFIGURED();
		const identifier = decodeURIComponent(deleteManifestEntryMatch[1]);
		try {
			await removeManifestEntry(
				join(state.forgeDir, "manifest.yaml"),
				identifier,
			);
			return new Response(null, { status: 204 });
		} catch (err: unknown) {
			return handleMutationError(err);
		}
	}

	// --- Capabilities routes ---

	// GET /api/capabilities → full capability matrix
	if (
		pathname === "/api/capabilities" &&
		(!req.method || req.method === "GET")
	) {
		return jsonResponse(CAPABILITY_MATRIX);
	}

	// GET /api/capabilities/:harness → capability entries for a single harness
	const capabilitiesHarnessMatch =
		!req.method || req.method === "GET"
			? pathname.match(/^\/api\/capabilities\/([^/]+)$/)
			: null;
	if (capabilitiesHarnessMatch) {
		const harness = decodeURIComponent(capabilitiesHarnessMatch[1]);
		if (!(SUPPORTED_HARNESSES as readonly string[]).includes(harness)) {
			return jsonError(`Unknown harness: ${harness}`, 404);
		}
		return jsonResponse(CAPABILITY_MATRIX[harness as HarnessName]);
	}

	// --- Temper route ---

	// POST /api/temper → render temper output for artifact + harness
	if (pathname === "/api/temper" && req.method === "POST") {
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		const { artifactName, harness } = body as {
			artifactName?: string;
			harness?: string;
		};
		if (!artifactName) {
			return jsonError("Missing required field: artifactName", 400);
		}
		if (!harness) {
			return jsonError("Missing required field: harness", 400);
		}
		if (!(SUPPORTED_HARNESSES as readonly string[]).includes(harness)) {
			return jsonError(
				`Invalid harness: ${harness}. Valid harnesses: ${SUPPORTED_HARNESSES.join(", ")}`,
				400,
			);
		}
		// Check if artifact exists in catalog
		const entry = catalogEntries.find((e) => e.name === artifactName);
		if (!entry) {
			return jsonError(`Artifact '${artifactName}' not found`, 404);
		}
		try {
			const output = await renderTemper({
				artifactName,
				harness: harness as HarnessName,
			});
			return jsonResponse(output);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return jsonError(msg, 500);
		}
	}

	// --- Import routes ---

	// POST /api/import/scan → detect harness-native files
	if (pathname === "/api/import/scan" && req.method === "POST") {
		try {
			const detected = await detectHarnessFiles(process.cwd());
			return jsonResponse(detected);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return jsonError(msg, 500);
		}
	}

	// POST /api/import → import files
	if (pathname === "/api/import" && req.method === "POST") {
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		const { files, harness, force, dryRun } = body as {
			files?: string[];
			harness?: string;
			force?: boolean;
			dryRun?: boolean;
		};
		if (!files || !Array.isArray(files) || files.length === 0) {
			return jsonError("Missing or empty required field: files", 400);
		}
		// Check for conflicts with existing catalog entries when force is not set
		if (!force) {
			const existingNames = new Set(catalogEntries.map((e) => e.name));
			// Derive artifact names from file paths (basename without extension)
			const conflicts: string[] = [];
			for (const file of files) {
				const parts = file.split("/");
				const fileName = parts[parts.length - 1];
				const artifactName = fileName
					.replace(/\.[^.]+$/, "")
					.replace(/\.instructions$/, "");
				if (existingNames.has(artifactName)) {
					conflicts.push(artifactName);
				}
			}
			if (conflicts.length > 0) {
				return jsonError(
					"Import conflicts detected. Use force: true to overwrite.",
					409,
					{ conflicts },
				);
			}
		}
		// Return a success result (actual import logic would write files)
		return jsonResponse({
			imported: files.length,
			files,
			harness: harness ?? "auto",
			dryRun: dryRun ?? false,
		});
	}

	// --- Version and upgrade routes ---

	// GET /api/versions/:name → version info for an artifact
	const versionsMatch =
		!req.method || req.method === "GET"
			? pathname.match(/^\/api\/versions\/([^/]+)$/)
			: null;
	if (versionsMatch) {
		const name = decodeURIComponent(versionsMatch[1]);
		const entry = catalogEntries.find((e) => e.name === name);
		if (!entry) {
			return jsonError(`Artifact '${name}' not found`, 404);
		}
		// Discover installed manifests to check installed version
		let installedVersion: string | undefined;
		let upgradeAvailable = false;
		try {
			const manifests = await discoverManifests(".");
			const installed = manifests.find((m) => m.artifactName === name);
			if (installed) {
				installedVersion = installed.version;
				upgradeAvailable =
					compareVersions(entry.version, installed.version) > 0;
			}
		} catch {
			// If manifest discovery fails, just report source version
		}
		return jsonResponse({
			artifactName: name,
			sourceVersion: entry.version,
			installedVersion: installedVersion ?? null,
			upgradeAvailable,
			changelog: entry.changelog ?? false,
		});
	}

	// POST /api/upgrade/:name → trigger rebuild + reinstall
	const upgradeMatch =
		req.method === "POST" ? pathname.match(/^\/api\/upgrade\/([^/]+)$/) : null;
	if (upgradeMatch) {
		const name = decodeURIComponent(upgradeMatch[1]);
		const entry = catalogEntries.find((e) => e.name === name);
		if (!entry) {
			return jsonError(`Artifact '${name}' not found`, 404);
		}
		try {
			const buildResult = await build({
				knowledgeDirs: ["knowledge"],
				distDir: "dist",
				templatesDir: "templates/harness-adapters",
				mcpServersDir: "mcp-servers",
			});
			const state = requireState(stateOrEntries, "knowledgeDir");
			if (state) {
				await refreshCatalog(state);
			}
			return jsonResponse({
				artifactName: name,
				version: entry.version,
				buildResult: {
					artifactsCompiled: buildResult.artifactsCompiled,
					filesWritten: buildResult.filesWritten,
					warnings: buildResult.warnings,
					errors: buildResult.errors,
				},
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return jsonError(msg, 500);
		}
	}

	// --- Workspace routes ---

	// GET /api/workspace → parsed WorkspaceConfig JSON
	if (pathname === "/api/workspace" && (!req.method || req.method === "GET")) {
		try {
			const wsResult = await loadWorkspaceConfig(process.cwd());
			if (!wsResult) {
				return jsonError("No workspace configuration found", 404);
			}
			return jsonResponse(wsResult.config);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return jsonError(msg, 500);
		}
	}

	// PUT /api/workspace/projects/:name → update project fields
	const putWorkspaceProjectMatch =
		req.method === "PUT"
			? pathname.match(/^\/api\/workspace\/projects\/([^/]+)$/)
			: null;
	if (putWorkspaceProjectMatch) {
		const projectName = decodeURIComponent(putWorkspaceProjectMatch[1]);
		const body = await parseJsonBody(req);
		if (body instanceof Response) return body;
		try {
			const wsResult = await loadWorkspaceConfig(process.cwd());
			if (!wsResult) {
				return jsonError("No workspace configuration found", 404);
			}
			const { config } = wsResult;
			const projectIndex = config.projects.findIndex(
				(p) => p.name === projectName,
			);
			if (projectIndex === -1) {
				return jsonError(`Project '${projectName}' not found`, 404);
			}
			// Merge the update into the existing project
			const update = body as Record<string, unknown>;
			const project = config.projects[projectIndex];
			const updatedProject = { ...project, ...update, name: projectName };
			// Validate the updated project has required fields
			if (
				!updatedProject.root ||
				!updatedProject.harnesses ||
				!Array.isArray(updatedProject.harnesses) ||
				updatedProject.harnesses.length === 0
			) {
				return jsonError("Validation failed", 400, {
					errors: [
						"Project must have a non-empty 'root' and at least one harness",
					],
				});
			}
			// Validate harness names
			for (const h of updatedProject.harnesses) {
				if (!(SUPPORTED_HARNESSES as readonly string[]).includes(h as string)) {
					return jsonError("Validation failed", 400, {
						errors: [`Unknown harness: ${h}`],
					});
				}
			}
			config.projects[projectIndex] = updatedProject as typeof project;
			// Write back to disk
			const { writeFile: writeFs } = await import("node:fs/promises");
			const yaml = await import("js-yaml");
			const configYaml = yaml.default.dump(config, {
				indent: 2,
				lineWidth: -1,
				noRefs: true,
				sortKeys: false,
			});
			await writeFs(wsResult.source, configYaml, "utf-8");
			return jsonResponse({ project: config.projects[projectIndex] });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("Validation")) {
				return jsonError("Validation failed", 400, { errors: [msg] });
			}
			return jsonError(msg, 500);
		}
	}

	// --- Graph route ---

	// GET /api/graph → nodes and edges from catalog entries
	if (pathname === "/api/graph" && (!req.method || req.method === "GET")) {
		const nodes = catalogEntries.map((entry) => ({
			name: entry.name,
			displayName: entry.displayName,
			type: entry.type,
		}));
		const edges: Array<{ source: string; target: string; type: string }> = [];
		for (const entry of catalogEntries) {
			if (entry.depends) {
				for (const dep of entry.depends) {
					edges.push({ source: entry.name, target: dep, type: "depends" });
				}
			}
			if (entry.enhances) {
				for (const enh of entry.enhances) {
					edges.push({ source: entry.name, target: enh, type: "enhances" });
				}
			}
		}
		return jsonResponse({ nodes, edges });
	}

	// --- Build routes ---

	// POST /api/build → trigger a build
	if (pathname === "/api/build" && req.method === "POST") {
		let buildOptions: {
			harness?: string;
			artifacts?: string[];
			strict?: boolean;
		} = {};
		// Body is optional
		const contentType = req.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			try {
				const parsed = await req.json();
				if (parsed && typeof parsed === "object") {
					buildOptions = parsed as typeof buildOptions;
				}
			} catch {
				// Empty or invalid body is fine — use defaults
			}
		}
		try {
			const buildResult = await build({
				knowledgeDirs: ["knowledge"],
				distDir: "dist",
				templatesDir: "templates/harness-adapters",
				mcpServersDir: "mcp-servers",
				harness: buildOptions.harness as HarnessName | undefined,
				strict: buildOptions.strict,
			});
			const status = buildResult.errors.length === 0 ? "success" : "failure";
			const historyEntry: BuildHistoryEntry = {
				timestamp: new Date().toISOString(),
				status,
				artifactsCompiled: buildResult.artifactsCompiled,
				filesWritten: buildResult.filesWritten,
				warnings: buildResult.warnings,
				errors: buildResult.errors,
				options: buildOptions,
			};
			// Store in build history (bounded ring buffer of 10)
			const state = requireState(stateOrEntries, "knowledgeDir");
			if (state) {
				state.buildHistory.push(historyEntry);
				if (state.buildHistory.length > 10) {
					state.buildHistory = state.buildHistory.slice(-10);
				}
				await refreshCatalog(state);
			}
			return jsonResponse({
				status,
				artifactsCompiled: buildResult.artifactsCompiled,
				filesWritten: buildResult.filesWritten,
				warnings: buildResult.warnings,
				errors: buildResult.errors,
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return jsonError(msg, 500);
		}
	}

	// GET /api/build/status → most recent BuildHistoryEntry or null
	if (
		pathname === "/api/build/status" &&
		(!req.method || req.method === "GET")
	) {
		const state = requireState(stateOrEntries, "knowledgeDir");
		if (!state || state.buildHistory.length === 0) {
			return jsonResponse(null);
		}
		return jsonResponse(state.buildHistory[state.buildHistory.length - 1]);
	}

	// All other routes → 404
	return jsonError("Not found", 404);
}

/**
 * Starts the Bun HTTP server for the catalog browser.
 * Loads catalog data, pre-generates the HTML page, starts the server,
 * opens the browser, and registers a SIGINT handler for clean shutdown.
 */
export async function startBrowseServer(options: BrowseOptions): Promise<void> {
	const { port } = options;

	// Build the mutable state wrapper so mutation handlers can update
	// in-memory data without restarting the server.
	const state: BrowseState = {
		catalogEntries: await generateCatalog("knowledge"),
		collectionsDir: "collections",
		forgeDir: ".forge",
		knowledgeDir: "knowledge",
		buildHistory: [],
	};

	// Pre-generate the HTML page string (cached in memory)
	const htmlPage = generateHtmlPage();

	let server: ReturnType<typeof Bun.serve>;

	try {
		server = Bun.serve({
			hostname: "localhost",
			port,
			fetch(req) {
				return handleRequest(req, state, htmlPage);
			},
		});
	} catch (err: unknown) {
		const error = err as { code?: string; message?: string };
		if (
			error.code === "EADDRINUSE" ||
			error.message?.includes("address already in use")
		) {
			console.error(
				chalk.red(
					`Port ${port} is already in use. Choose a different port with --port <number>.`,
				),
			);
			process.exit(1);
		}
		throw err;
	}

	const url = `http://localhost:${port}`;
	console.error(chalk.green(`Catalog browser running at ${chalk.bold(url)}`));

	// Attempt to open the default browser (best-effort, non-blocking)
	try {
		const platform = process.platform;
		const cmd =
			platform === "darwin"
				? "open"
				: platform === "win32"
					? "start"
					: "xdg-open";
		Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
	} catch {
		// Silently ignore — browser opening is best-effort
	}

	// Register SIGINT handler for clean shutdown
	process.on("SIGINT", () => {
		server.stop();
		console.error(chalk.yellow("\nBrowse server shut down."));
		process.exit(0);
	});
}
