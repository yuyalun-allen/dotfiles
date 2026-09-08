/**
 * Unified Web Search Extension
 *
 * Combines Tavily and Brave Search APIs with intelligent routing to
 * maximize free-tier usage (both ~1,000 free requests/month).
 *
 * Tools provided:
 *   web_search        – Smart router: auto-chooses Tavily or Brave
 *   web_page_extract  – URL content extraction (Tavily)
 *
 * Routing strategy (web_search):
 *   - AI answer / raw content needed → Tavily (core strength)
 *   - News / Finance → Tavily
 *   - General → 1:1 round-robin between Tavily & Brave
 *   - Fallback: if one fails, auto-retry with the other
 *
 * API keys (resolved in order):
 *   1. Environment variable (TAVILY_API_KEY / BRAVE_API_KEY)
 *   2. GNOME Keyring (notes labeled "tavily" / "brave")
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";

// ═══════════════════════════════════════════════════════════════════
//  API Key Resolution
// ═══════════════════════════════════════════════════════════════════

function resolveKey(name: string, envVar: string): string | null {
	const env = process.env[envVar];
	if (env) return env;

	try {
		const output = execSync(
			"secret-tool search --all xdg:schema org.gnome.keyring.Note",
			{ encoding: "utf-8", timeout: 5000 },
		);
		const lines = output.split("\n");
		let currentLabel = "";
		for (const line of lines) {
			const labelMatch = line.match(/^label\s*=\s*(.+)$/);
			const secretMatch = line.match(/^secret\s*=\s*(.+)$/);
			if (labelMatch) currentLabel = labelMatch[1].trim();
			if (secretMatch && currentLabel.toLowerCase() === name) {
				return secretMatch[1].trim();
			}
		}
	} catch {
		// secret-tool not available
	}
	return null;
}

function getTavilyKey(): string {
	const key = resolveKey("tavily", "TAVILY_API_KEY");
	if (!key) {
		throw new Error(
			"Tavily API key not found. Set TAVILY_API_KEY env var or " +
			"store a Note labeled 'tavily' in GNOME Keyring.",
		);
	}
	return key;
}

function getBraveKey(): string {
	const key = resolveKey("brave", "BRAVE_API_KEY");
	if (!key) {
		throw new Error(
			"Brave API key not found. Set BRAVE_API_KEY env var or " +
			"store a Note labeled 'brave' in GNOME Keyring.",
		);
	}
	return key;
}

// ═══════════════════════════════════════════════════════════════════
//  Round-Robin Counter
// ═══════════════════════════════════════════════════════════════════

let requestCounter = 0;

function nextEngine(): "tavily" | "brave" {
	requestCounter++;
	return requestCounter % 2 === 0 ? "tavily" : "brave";
}

// ═══════════════════════════════════════════════════════════════════
//  Shared: Tavily API Request
// ═══════════════════════════════════════════════════════════════════

const TAVILY_BASE = "https://api.tavily.com";

async function tavilyRequest(
	endpoint: string,
	body: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<Record<string, unknown>> {
	const key = getTavilyKey();

	const response = await fetch(`${TAVILY_BASE}${endpoint}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key}`,
		},
		body: JSON.stringify(body),
		signal,
	});

	if (!response.ok) {
		let detail = "";
		try {
			const err = (await response.json()) as { detail?: { error?: string } };
			detail = err.detail?.error ?? "";
		} catch {
			// ignore parse error
		}
		throw new Error(
			`Tavily API error (${response.status}): ${detail || response.statusText}`,
		);
	}

	return response.json() as Promise<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════
//  Internal: Tavily Search (used by smart router)
// ═══════════════════════════════════════════════════════════════════

async function tavilySearch(
	query: string,
	params: {
		searchDepth?: string;
		maxResults?: number;
		topic?: string;
		timeRange?: string;
		includeAnswer?: string;
		includeDomains?: string[];
		excludeDomains?: string[];
		startDate?: string;
		endDate?: string;
		includeRawContent?: boolean;
	},
	signal?: AbortSignal,
): Promise<{ text: string; details: Record<string, unknown> }> {
	const body: Record<string, unknown> = {
		query,
		search_depth: params.searchDepth ?? "basic",
		max_results: params.maxResults ?? 5,
		topic: params.topic ?? "general",
	};
	if (params.timeRange) body.time_range = params.timeRange;
	if (params.includeAnswer) body.include_answer = params.includeAnswer;
	if (params.includeDomains?.length) body.include_domains = params.includeDomains;
	if (params.excludeDomains?.length) body.exclude_domains = params.excludeDomains;
	if (params.startDate) body.start_date = params.startDate;
	if (params.endDate) body.end_date = params.endDate;
	if (params.includeRawContent) body.include_raw_content = "markdown";

	const data = (await tavilyRequest("/search", body, signal)) as {
		query: string;
		results: Array<{
			title: string;
			url: string;
			content: string;
			score?: number;
			raw_content?: string;
		}>;
		answer?: string;
		response_time: number;
	};

	const lines: string[] = [];
	lines.push(`[Tavily] ${data.query} (${data.response_time}s)`);
	lines.push("");
	if (data.answer) {
		lines.push("📋 AI Answer:");
		lines.push(data.answer);
		lines.push("");
	}
	for (const r of data.results) {
		lines.push(`[${r.title}](${r.url})`);
		if (r.score !== undefined) lines.push(`   Score: ${(r.score * 100).toFixed(1)}%`);
		lines.push(`   ${r.content.slice(0, 300)}`);
		lines.push("");
	}

	return { text: lines.join("\n"), details: { engine: "tavily", count: data.results.length } };
}

// ═══════════════════════════════════════════════════════════════════
//  Internal: Tavily Extract
// ═══════════════════════════════════════════════════════════════════

async function tavilyExtract(
	urls: string[],
	params: {
		query?: string;
		extractDepth?: string;
		includeImages?: boolean;
	},
	signal?: AbortSignal,
): Promise<{ text: string; details: Record<string, unknown> }> {
	const body: Record<string, unknown> = {
		urls,
		extract_depth: params.extractDepth ?? "basic",
	};
	if (params.query) body.query = params.query;
	if (params.includeImages) body.include_images = true;

	const data = (await tavilyRequest("/extract", body, signal)) as {
		results: Array<{
			url: string;
			raw_content: string;
			images?: string[];
		}>;
		failed_results?: Array<{ url: string; error: string }>;
		response_time: number;
	};

	const lines: string[] = [];
	lines.push(`Extraction completed in ${data.response_time}s`);
	lines.push("");

	for (const r of data.results) {
		lines.push(`=== ${r.url} ===`);
		if (r.raw_content) {
			const truncated = r.raw_content.length > 8000
				? r.raw_content.slice(0, 8000) + "\n\n... [content truncated]"
				: r.raw_content;
			lines.push(truncated);
		} else {
			lines.push("(No content extracted)");
		}
		lines.push("");
	}

	if (data.failed_results?.length) {
		lines.push("=== Failed URLs ===");
		for (const f of data.failed_results) {
			lines.push(`  ${f.url}: ${f.error}`);
		}
		lines.push("");
	}

	return {
		text: lines.join("\n"),
		details: {
			extractedCount: data.results.length,
			failedCount: data.failed_results?.length ?? 0,
			responseTime: data.response_time,
		},
	};
}

// ═══════════════════════════════════════════════════════════════════
//  Internal: Brave API Request
// ═══════════════════════════════════════════════════════════════════

const BRAVE_WEB = "https://api.search.brave.com/res/v1/web/search";

interface BraveResult {
	title: string;
	url: string;
	description?: string;
	age?: string;
}

async function braveRequest(
	endpoint: string,
	query: string,
	params: Record<string, string | number | undefined>,
	signal?: AbortSignal,
): Promise<BraveResult[]> {
	const key = getBraveKey();
	const qs = new URLSearchParams();
	qs.set("q", query);
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined) qs.set(k, String(v));
	}

	const resp = await fetch(`${endpoint}?${qs}`, {
		headers: {
			Accept: "application/json",
			"Accept-Encoding": "gzip",
			"X-Subscription-Token": key,
		},
		signal,
	});

	if (!resp.ok) {
		throw new Error(`Brave API error (${resp.status}): ${resp.statusText}`);
	}

	const data = (await resp.json()) as any;
	const results = data.web?.results ?? data.results ?? [];
	return results.map((r: any) => ({
		title: r.title ?? "",
		url: r.url ?? "",
		description: r.description ?? "",
		age: r.age ?? "",
	}));
}

// ═══════════════════════════════════════════════════════════════════
//  Smart Router
// ═══════════════════════════════════════════════════════════════════

async function smartSearch(
	query: string,
	params: {
		maxResults?: number;
		topic?: string;
		timeRange?: string;
		includeAnswer?: string;
		includeRawContent?: boolean;
		includeDomains?: string[];
		excludeDomains?: string[];
		startDate?: string;
		endDate?: string;
		country?: string;
		searchLang?: string;
	},
	signal?: AbortSignal,
): Promise<{ text: string; details: Record<string, unknown> }> {
	const needAnswer = !!params.includeAnswer;
	const needRawContent = !!params.includeRawContent;

	// Answer / raw content → Tavily
	if (needAnswer || needRawContent) {
		return tavilySearch(query, {
			searchDepth: params.includeAnswer === "advanced" ? "advanced" : "basic",
			maxResults: params.maxResults,
			topic: params.topic,
			timeRange: params.timeRange,
			includeAnswer: params.includeAnswer,
			includeDomains: params.includeDomains,
			excludeDomains: params.excludeDomains,
			startDate: params.startDate,
			endDate: params.endDate,
			includeRawContent: params.includeRawContent,
		}, signal);
	}

	// Finance / News topic if explicitly passed → Tavily
	if (params.topic === "finance" || params.topic === "news") {
		return tavilySearch(query, {
			...params,
			topic: params.topic,
		}, signal);
	}

	// General → round-robin with fallback
	const engine = nextEngine();

	if (engine === "tavily") {
		try {
			return await tavilySearch(query, params, signal);
		} catch (err) {
			const errMsg = String(err);
			const braveResults = await braveRequest(BRAVE_WEB, query, {
				count: params.maxResults ?? 5,
			}, signal);
			const lines: string[] = [];
			lines.push(`[Brave Fallback] ${query} (Tavily: ${errMsg.slice(0, 80)})`);
			lines.push("");
			for (const r of braveResults) {
				lines.push(`🔗 ${r.title}`);
				lines.push(`   ${r.url}`);
				if (r.description) lines.push(`   ${r.description.slice(0, 250)}`);
				lines.push("");
			}
			return { text: lines.join("\n"), details: { engine: "brave-fallback", count: braveResults.length } };
		}
	} else {
		try {
			const braveResults = await braveRequest(BRAVE_WEB, query, {
				count: params.maxResults ?? 5,
			}, signal);
			const lines: string[] = [];
			lines.push(`[Brave] ${query}`);
			lines.push("");
			for (const r of braveResults) {
				lines.push(`🔗 ${r.title}`);
				lines.push(`   ${r.url}`);
				if (r.description) lines.push(`   ${r.description.slice(0, 250)}`);
				lines.push("");
			}
			return { text: lines.join("\n"), details: { engine: "brave", count: braveResults.length } };
		} catch {
			return tavilySearch(query, params, signal);
		}
	}
}

// ═══════════════════════════════════════════════════════════════════
//  Extension Entry Point
// ═══════════════════════════════════════════════════════════════════

export default function (pi: ExtensionAPI) {
	// ─── web_search (smart router) ───────────────────────────────

	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Intelligent web search routing between Tavily and Brave Search. " +
			"Auto-fallback if one engine fails. Returns ranked results with titles, URLs, and snippets.",
		promptSnippet: "web_search - ⭐ DEFAULT search tool. Routes between Tavily & Brave",
		promptGuidelines: [
			"Use web_search as the DEFAULT for ALL search needs.",
			"Set include_answer='basic'/'advanced' for AI-generated answer (routes to Tavily).",
			"For page content from specific URLs, use web_page_extract instead.",
			"DO NOT call multiple search tools in one turn. Use web_search once and read the results.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "The search query to execute" }),
			max_results: Type.Optional(
				Type.Integer({ description: "Maximum results (1-20, default: 5)", minimum: 1, maximum: 20 }),
			),
			topic: Type.Optional(
				StringEnum(
					["general", "news", "finance"] as const,
					{ description: "Optional search topic filter" },
				),
			),
			time_range: Type.Optional(
				StringEnum(
					["day", "week", "month", "year"] as const,
					{ description: "Publish/update date filter" },
				),
			),
			include_answer: Type.Optional(
				StringEnum(
					["basic", "advanced"] as const,
					{ description: "Include AI answer (routes to Tavily). 'basic' quick, 'advanced' detailed." },
				),
			),
			include_domains: Type.Optional(
				Type.Array(Type.String(), { description: "Only these domains (Tavily only, max 300)" }),
			),
			exclude_domains: Type.Optional(
				Type.Array(Type.String(), { description: "Exclude these domains (Tavily only, max 150)" }),
			),
			include_raw_content: Type.Optional(
				Type.Boolean({ description: "Include full HTML content (Tavily only, adds latency)" }),
			),
		}),

		async execute(_id, params, signal, _upd, _ctx) {
			const result = await smartSearch(params.query, {
				maxResults: params.max_results,
				topic: params.topic,
				timeRange: params.time_range,
				includeAnswer: params.include_answer,
				includeDomains: params.include_domains,
				excludeDomains: params.exclude_domains,
				includeRawContent: params.include_raw_content,
			}, signal);

			return {
				content: [{ type: "text", text: result.text }],
				details: result.details,
			};
		},
	});

	// ─── tavily_search (direct Tavily) ──────────────────────────

	pi.registerTool({
		name: "tavily_search",
		label: "Tavily Search",
		description:
			"Direct Tavily web search. Supports advanced search depth, topic filtering (general/news/finance), " +
			"date range, domain inclusion/exclusion, AI-generated answers, and raw content extraction. " +
			"1 credit (basic/fast/ultra-fast) or 2 credits (advanced) per request.",
		promptSnippet: "tavily_search - Direct Tavily search (niche). Only if user explicitly mentions \"Tavily\"",
		promptGuidelines: [
			"ONLY use this when the user explicitly mentions 'Tavily' by name or needs Tavily-specific features (search_depth, include_raw_content).",
			"For all general search needs, use web_search instead.",
			"Set search_depth='advanced' for highest quality (costs 2 credits vs 1).",
			"Use include_domains/exclude_domains to restrict/filter sources (max 300/150).",
			"start_date / end_date format: YYYY-MM-DD.",
			"Do NOT call both tavily_search and web_search in the same turn.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "The search query to execute" }),
			search_depth: StringEnum(
				["basic", "advanced", "fast", "ultra-fast"] as const,
				{ description: "'basic'/'fast'/'ultra-fast'=1 credit, 'advanced'=2 credits" },
			),
			max_results: Type.Optional(
				Type.Integer({ description: "Maximum results (0-20, default: 5)", minimum: 0, maximum: 20 }),
			),
			topic: StringEnum(
				["general", "news", "finance"] as const,
				{ description: "Search category: general, news, or finance" },
			),
			time_range: Type.Optional(
				StringEnum(
					["day", "week", "month", "year"] as const,
					{ description: "Publish/update date filter" },
				),
			),
			include_answer: Type.Optional(
				StringEnum(
					["basic", "advanced"] as const,
					{ description: "Include LLM-generated answer" },
				),
			),
			include_domains: Type.Optional(
				Type.Array(Type.String(), { description: "Only include these domains (max 300)" }),
			),
			exclude_domains: Type.Optional(
				Type.Array(Type.String(), { description: "Exclude these domains (max 150)" }),
			),
			start_date: Type.Optional(
				Type.String({ description: "Return results after YYYY-MM-DD" }),
			),
			end_date: Type.Optional(
				Type.String({ description: "Return results before YYYY-MM-DD" }),
			),
			include_raw_content: Type.Optional(
				Type.Boolean({ description: "Include cleaned HTML of each result (adds latency)" }),
			),
		}),

		async execute(_id, params, signal, _upd, _ctx) {
			const result = await tavilySearch(params.query, {
				searchDepth: params.search_depth,
				maxResults: params.max_results,
				topic: params.topic,
				timeRange: params.time_range,
				includeAnswer: params.include_answer,
				includeDomains: params.include_domains,
				excludeDomains: params.exclude_domains,
				startDate: params.start_date,
				endDate: params.end_date,
				includeRawContent: params.include_raw_content,
			}, signal);

			return {
				content: [{ type: "text", text: result.text }],
				details: result.details,
			};
		},
	});

	// ─── web_page_extract ───────────────────────────────────────

	pi.registerTool({
		name: "web_page_extract",
		label: "Web Page Extract",
		description:
			"Extract clean, LLM-ready content from one or more URLs. " +
			"Supports basic (1 credit/5 URLs) and advanced (2 credits/5 URLs) extraction depths, " +
			"optional query-based chunk reranking, and image extraction.",
		promptSnippet: "web_page_extract - Extract page content from known URLs (after web_search)",
		promptGuidelines: [
			"Use AFTER web_search — when you have specific URLs and need their full page content.",
			"Extract only the most promising results from a web_search, not multiple randomly.",
			"Set extract_depth='advanced' for tables and embedded content (2 credits per 5 URLs).",
			"Add a query parameter to rerank extracted chunks by relevance.",
			"Pass up to 20 URLs in one request.",
			"Do NOT call this without first doing a web_search to find relevant URLs.",
		],
		parameters: Type.Object({
			urls: Type.Array(Type.String(), {
				description: "URLs to extract content from (max 20)",
			}),
			query: Type.Optional(
				Type.String({ description: "Rerank chunks by relevance to this query" }),
			),
			extract_depth: StringEnum(
				["basic", "advanced"] as const,
				{ description: "'basic'=1 cr/5 URLs, 'advanced'=2 cr/5 URLs, richer content" },
			),
			include_images: Type.Optional(
				Type.Boolean({ description: "Include images extracted from the URLs" }),
			),
		}),

		async execute(_id, params, signal, _upd, _ctx) {
			const result = await tavilyExtract(params.urls, {
				query: params.query,
				extractDepth: params.extract_depth,
				includeImages: params.include_images,
			}, signal);

			return {
				content: [{ type: "text", text: result.text }],
				details: result.details,
			};
		},
	});

}
