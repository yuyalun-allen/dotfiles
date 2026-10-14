import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

interface CodexAuth {
	type?: string;
	access?: string;
	refresh?: string;
	expires?: number;
	accountId?: string;
	[key: string]: unknown;
}

interface RateLimitWindow {
	used_percent: number;
	limit_window_seconds: number;
	reset_after_seconds?: number;
	reset_at?: number;
}

interface WhamUsageResponse {
	user_id?: string;
	account_id?: string;
	email?: string;
	plan_type?: string;
	rate_limit?: {
		allowed?: boolean;
		limit_reached?: boolean;
		primary_window?: RateLimitWindow | null;
		secondary_window?: RateLimitWindow | null;
	};
	credits?: {
		has_credits?: boolean;
		balance?: string;
	};
	rate_limit_reset_credits?: {
		available_count?: number;
	};
	[key: string]: unknown;
}

function getAuthFilePath(): string {
	const customDir = process.env.PI_CODING_AGENT_DIR;
	if (customDir) {
		return join(customDir, "auth.json");
	}
	return join(homedir(), ".config", "pi", "agent", "auth.json");
}

async function loadAuth(): Promise<{ raw: Record<string, unknown>; codex?: CodexAuth }> {
	const authPath = getAuthFilePath();
	const content = await readFile(authPath, "utf-8");
	const raw = JSON.parse(content) as Record<string, unknown>;
	return { raw, codex: raw["openai-codex"] as CodexAuth | undefined };
}

async function refreshTokenIfNeeded(rawAuth: Record<string, unknown>, codex: CodexAuth): Promise<string> {
	const now = Date.now();
	// 如果还有至少 60 秒有效期，直接复用 access token
	if (codex.access && codex.expires && codex.expires - now > 60000) {
		return codex.access;
	}

	if (!codex.refresh) {
		if (codex.access) return codex.access;
		throw new Error("未找到 refresh_token，请先在 pi 中登录 openai-codex (/login)");
	}

	const resp = await fetch("https://auth.openai.com/oauth/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "refresh_token",
			client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
			refresh_token: codex.refresh,
		}).toString(),
	});

	if (!resp.ok) {
		const errText = await resp.text();
		throw new Error(`刷新 Token 失败 (${resp.status}): ${errText}`);
	}

	const tokenData = (await resp.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
	};

	codex.access = tokenData.access_token;
	if (tokenData.refresh_token) {
		codex.refresh = tokenData.refresh_token;
	}
	if (tokenData.expires_in) {
		codex.expires = Date.now() + tokenData.expires_in * 1000;
	}

	rawAuth["openai-codex"] = codex;
	await writeFile(getAuthFilePath(), JSON.stringify(rawAuth, null, 2), "utf-8");
	return tokenData.access_token;
}

function formatDuration(seconds: number): string {
	if (seconds <= 0) return "即将重置";
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const mins = Math.floor((seconds % 3600) / 60);

	const parts: string[] = [];
	if (days > 0) parts.push(`${days}天`);
	if (hours > 0) parts.push(`${hours}小时`);
	if (mins > 0 || parts.length === 0) parts.push(`${mins}分钟`);
	return parts.join("");
}

function formatTimestamp(timestampSec: number): string {
	const date = new Date(timestampSec * 1000);
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const h = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return `${y}-${m}-${d} ${h}:${min}`;
}

function formatWindow(win: RateLimitWindow | null | undefined): string {
	if (!win) return "无限制 / 未启用";
	const secs = win.limit_window_seconds;
	let label = `${secs}秒`;
	if (secs === 18000) label = "5 小时 (Rolling 5h)";
	else if (secs === 604800) label = "7 天 (Weekly)";

	const percent = win.used_percent;
	const remainingPercent = Math.max(0, 100 - percent);
	const barLength = 16;
	const usedBars = Math.min(barLength, Math.round((percent / 100) * barLength));
	const progressBar = "█".repeat(usedBars) + "░".repeat(barLength - usedBars);

	let info = `[${progressBar}] 已用 ${percent}% (剩余 ${remainingPercent}%)`;
	if (win.reset_after_seconds !== undefined) {
		info += `\n   ⏳ 距离重置: ${formatDuration(win.reset_after_seconds)}`;
	}
	if (win.reset_at) {
		info += ` (${formatTimestamp(win.reset_at)})`;
	}
	return `【${label}】\n   ${info}`;
}

async function fetchCodexUsage(): Promise<WhamUsageResponse> {
	const { raw, codex } = await loadAuth();
	if (!codex) {
		throw new Error("未找到 openai-codex 授权信息。请先使用 /login 登录。");
	}

	const accessToken = await refreshTokenIfNeeded(raw, codex);
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)",
	};
	if (codex.accountId) {
		headers["ChatGPT-Account-Id"] = codex.accountId;
	}

	const resp = await fetch("https://chatgpt.com/backend-api/wham/usage", {
		headers,
	});

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`查询用量失败 (${resp.status}): ${text}`);
	}

	return (await resp.json()) as WhamUsageResponse;
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("openai-usage", {
		description: "查看 OpenAI Codex 订阅配额使用情况 (5小时 / 周限制)",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			if (ctx.hasUI) {
				ctx.ui.notify("正在查询 OpenAI Codex 用量配额…", "info");
			}

			try {
				const usage = await fetchCodexUsage();
				const rateLimit = usage.rate_limit || {};
				const allowedText = rateLimit.allowed === false ? "❌ 已受限 (Exceeded)" : "✅ 正常 (Allowed)";

				const primary = rateLimit.primary_window;
				const secondary = rateLimit.secondary_window;

				// 自动区分 5h 与 Weekly 窗口
				let fiveHourWin: RateLimitWindow | null | undefined = null;
				let weeklyWin: RateLimitWindow | null | undefined = null;

				for (const win of [primary, secondary]) {
					if (!win) continue;
					if (win.limit_window_seconds === 18000) fiveHourWin = win;
					else if (win.limit_window_seconds === 604800) weeklyWin = win;
				}

				const lines = [
					`📊 OpenAI Codex 配额情况`,
					`----------------------------------------`,
					`👤 账户: ${usage.email || usage.user_id || "未知"}`,
					`📦 套餐: ${usage.plan_type || "未知"} | 状态: ${allowedText}`,
					``,
					fiveHourWin
						? formatWindow(fiveHourWin)
						: `【5 小时 (Rolling 5h)】\n   无独立限制 / 未启用`,
					``,
					weeklyWin
						? formatWindow(weeklyWin)
						: (primary && !fiveHourWin ? formatWindow(primary) : `【7 天 (Weekly)】\n   未单独限制`),
				];

				if (usage.rate_limit_reset_credits?.available_count) {
					lines.push(
						``,
						`🔄 可用重置积分 (Reset Credits): ${usage.rate_limit_reset_credits.available_count}`,
					);
				}

				const output = lines.join("\n");
				if (ctx.hasUI) {
					ctx.ui.notify(output, "info");
				} else {
					console.log(output);
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				if (ctx.hasUI) {
					ctx.ui.notify(`查询失败: ${msg}`, "error");
				} else {
					console.error(`查询失败: ${msg}`);
				}
			}
		},
	});
}
