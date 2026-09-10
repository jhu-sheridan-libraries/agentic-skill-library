/**
 * Binary-asset handling for bundled workflow files.
 *
 * Knowledge artifacts can bundle non-text resources under `workflows/` — for
 * example a `.docx` CV template or an `.xlsx` reference workbook. These must
 * survive the pipeline (parser → canonical → adapters → disk writers)
 * byte-for-byte; reading them as UTF-8 and re-encoding corrupts them.
 *
 * Detection is by file extension. This is deliberate: it is deterministic
 * (the same input always classifies the same way, so the committed generated
 * artifacts never drift) and cheap. Content sniffing is intentionally avoided
 * because a heuristic could reclassify a file between runs.
 */

/**
 * Extensions whose content is raw bytes and must never be decoded as text.
 * Keep this list conservative — only add extensions that are genuinely binary.
 */
const BINARY_EXTENSIONS: ReadonlyMap<string, string> = new Map([
	// Office Open XML
	[
		"docx",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	],
	["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
	[
		"pptx",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	],
	// Legacy Office
	["doc", "application/msword"],
	["xls", "application/vnd.ms-excel"],
	["ppt", "application/vnd.ms-powerpoint"],
	// Documents / archives
	["pdf", "application/pdf"],
	["zip", "application/zip"],
	["gz", "application/gzip"],
	["tar", "application/x-tar"],
	// Images
	["png", "image/png"],
	["jpg", "image/jpeg"],
	["jpeg", "image/jpeg"],
	["gif", "image/gif"],
	["webp", "image/webp"],
	["ico", "image/x-icon"],
	["bmp", "image/bmp"],
	// Fonts
	["woff", "font/woff"],
	["woff2", "font/woff2"],
	["ttf", "font/ttf"],
	["otf", "font/otf"],
]);

/**
 * Extensions that should be written with the executable bit set (scripts a
 * skill is expected to run directly).
 */
const EXECUTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
	"py",
	"sh",
	"bash",
	"zsh",
	"rb",
	"pl",
]);

/** Lowercase extension without the dot, or "" when there is none. */
export function fileExtension(filename: string): string {
	const base = filename.slice(filename.lastIndexOf("/") + 1);
	const dot = base.lastIndexOf(".");
	if (dot <= 0) return "";
	return base.slice(dot + 1).toLowerCase();
}

/** True when the file's extension marks it as binary (byte-preserving) content. */
export function isBinaryWorkflowFile(filename: string): boolean {
	return BINARY_EXTENSIONS.has(fileExtension(filename));
}

/** The media type for a known binary extension, or undefined. */
export function binaryMediaType(filename: string): string | undefined {
	return BINARY_EXTENSIONS.get(fileExtension(filename));
}

/** True when the file's extension marks it as an executable script. */
export function isExecutableWorkflowFile(filename: string): boolean {
	return EXECUTABLE_EXTENSIONS.has(fileExtension(filename));
}
