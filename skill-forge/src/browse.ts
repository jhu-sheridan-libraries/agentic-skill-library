import { exists, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { createArtifact, deleteArtifact, updateArtifact } from "./admin";
import {
	escapeHtml,
	generateHtmlPage,
	generateStaticHtmlPage,
} from "./browse-ui";
import { generateCatalog, SOURCE_DIRS, serializeCatalog } from "./catalog";
import {
	createCollection,
	deleteCollection,
	getCollection,
	listCollections,
	updateCollection,
} from "./collection-admin";
import {
	addManifestEntry,
	computeSyncStatus,
	editManifestEntry,
	ManifestAdminError,
	readManifest,
	readSyncLock,
	removeManifestEntry,
} from "./manifest-admin";
import type { CatalogEntry, Collection } from "./schemas";

export {
	escapeHtml,
	generateHtmlPage,
	generateStaticHtmlPage,
} from "./browse-ui";

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
	const type = (err as any)?.type;
	const message = err instanceof Error ? err.message : String(err);

	if (type === "validation")
		return jsonError("Validation failed", 400, (err as any).details);
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
			const entry = await createArtifact(state.knowledgeDir, body as any);
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
			const entry = await updateArtifact(state.knowledgeDir, name, body as any);
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
				body as any,
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
				body as any,
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
				body as any,
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
				body as any,
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
