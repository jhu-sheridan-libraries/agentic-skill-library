export const ErrorCodes = {
	SOLR_CONNECTION: "SOLR_CONNECTION",
	SOLR_HTTP: "SOLR_HTTP",
	SOLR_RESPONSE: "SOLR_RESPONSE",
	EMBED_FAILURE: "EMBED_FAILURE",
	EMBED_INIT: "EMBED_INIT",
	SERIALIZATION: "SERIALIZATION",
	CONFIG_INVALID: "CONFIG_INVALID",
	SETUP_DOCKER: "SETUP_DOCKER",
	SETUP_PORT: "SETUP_PORT",
	CACHE_SQLITE: "CACHE_SQLITE",
	CACHE_INIT: "CACHE_INIT",
	CHUNKER: "CHUNKER",
	REINDEX: "REINDEX",
	TENANT_UNKNOWN: "TENANT_UNKNOWN",
	TENANT_READ_ONLY: "TENANT_READ_ONLY",
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class SoukCompassError extends Error {
	readonly code: ErrorCode;
	readonly httpStatus?: number;
	readonly solrMessage?: string;

	constructor(
		message: string,
		code: ErrorCode,
		options?: {
			httpStatus?: number;
			solrMessage?: string;
			cause?: unknown;
		},
	) {
		super(message, { cause: options?.cause });
		this.name = "SoukCompassError";
		this.code = code;
		this.httpStatus = options?.httpStatus;
		this.solrMessage = options?.solrMessage;
	}
}
