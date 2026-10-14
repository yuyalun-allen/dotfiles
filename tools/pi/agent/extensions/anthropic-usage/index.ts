import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

interface AnthropicAuth {
	type?: string;
	access?: string;
	refresh?: string;
	expires?: number;
	[key: string]: unknown;
}

interface AnthropicUsageMetrics {
	fiveHourUtilization: number;
	fiveHourResetSec?: number;
	fiveHourStatus?: string;
	sevenDayUtilization: number;
	sevenDayResetSec?: number;
	sevenDayStatus?: string;
	overallStatus?: string;
	representativeClaim?: string;
	overageStatus?: string;
	overageDisabledReason?: string;
	organizationId?: string;
	workspaceId?: string;
}

const CLIENT_ID = Buffer.from("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl", "base64").toString("utf-8");
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";

function getAuthFilePath(): string {
	const customDir = process.env.PI_CODING_AGENT_DIR;
	if (customDir) {
		return join(customDir, "auth.json");
	}
	return join(homedir(), ".config", "pi", "agent", "auth.json");
}

async function loadAuth(): Promise<{ raw: Record<string, unknown>; anthropic?: AnthropicAuth }> {
	const authPath = getAuthFilePath();
	const content = await readFile(authPath, "utf-8");
	const raw = JSON.parse(content) as Record<string, unknown>;
	return { raw, anthropic: raw["anthropic"] as AnthropicAuth | undefined };
}

async function refreshTokenIfNeeded(rawAuth: Record<string, unknown>, auth: AnthropicAuth): Promise<string> {
	const now = Date.now();
	// 留出 60 秒裕量
	if (auth.access && auth.expires && auth.expires - now > 60000) {
		return auth.access;
	}

	if (!auth.refresh) {
		if (auth.access) return auth.access;
		throw new Error("未找到 refresh_token，请先在 pi 中登录 anthropic (/login)");
	}

	const resp = await fetch(TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({
			grant_type: "refresh_token",
			client_id: CLIENT_ID,
			refresh_token: auth.refresh,
		}),
	});

	if (!resp.ok) {
		const errText = await resp.text();
		throw new Error(`刷新 Token 失败 (${resp.status}): ${errText}`);
	}

	const tokenData = (await resp.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
	};

	auth.access = tokenData.access_token;
	if (tokenData.refresh_token) {
		auth.refresh = tokenData.refresh_token;
	}
	if (typeof tokenData.expires_in === "number") {
		auth.expires = Date.now() + tokenData.expires_in * 1000 - 300000;
	}

	rawAuth["anthropic"] = auth;
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

function renderProgressBar(fraction: number, label: string, resetSec?: number, status?: string): string {
	const percent = Math.min(100, Math.max(0, Math.round(fraction * 100)));
	const remainingPercent = Math.max(0, 100 - percent);
	const barLength = 16;
	const usedBars = Math.min(barLength, Math.round((percent / 100) * barLength));
	const progressBar = "█".repeat(usedBars) + "░".repeat(barLength - usedBars);

	const statusBadge = status && status !== "allowed" ? ` [${status.toUpperCase()}]` : "";
	let info = `[${progressBar}] 已用 ${percent}% (剩余 ${remainingPercent}%)${statusBadge}`;

	if (resetSec) {
		const nowSec = Math.floor(Date.now() / 1000);
		const diffSec = resetSec - nowSec;
		info += `\n   ⏳ 距离重置: ${formatDuration(diffSec)} (${formatTimestamp(resetSec)})`;
	}

	return `【${label}】\n   ${info}`;
}

async function fetchAnthropicUsage(): Promise<AnthropicUsageMetrics> {
	const { raw, anthropic } = await loadAuth();
	if (!anthropic) {
		throw new Error("未找到 Anthropic 授权信息。请先在 pi 中使用 /login 登录。");
	}

	const accessToken = await refreshTokenIfNeeded(raw, anthropic);

	// 发送极小请求 (max_tokens: 1) 获取 Anthropic 统一订阅限流响应头 (anthropic-ratelimit-unified-*)
	const resp = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"anthropic-version": "2023-06-01",
			"anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 1,
			messages: [{ role: "user", content: "1" }],
		}),
	});

	// 如果调用成功或触发 429 限流，响应头中均携带完整的 unified 配额信息
	const headers = resp.headers;

	const fiveHUtil = parseFloat(headers.get("anthropic-ratelimit-unified-5h-utilization") || "0");
	const fiveHReset = parseInt(headers.get("anthropic-ratelimit-unified-5h-reset") || "0", 10);
	const fiveHStatus = headers.get("anthropic-ratelimit-unified-5h-status") || undefined;

	const sevenDUtil = parseFloat(headers.get("anthropic-ratelimit-unified-7d-utilization") || "0");
	const sevenDReset = parseInt(headers.get("anthropic-ratelimit-unified-7d-reset") || "0", 10);
	const sevenDStatus = headers.get("anthropic-ratelimit-unified-7d-status") || undefined;

	const overallStatus = headers.get("anthropic-ratelimit-unified-status") || undefined;
	const repClaim = headers.get("anthropic-ratelimit-unified-representative-claim") || undefined;
	const overageStatus = headers.get("anthropic-ratelimit-unified-overage-status") || undefined;
	const overageReason = headers.get("anthropic-ratelimit-unified-overage-disabled-reason") || undefined;
	const orgId = headers.get("anthropic-organization-id") || undefined;
	const wrkId = headers.get("anthropic-workspace-id") || undefined;

	return {
		fiveHourUtilization: isNaN(fiveHUtil) ? 0 : fiveHUtil,
		fiveHourResetSec: fiveHReset > 0 ? fiveHReset : undefined,
		fiveHourStatus: fiveHStatus,
		sevenDayUtilization: isNaN(sevenDUtil) ? 0 : sevenDUtil,
		sevenDayResetSec: sevenDReset > 0 ? sevenDReset : undefined,
		sevenDayStatus: sevenDStatus,
		overallStatus,
		representativeClaim: repClaim,
		overageStatus,
		overageDisabledReason: overageReason,
		organizationId: orgId,
		workspaceId: wrkId,
	};
}

export default function (pi: ExtensionAPI) {
	const handler = async (_args: string, ctx: ExtensionCommandContext) => {
		if (ctx.hasUI) {
			ctx.ui.notify("正在查询 Claude 订阅配额使用情况…", "info");
		}

		try {
			const metrics = await fetchAnthropicUsage();
			const statusText = metrics.overallStatus === "rejected" ? "❌ 已受限 (Exceeded)" : "✅ 正常 (Allowed)";

			const lines = [
				`📊 Claude 订阅配额情况 (Anthropic Pro/Max)`,
				`----------------------------------------`,
				`🏢 工作区 ID: ${metrics.workspaceId || "默认"}`,
				`🛡️ 全局状态: ${statusText}${metrics.representativeClaim ? ` (主控窗口: ${metrics.representativeClaim})` : ""}`,
				``,
				renderProgressBar(
					metrics.fiveHourUtilization,
					"5 小时滚动窗口 (Rolling 5h)",
					metrics.fiveHourResetSec,
					metrics.fiveHourStatus,
				),
				``,
				renderProgressBar(
					metrics.sevenDayUtilization,
					"7 天周限制窗口 (Weekly 7d)",
					metrics.sevenDayResetSec,
					metrics.sevenDayStatus,
				),
			];

			if (metrics.overageStatus && metrics.overageStatus !== "allowed") {
				lines.push(
					``,
					`💳 额度溢出付费 (Extra Usage): ${metrics.overageStatus}${metrics.overageDisabledReason ? ` (${metrics.overageDisabledReason})` : ""}`,
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
	};

	pi.registerCommand("anthropic-usage", {
		description: "查看 Claude 订阅配额使用情况 (5小时 / 7天限制)",
		handler,
	});

	pi.registerCommand("claude-usage", {
		description: "查看 Claude 订阅配额使用情况 (别名)",
		handler,
	});
}
