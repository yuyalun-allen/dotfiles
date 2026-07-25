/**
 * Browser Use Extension for Pi
 *
 * Adds browser automation capabilities using Playwright.
 * Provides tools for navigation, interaction, data extraction,
 * tab management, and cookie handling.
 *
 * Modes:
 *   headless (default) - Uses Firefox in headless mode, no persistent profile
 *   headful            - Uses Chromium with persistent userDataDir (~/.config/pi/browser-profile/)
 *
 * Note: This extension does NOT use screenshot/multimodal capabilities.
 * All page state is reported via HTML/text extraction.
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateHead, formatSize, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { chromium, firefox, type Page, type BrowserContext } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════

const HEADFUL_PROFILE_DIR = join(process.env.HOME || "~", ".config", "pi", "browser-profile");
const PAGE_TIMEOUT = 30000;

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

interface BrowserState {
	isOpen: boolean;
	mode: "headless" | "headful";
	url: string | null;
	title: string | null;
	tabCount: number;
	activeTab: number;
}

// ═══════════════════════════════════════════════════════════════════
//  Tool Parameter Schemas
// ═══════════════════════════════════════════════════════════════════

const browserOpenParams = Type.Object({
	headless: Type.Optional(
		Type.Boolean({ description: "Use headless mode (default true). false opens a visible window with persistent profile." }),
	),
	url: Type.Optional(Type.String({ description: "URL to navigate to after opening" })),
});

const browserUrlParams = Type.Object({
	url: Type.String({ description: "The URL to navigate to" }),
});

const browserSelectorParams = Type.Object({
	selector: Type.String({ description: "CSS selector for the target element" }),
	button: Type.Optional(
		StringEnum(["left", "right", "middle"] as const, { description: "Mouse button to click (default: left)" }),
	),
});

const browserTypeParams = Type.Object({
	selector: Type.String({ description: "CSS selector for the input element" }),
	text: Type.String({ description: "Text to type" }),
	clear_first: Type.Optional(
		Type.Boolean({ description: "Clear the field before typing (default: true)" }),
	),
});

const browserSelectParams = Type.Object({
	selector: Type.String({ description: "CSS selector for the <select> element" }),
	value: Type.String({ description: "Option value to select" }),
});

const browserHoverParams = Type.Object({
	selector: Type.String({ description: "CSS selector for the element to hover over" }),
});

const browserScrollParams = Type.Object({
	direction: StringEnum(["up", "down", "left", "right"] as const, { description: "Scroll direction" }),
	amount: Type.Optional(
		StringEnum(["small", "medium", "large"] as const, { description: "Scroll amount (default: medium)" }),
	),
});

const browserGetHtmlParams = Type.Object({
	selector: Type.Optional(
		Type.String({ description: "CSS selector to extract text from (default: body)" }),
	),
});

const browserEvaluateParams = Type.Object({
	code: Type.String({ description: "JavaScript code to execute in the page context" }),
});

const browserTabParams = Type.Object({
	url: Type.String({ description: "URL to open in the new tab" }),
});

const browserSwitchTabParams = Type.Object({
	index: Type.Number({ description: "Index of the tab to switch to (0-based)" }),
});

const browserCloseTabParams = Type.Object({
	index: Type.Optional(
		Type.Number({ description: "Index of the tab to close (default: active tab)" }),
	),
});

const browserGetCookiesParams = Type.Object({
	url: Type.Optional(Type.String({ description: "URL to get cookies for (default: current page URL)" })),
});

// ═══════════════════════════════════════════════════════════════════
//  Utility Functions
// ═══════════════════════════════════════════════════════════════════

function buildState(page: Page | null, ctx: BrowserContext | null, mode: "headless" | "headful"): BrowserState {
	if (!ctx || !page || page.isClosed()) {
		return { isOpen: false, mode, url: null, title: null, tabCount: 0, activeTab: 0 };
	}
	const pages = ctx.pages();
	const activeIdx = pages.indexOf(page);
	return {
		isOpen: true,
		mode,
		url: page.url(),
		title: null,
		tabCount: pages.length,
		activeTab: activeIdx >= 0 ? activeIdx : 0,
	};
}

async function getPageSummary(page: Page): Promise<string> {
	try {
		const title = await page.title().catch(() => "(no title)");
		const url = page.url();
		// Get a brief text preview of the page
		let preview = "";
		try {
			const text = await page.evaluate(() => {
				const body = document.body;
				if (!body) return "";
				const text = body.innerText || "";
				return text.replace(/\s+/g, " ").trim().slice(0, 500);
			});
			if (text) preview = `\n\nPage preview:\n${text}${text.length >= 500 ? "..." : ""}`;
		} catch {}
		return `${title}\n${url}${preview}`;
	} catch {
		return "(page unavailable)";
	}
}

function truncateOutput(text: string): string {
	const trunc = truncateHead(text, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
	let result = trunc.content;
	if (trunc.truncated) {
		result += `\n\n[Output truncated: ${trunc.outputLines}/${trunc.totalLines} lines`;
		result += ` (${formatSize(trunc.outputBytes)}/${formatSize(trunc.totalBytes)})]`;
	}
	return result;
}

// ═══════════════════════════════════════════════════════════════════
//  Main Extension
// ═══════════════════════════════════════════════════════════════════

export default function (pi: ExtensionAPI) {
	let context: BrowserContext | null = null;
	let activePage: Page | null = null;
	let mode: "headless" | "headful" = "headless";

	// ── Helpers ─────────────────────────────────────────────────

	function requireBrowser(): Page {
		if (!context || !activePage || activePage.isClosed()) {
			throw new Error("Browser is not open. Call `browser_open` first.");
		}
		return activePage;
	}

	function updateStatus(ctx: any) {
		if (!context || !activePage || activePage.isClosed()) {
			ctx.ui.setStatus("browser", undefined);
			return;
		}
		try {
			const url = activePage.url();
			const icon = mode === "headful" ? "🖥️" : "🌐";
			const label = url.length > 50 ? url.slice(0, 47) + "..." : url;
			ctx.ui.setStatus("browser", `${icon} ${label}`);
		} catch {
			ctx.ui.setStatus("browser", undefined);
		}
	}

	async function closeBrowser() {
		try {
			if (context) await context.close().catch(() => {});
		} finally {
			context = null;
			activePage = null;
		}
	}

	// ── Session lifecycle ───────────────────────────────────────

	function reconstructState(ctx: any) {
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const msg = entry.message;
			if (msg.role !== "toolResult") continue;
			const toolName = msg.toolName as string;
			if (!toolName?.startsWith("browser_")) continue;
			const details = msg.details as BrowserState | undefined;
			if (details) mode = details.mode;
		}
		context = null;
		activePage = null;
	}

	pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_shutdown", async () => { await closeBrowser(); });

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_open
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_open",
		label: "Open Browser",
		description: "Open a browser window. Use headless=true (default) for a private session. Use headless=false to open a visible window with persistent cookies and profile.",
		promptSnippet: "browser_open - Open/start a browser for web browsing",
		parameters: browserOpenParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (context) {
				throw new Error("Browser is already open. Call `browser_close` first to change mode.");
			}

			const isHeadless = params.headless !== false;
			mode = isHeadless ? "headless" : "headful";

			try {
				if (isHeadless) {
					const br = await firefox.launch({ headless: true });
					context = await br.newContext();
				} else {
					await mkdir(HEADFUL_PROFILE_DIR, { recursive: true });
					context = await chromium.launchPersistentContext(HEADFUL_PROFILE_DIR, { headless: false });
				}

				const pages = context.pages();
				activePage = pages.length > 0 ? pages[0] : await context.newPage();

				if (params.url) {
					await activePage.goto(params.url, { timeout: PAGE_TIMEOUT, waitUntil: "domcontentloaded" });
				}

				updateStatus(ctx);
				const summary = await getPageSummary(activePage);

				return {
					content: [{ type: "text", text: `Browser opened in ${mode} mode.\n\n${summary}` }],
					details: { ...buildState(activePage, context, mode), title: summary.split("\n")[0] } as BrowserState,
				};
			} catch (err: any) {
				await closeBrowser();
				throw new Error(`Failed to open browser: ${err.message}`);
			}
		},

		renderCall(args, theme, _context) {
			const m = args.headless !== false ? "headless" : "headful";
			let t = theme.fg("toolTitle", theme.bold("browser_open ")) + theme.fg("muted", m);
			if (args.url) t += theme.fg("dim", `  → ${args.url}`);
			return new Text(t, 0, 0);
		},

		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Opening browser..."), 0, 0);
			const d = result.details as BrowserState | undefined;
			if (!d?.isOpen) return new Text(theme.fg("error", "Failed to open browser"), 0, 0);
			return new Text(
				theme.fg("success", `✓ ${d.mode} browser opened`) + (d.url ? `\n${theme.fg("dim", d.url)}` : ""),
				0, 0,
			);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_close
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_close",
		label: "Close Browser",
		description: "Close the browser and end the browsing session.",
		promptSnippet: "browser_close - Close the browser",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			if (!context) throw new Error("No browser is open.");
			await closeBrowser();
			ctx.ui.setStatus("browser", undefined);
			return {
				content: [{ type: "text", text: "Browser closed." }],
				details: { isOpen: false, mode, url: null, title: null, tabCount: 0, activeTab: 0 } as BrowserState,
			};
		},

		renderCall(_args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_close")), 0, 0);
		},

		renderResult(_result, _opts, theme, _context) {
			return new Text(theme.fg("success", "✓ Browser closed"), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_navigate
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_navigate",
		label: "Navigate",
		description: "Navigate the current page to a URL.",
		promptSnippet: "browser_navigate - Navigate to a URL",
		parameters: browserUrlParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const page = requireBrowser();
			try {
				await page.goto(params.url, { timeout: PAGE_TIMEOUT, waitUntil: "domcontentloaded" });
				updateStatus(ctx);
				const summary = await getPageSummary(page);
				return {
					content: [{ type: "text", text: `Navigated to:\n\n${summary}` }],
					details: { ...buildState(page, context, mode), title: summary.split("\n")[0] } as BrowserState,
				};
			} catch (err: any) {
				throw new Error(`Navigation failed: ${err.message}`);
			}
		},

		renderCall(args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_navigate ")) + theme.fg("accent", args.url), 0, 0);
		},

		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Navigating..."), 0, 0);
			return new Text(theme.fg("success", "✓ Navigated"), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_reload
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_reload",
		label: "Reload",
		description: "Reload the current page.",
		promptSnippet: "browser_reload - Reload the current page",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const page = requireBrowser();
			await page.reload({ timeout: PAGE_TIMEOUT, waitUntil: "domcontentloaded" });
			updateStatus(ctx);
			const summary = await getPageSummary(page);
			return {
				content: [{ type: "text", text: `Page reloaded.\n\n${summary}` }],
				details: { ...buildState(page, context, mode), title: summary.split("\n")[0] } as BrowserState,
			};
		},

		renderCall(_args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_reload")), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_back / browser_forward
	// ═════════════════════════════════════════════════════════════

	function registerNavTool(name: string, label: string, desc: string, fn: (p: Page) => Promise<void>) {
		pi.registerTool({
			name, label, description: desc, promptSnippet: `${name} - ${label}`,
			parameters: Type.Object({}),
			async execute(_id, _p, _sig, _upd, ctx) {
				const page = requireBrowser();
				await fn(page);
				await page.waitForTimeout(500);
				updateStatus(ctx);
				const summary = await getPageSummary(page);
				return {
					content: [{ type: "text", text: `${label}.\n\n${summary}` }],
					details: { ...buildState(page, context, mode), title: summary.split("\n")[0] } as BrowserState,
				};
			},
			renderCall(_args, theme, _context) {
				return new Text(theme.fg("toolTitle", theme.bold(name)), 0, 0);
			},
		});
	}
	registerNavTool("browser_back", "Go Back", "Go back to the previous page in history.", (p) => p.goBack());
	registerNavTool("browser_forward", "Go Forward", "Go forward to the next page in history.", (p) => p.goForward());

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_click
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_click",
		label: "Click",
		description: "Click on an element identified by CSS selector.",
		promptSnippet: "browser_click - Click on an element",
		parameters: browserSelectorParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const page = requireBrowser();
			try {
				await page.waitForSelector(params.selector, { timeout: PAGE_TIMEOUT });
				await page.click(params.selector, { button: params.button || "left" });
				await page.waitForTimeout(500);
				updateStatus(ctx);
				const summary = await getPageSummary(page);
				return {
					content: [{ type: "text", text: `Clicked: ${params.selector}\n\n${summary}` }],
					details: { ...buildState(page, context, mode), lastAction: `click ${params.selector}` } as any,
				};
			} catch (err: any) {
				let hint = "";
				try {
					const buttons = await page.evaluate(() => {
						const els = document.querySelectorAll("button, a, input, [role=button], select, textarea");
						return Array.from(els).slice(0, 20).map((e) => {
							const tag = e.tagName.toLowerCase();
							const text = (e.textContent || "").trim().slice(0, 40);
							const id = e.id ? `#${e.id}` : "";
							const cls = e.className && typeof e.className === "string" ? `.${e.className.split(" ")[0]}` : "";
							return `<${tag}${id}${cls}> ${JSON.stringify(text)}`;
						});
					});
					hint = `\n\nAvailable interactive elements (top 20):\n${buttons.join("\n")}`;
				} catch {}
				throw new Error(`Cannot click '${params.selector}': ${err.message}${hint}`);
			}
		},

		renderCall(args, theme, _context) {
			let t = theme.fg("toolTitle", theme.bold("browser_click ")) + theme.fg("accent", args.selector);
			if (args.button && args.button !== "left") t += theme.fg("dim", ` (${args.button})`);
			return new Text(t, 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_type
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_type",
		label: "Type",
		description: "Type text into an input field identified by CSS selector.",
		promptSnippet: "browser_type - Type text into an input",
		parameters: browserTypeParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const page = requireBrowser();
			try {
				await page.waitForSelector(params.selector, { timeout: PAGE_TIMEOUT });
				if (params.clear_first !== false) await page.fill(params.selector, "");
				await page.fill(params.selector, params.text);
				await page.waitForTimeout(200);
				updateStatus(ctx);
				const summary = await getPageSummary(page);
				return {
					content: [{ type: "text", text: `Typed "${params.text}" into ${params.selector}\n\n${summary}` }],
					details: { ...buildState(page, context, mode), lastAction: `type ${params.selector}` } as any,
				};
			} catch (err: any) {
				throw new Error(`Cannot type into '${params.selector}': ${err.message}`);
			}
		},

		renderCall(args, theme, _context) {
			return new Text(
				theme.fg("toolTitle", theme.bold("browser_type ")) + theme.fg("accent", args.selector) + theme.fg("dim", ` "${args.text}"`),
				0, 0,
			);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_select
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_select",
		label: "Select Option",
		description: "Select an option from a <select> dropdown by value.",
		promptSnippet: "browser_select - Select a dropdown option",
		parameters: browserSelectParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const page = requireBrowser();
			try {
				await page.waitForSelector(params.selector, { timeout: PAGE_TIMEOUT });
				await page.selectOption(params.selector, params.value);
				await page.waitForTimeout(300);
				updateStatus(ctx);
				const summary = await getPageSummary(page);
				return {
					content: [{ type: "text", text: `Selected "${params.value}" in ${params.selector}\n\n${summary}` }],
					details: { ...buildState(page, context, mode), lastAction: `select ${params.selector}` } as any,
				};
			} catch (err: any) {
				let hint = "";
				try {
					const opts = await page.evaluate((sel) => {
						const el = document.querySelector(sel) as HTMLSelectElement | null;
						if (!el) return null;
						return Array.from(el.options).map((o) => `  ${o.value}: ${JSON.stringify(o.text)}`);
					}, params.selector);
					if (opts) hint = `\n\nAvailable options:\n${opts.join("\n")}`;
				} catch {}
				throw new Error(`Cannot select in '${params.selector}': ${err.message}${hint}`);
			}
		},

		renderCall(args, theme, _context) {
			return new Text(
				theme.fg("toolTitle", theme.bold("browser_select ")) + theme.fg("accent", args.selector) + theme.fg("dim", ` → "${args.value}"`),
				0, 0,
			);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_hover
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_hover",
		label: "Hover",
		description: "Hover over an element identified by CSS selector.",
		promptSnippet: "browser_hover - Hover over an element",
		parameters: browserHoverParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const page = requireBrowser();
			try {
				await page.waitForSelector(params.selector, { timeout: PAGE_TIMEOUT });
				await page.hover(params.selector);
				await page.waitForTimeout(300);
				updateStatus(ctx);
				const summary = await getPageSummary(page);
				return {
					content: [{ type: "text", text: `Hovered over: ${params.selector}\n\n${summary}` }],
					details: { ...buildState(page, context, mode), lastAction: `hover ${params.selector}` } as any,
				};
			} catch (err: any) {
				throw new Error(`Cannot hover over '${params.selector}': ${err.message}`);
			}
		},

		renderCall(args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_hover ")) + theme.fg("accent", args.selector), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_scroll
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_scroll",
		label: "Scroll",
		description: "Scroll the page in a specified direction.",
		promptSnippet: "browser_scroll - Scroll the page",
		parameters: browserScrollParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const page = requireBrowser();
			const amounts: Record<string, number> = { small: 200, medium: 500, large: 1000 };
			const amt = amounts[params.amount || "medium"];
			const dx = params.direction === "right" ? amt : params.direction === "left" ? -amt : 0;
			const dy = params.direction === "down" ? amt : params.direction === "up" ? -amt : 0;
			await page.evaluate(({ dx, dy }) => window.scrollBy(dx, dy), { dx, dy });
			await page.waitForTimeout(300);
			updateStatus(ctx);
			const summary = await getPageSummary(page);
			return {
				content: [{ type: "text", text: `Scrolled ${params.direction} (${params.amount || "medium"})\n\n${summary}` }],
				details: { ...buildState(page, context, mode), lastAction: `scroll ${params.direction}` } as any,
			};
		},

		renderCall(args, theme, _context) {
			let t = theme.fg("toolTitle", theme.bold("browser_scroll ")) + theme.fg("muted", args.direction);
			if (args.amount) t += theme.fg("dim", ` (${args.amount})`);
			return new Text(t, 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_get_html
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_get_html",
		label: "Get HTML",
		description: "Get the visible text content of the page or a specific element.",
		promptSnippet: "browser_get_html - Extract page/element text content",
		parameters: browserGetHtmlParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const page = requireBrowser();
			const selector = params.selector || "body";
			try {
				const text = await page.evaluate((sel: string) => {
					const el = document.querySelector(sel);
					return el ? (el as HTMLElement).innerText || el.textContent || "" : `Element '${sel}' not found`;
				}, selector);
				return {
					content: [{ type: "text", text: truncateOutput(text) }],
					details: { ...buildState(page, context, mode), lastAction: "get_html" } as any,
				};
			} catch (err: any) {
				throw new Error(`Cannot get HTML from '${selector}': ${err.message}`);
			}
		},

		renderCall(args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_get_html ")) + theme.fg("muted", args.selector || "body"), 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const c = result.content[0];
			if (c?.type !== "text") return null;
			const lines = c.text.split("\n");
			let d = theme.fg("success", `${lines.length} lines`);
			if (expanded && lines.length <= 30) {
				d += `\n${theme.fg("dim", c.text)}`;
			} else if (expanded) {
				d += `\n${theme.fg("dim", lines.slice(0, 20).join("\n"))}`;
				d += `\n${theme.fg("warning", `... ${lines.length - 20} more lines`)}`;
			}
			return new Text(d, 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_evaluate
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_evaluate",
		label: "Evaluate JS",
		description: "Execute JavaScript code in the page context and return the result.",
		promptSnippet: "browser_evaluate - Run JavaScript in the page",
		parameters: browserEvaluateParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const page = requireBrowser();
			try {
				const result = await page.evaluate((code) => {
					try { return JSON.stringify(eval(code), null, 2); }
					catch { return String(eval(code)); }
				}, params.code);
				return {
					content: [{ type: "text", text: truncateOutput(result) }],
					details: { ...buildState(page, context, mode), lastAction: "evaluate" } as any,
				};
			} catch (err: any) {
				throw new Error(`JavaScript evaluation failed: ${err.message}`);
			}
		},

		renderCall(args, theme, _context) {
			const snippet = args.code.length > 60 ? args.code.slice(0, 57) + "..." : args.code;
			return new Text(theme.fg("toolTitle", theme.bold("browser_evaluate ")) + theme.fg("dim", `"${snippet}"`), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_new_tab
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_new_tab",
		label: "New Tab",
		description: "Open a new tab and navigate to a URL.",
		promptSnippet: "browser_new_tab - Open a new browser tab",
		parameters: browserTabParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!context) throw new Error("Browser is not open. Call `browser_open` first.");
			const page = await context.newPage();
			await page.goto(params.url, { timeout: PAGE_TIMEOUT, waitUntil: "domcontentloaded" });
			activePage = page;
			updateStatus(ctx);
			const summary = await getPageSummary(page);
			return {
				content: [{ type: "text", text: `New tab opened:\n\n${summary}` }],
				details: { ...buildState(page, context, mode), title: summary.split("\n")[0] } as BrowserState,
			};
		},

		renderCall(args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_new_tab ")) + theme.fg("accent", args.url), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_list_tabs
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_list_tabs",
		label: "List Tabs",
		description: "List all open tabs with their index, title, and URL.",
		promptSnippet: "browser_list_tabs - List all open tabs",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			if (!context) throw new Error("Browser is not open. Call `browser_open` first.");
			const pages = context.pages();
			const tabList = await Promise.all(
				pages.map(async (p, i) => {
					const isActive = p === activePage && !p.isClosed();
					try {
						const title = await p.title().catch(() => "(no title)");
						return `${isActive ? "*" : " "} [${i}] ${title}\n    ${p.url()}`;
					} catch {
						return `${isActive ? "*" : " "} [${i}] (closed)`;
					}
				}),
			);
			return {
				content: [{ type: "text", text: `Open tabs (${pages.length}):\n\n${tabList.join("\n\n")}` }],
				details: buildState(activePage, context, mode) as BrowserState,
			};
		},

		renderCall(_args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_list_tabs")), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_switch_tab
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_switch_tab",
		label: "Switch Tab",
		description: "Switch to a different tab by index (use browser_list_tabs to see indices).",
		promptSnippet: "browser_switch_tab - Switch to a tab",
		parameters: browserSwitchTabParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!context) throw new Error("Browser is not open. Call `browser_open` first.");
			const pages = context.pages();
			if (params.index < 0 || params.index >= pages.length) {
				throw new Error(`Invalid tab index ${params.index}. Open tabs: 0-${pages.length - 1}. Use browser_list_tabs to see available tabs.`);
			}
			const page = pages[params.index];
			if (page.isClosed()) throw new Error(`Tab ${params.index} is closed.`);
			await page.bringToFront();
			activePage = page;
			updateStatus(ctx);
			const summary = await getPageSummary(page);
			return {
				content: [{ type: "text", text: `Switched to tab [${params.index}]:\n\n${summary}` }],
				details: { ...buildState(page, context, mode), title: summary.split("\n")[0] } as BrowserState,
			};
		},

		renderCall(args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_switch_tab ")) + theme.fg("accent", `[${args.index}]`), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_close_tab
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_close_tab",
		label: "Close Tab",
		description: "Close a tab by index (default: active tab).",
		promptSnippet: "browser_close_tab - Close a tab",
		parameters: browserCloseTabParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!context) throw new Error("Browser is not open. Call `browser_open` first.");
			const pages = context.pages();

			if (pages.length <= 1) {
				await closeBrowser();
				ctx.ui.setStatus("browser", undefined);
				return {
					content: [{ type: "text", text: "Last tab closed. Browser shut down." }],
					details: { isOpen: false, mode, url: null, title: null, tabCount: 0, activeTab: 0 } as BrowserState,
				};
			}

			const idx = params.index !== undefined ? params.index : pages.indexOf(activePage!);
			if (idx < 0 || idx >= pages.length) throw new Error(`Invalid tab index ${idx}.`);
			await pages[idx].close();

			const remaining = context.pages();
			if (remaining.length > 0) {
				activePage = remaining[Math.min(idx, remaining.length - 1)];
				await activePage.bringToFront();
			}
			updateStatus(ctx);

			const summary = activePage ? await getPageSummary(activePage) : "Browser closed";

			return {
				content: [{ type: "text", text: `Closed tab [${idx}].\n\nActive tab:\n${summary}` }],
				details: {
					...(activePage ? buildState(activePage, context, mode) : { isOpen: false, mode, url: null, title: null, tabCount: 0, activeTab: 0 }),
				} as BrowserState,
			};
		},

		renderCall(args, theme, _context) {
			let t = theme.fg("toolTitle", theme.bold("browser_close_tab"));
			if (args.index !== undefined) t += theme.fg("accent", ` [${args.index}]`);
			return new Text(t, 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_get_cookies
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_get_cookies",
		label: "Get Cookies",
		description: "Get cookies for the current page or a specific URL.",
		promptSnippet: "browser_get_cookies - Get browser cookies",
		parameters: browserGetCookiesParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			if (!context) throw new Error("Browser is not open. Call `browser_open` first.");
			const url = params.url || activePage?.url();
			const cookies = url ? await context.cookies(url) : await context.cookies();
			const text = cookies.length === 0
				? "No cookies found."
				: cookies.map((c) => `  ${c.name}: ${c.value.slice(0, 50)}${c.value.length > 50 ? "..." : ""} (${c.domain})`).join("\n");
			return {
				content: [{ type: "text", text: truncateOutput(`Cookies (${cookies.length}):\n\n${text}`) }],
				details: { ...(activePage ? buildState(activePage, context, mode) : {}), lastAction: "get_cookies", cookieCount: cookies.length } as any,
			};
		},

		renderCall(args, theme, _context) {
			let t = theme.fg("toolTitle", theme.bold("browser_get_cookies"));
			if (args.url) t += theme.fg("dim", ` for ${args.url}`);
			return new Text(t, 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Tool: browser_clear_cookies
	// ═════════════════════════════════════════════════════════════

	pi.registerTool({
		name: "browser_clear_cookies",
		label: "Clear Cookies",
		description: "Clear all cookies. Only available in headless mode (headful mode cookies persist to disk).",
		promptSnippet: "browser_clear_cookies - Clear cookies",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			if (!context) throw new Error("Browser is not open. Call `browser_open` first.");
			if (mode !== "headless") {
				throw new Error("Cannot clear cookies in headful mode. Headful mode uses a persistent profile. Close and reopen in headless mode for a clean session.");
			}
			await context.clearCookies();
			return {
				content: [{ type: "text", text: "All cookies cleared." }],
				details: { ...(activePage ? buildState(activePage, context, mode) : {}), lastAction: "clear_cookies" } as any,
			};
		},

		renderCall(_args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("browser_clear_cookies")), 0, 0);
		},
	});

	// ═════════════════════════════════════════════════════════════
	//  Command: /browser-status
	// ═════════════════════════════════════════════════════════════

	pi.registerCommand("browser-status", {
		description: "Show current browser status (open/closed, mode, URL)",
		handler: async (_args, ctx) => {
			const state = buildState(activePage, context, mode);
			ctx.ui.notify(
				[
					"Browser Status:",
					`  Open: ${state.isOpen}`,
					`  Mode: ${state.mode}`,
					`  URL:  ${state.url || "(none)"}`,
					`  Tabs: ${state.tabCount} (active: ${state.activeTab})`,
				].join("\n"),
				"info",
			);
		},
	});
}
