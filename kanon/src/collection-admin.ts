import { exists, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import {
	type CatalogEntry,
	type Collection,
	CollectionSchema,
} from "./schemas";

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Input shape for collection create/update requests */
export interface CollectionInput {
	name: string;
	displayName: string;
	description: string;
	version: string;
	trust: string;
	tags: string[];
}

/**
 * Validates CollectionInput against CollectionSchema and the kebab-case name pattern.
 * Returns either the parsed Collection data or an array of field-level errors.
 */
export function validateCollectionInput(
	input: CollectionInput,
):
	| { success: true; data: Collection }
	| { success: false; errors: Array<{ field: string; message: string }> } {
	const errors: Array<{ field: string; message: string }> = [];

	// Validate name against kebab-case pattern
	if (!KEBAB_CASE_PATTERN.test(input.name)) {
		errors.push({
			field: "name",
			message:
				"Name must be kebab-case (lowercase alphanumeric segments separated by hyphens)",
		});
	}

	// Build the collection object for schema validation
	const collectionData: Record<string, unknown> = {
		name: input.name,
		displayName: input.displayName,
		description: input.description,
		version: input.version,
		tags: input.tags,
	};

	if (input.trust) {
		collectionData.trust = input.trust;
	}

	const result = CollectionSchema.safeParse(collectionData);

	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push({
				field: issue.path.join(".") || "unknown",
				message: issue.message,
			});
		}
	}

	if (errors.length > 0) {
		return { success: false, errors };
	}

	return { success: true, data: result.data as Collection };
}

/**
 * Serializes a Collection record to a YAML string using js-yaml.
 * Accepts Record<string, unknown> to preserve unknown keys beyond the schema.
 */
export function serializeCollection(
	collection: Record<string, unknown>,
): string {
	return yaml.dump(collection, {
		lineWidth: -1,
		noRefs: true,
		quotingType: "'",
	});
}

/**
 * Parses a YAML string into a validated Collection, preserving unknown keys.
 * Returns both the validated Collection object and the raw parsed object
 * (which may contain keys beyond the schema).
 */
export function parseCollectionFile(yamlContent: string): {
	collection: Collection;
	raw: Record<string, unknown>;
} {
	const parsed = yaml.load(yamlContent) as Record<string, unknown>;

	if (!parsed || typeof parsed !== "object") {
		throw new Error("Invalid YAML: expected an object");
	}

	const result = CollectionSchema.safeParse(parsed);

	if (!result.success) {
		const messages = result.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; ");
		throw new Error(`Collection validation failed: ${messages}`);
	}

	return { collection: result.data, raw: parsed };
}

/**
 * Lists all collections from the collections/ directory.
 * Scans for .yaml files, parses each one, and returns an array of collection objects.
 */
export async function listCollections(
	collectionsDir: string,
): Promise<Array<{ collection: Collection; raw: Record<string, unknown> }>> {
	const entries = await readdir(collectionsDir);
	const yamlFiles = entries.filter((f) => f.endsWith(".yaml"));

	const results: Array<{
		collection: Collection;
		raw: Record<string, unknown>;
	}> = [];

	for (const file of yamlFiles) {
		const filePath = join(collectionsDir, file);
		const content = await readFile(filePath, "utf-8");
		const parsed = parseCollectionFile(content);
		results.push(parsed);
	}

	return results;
}

/**
 * Gets a single collection by name, including member artifact names.
 * Reads {collectionsDir}/{name}.yaml, parses it, then finds member artifacts
 * by checking catalogEntries where entry.collections includes the collection name.
 * Throws a not-found error if the collection file does not exist.
 */
export async function getCollection(
	collectionsDir: string,
	name: string,
	catalogEntries: CatalogEntry[],
): Promise<{
	collection: Collection;
	raw: Record<string, unknown>;
	members: string[];
}> {
	const filePath = join(collectionsDir, `${name}.yaml`);

	let content: string;
	try {
		content = await readFile(filePath, "utf-8");
	} catch (_err) {
		const error: Error & { type?: string } = new Error(
			`Collection '${name}' not found`,
		);
		error.type = "not-found";
		throw error;
	}

	const { collection, raw } = parseCollectionFile(content);

	const members = catalogEntries
		.filter((entry) => entry.collections.includes(name))
		.map((entry) => entry.name);

	return { collection, raw, members };
}

/**
 * Creates a new collection YAML file.
 * Validates input, checks for existing file (throws conflict error if so),
 * writes new YAML file to collectionsDir, and returns the validated Collection.
 */
export async function createCollection(
	collectionsDir: string,
	input: CollectionInput,
): Promise<Collection> {
	// Validate input
	const validation = validateCollectionInput(input);
	if (!validation.success) {
		const error: Error & { type?: string; details?: unknown } = new Error(
			"Validation failed",
		);
		error.type = "validation";
		error.details = validation.errors;
		throw error;
	}

	const filePath = join(collectionsDir, `${input.name}.yaml`);

	// Check for existing file
	if (await exists(filePath)) {
		const error: Error & { type?: string } = new Error(
			`Collection '${input.name}' already exists`,
		);
		error.type = "conflict";
		throw error;
	}

	// Serialize and write the new collection file
	const yamlContent = serializeCollection(
		validation.data as Record<string, unknown>,
	);
	await writeFile(filePath, yamlContent, "utf-8");

	return validation.data;
}

/**
 * Updates an existing collection YAML file, preserving unknown keys.
 * Validates input, reads existing file to get raw object with unknown keys,
 * merges the new validated fields into the raw object, writes back, and returns the validated Collection.
 */
export async function updateCollection(
	collectionsDir: string,
	name: string,
	input: CollectionInput,
): Promise<Collection> {
	// Validate input
	const validation = validateCollectionInput(input);
	if (!validation.success) {
		const error: Error & { type?: string; details?: unknown } = new Error(
			"Validation failed",
		);
		error.type = "validation";
		error.details = validation.errors;
		throw error;
	}

	const filePath = join(collectionsDir, `${name}.yaml`);

	// Read existing file to preserve unknown keys
	let existingRaw: Record<string, unknown>;
	try {
		const content = await readFile(filePath, "utf-8");
		const parsed = parseCollectionFile(content);
		existingRaw = parsed.raw;
	} catch (_err) {
		const error: Error & { type?: string } = new Error(
			`Collection '${name}' not found`,
		);
		error.type = "not-found";
		throw error;
	}

	// Merge new validated fields into the raw object (preserving unknown keys)
	const merged: Record<string, unknown> = {
		...existingRaw,
		...(validation.data as Record<string, unknown>),
	};

	// Serialize and write the updated collection file
	const yamlContent = serializeCollection(merged);
	await writeFile(filePath, yamlContent, "utf-8");

	return validation.data;
}

/**
 * Deletes a collection YAML file.
 * Checks if the file exists (throws not-found error if missing), then removes it.
 */
export async function deleteCollection(
	collectionsDir: string,
	name: string,
): Promise<void> {
	const filePath = join(collectionsDir, `${name}.yaml`);

	// Check if file exists
	if (!(await exists(filePath))) {
		const error: Error & { type?: string } = new Error(
			`Collection '${name}' not found`,
		);
		error.type = "not-found";
		throw error;
	}

	// Remove the YAML file
	await unlink(filePath);
}
