/**
 * Permission Gate Extension
 *
 * 权限门控:
 * - 危险 bash 命令需要权限:rm -rf、sudo、chmod/chown 777、sed -i、perl -i、
 *   重定向写入(>、>>)、tee、install、cp、python -c 文件写操作
 * - write / edit 工具需要权限
 * - 默认模式:弹窗确认(无 UI 时阻止)
 * - /yolo 开关:
 *     /yolo [on|off]           全局开关(开启后主会话与子 agent 全部放行)
 *     /yolo sub <dir>          专门给 subagent 开启 YOLO，并用 bwrap 严格沙箱隔离在 <dir> 目录
 *     /yolo sub off            关闭 subagent 专属 YOLO
 *     /yolo status             查看当前安全与沙箱状态
 */

import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// 状态与路径工具(全局共享,session 内生效,subagent 可继承)
// ---------------------------------------------------------------------------

interface PermGateState {
	yolo: boolean;
	subagentSandboxDir: string | null;
}

const g = globalThis as unknown as { __pi_permission_gate__?: PermGateState };
if (!g.__pi_permission_gate__) {
	g.__pi_permission_gate__ = {
		yolo: false,
		subagentSandboxDir: null,
	};
}

function expandHome(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return join(homedir(), p.slice(2));
	return p;
}

function normalizeDir(input: string, cwd: string): string {
	return resolve(cwd, expandHome(input.trim()));
}

export function isPathInside(target: string, parentDir: string): boolean {
	const absTarget = resolve(expandHome(target));
	const absParent = resolve(expandHome(parentDir));
	const base = absParent.endsWith(sep) ? absParent : absParent + sep;
	return absTarget === absParent || absTarget.startsWith(base);
}

export function isYoloEnabled(): boolean {
	return Boolean(g.__pi_permission_gate__?.yolo);
}

export function setYolo(enabled: boolean): void {
	if (!g.__pi_permission_gate__) {
		g.__pi_permission_gate__ = { yolo: false, subagentSandboxDir: null };
	}
	g.__pi_permission_gate__.yolo = enabled;
}

export function getSubagentSandboxDir(): string | null {
	return g.__pi_permission_gate__?.subagentSandboxDir ?? null;
}

export function setSubagentSandboxDir(dir: string | null): void {
	if (!g.__pi_permission_gate__) {
		g.__pi_permission_gate__ = { yolo: false, subagentSandboxDir: null };
	}
	g.__pi_permission_gate__.subagentSandboxDir = dir;
}

/**
 * 将原始 bash 命令包装进 bwrap 沙箱:
 * - 根文件系统全部只读 (--ro-bind / /)
 * - 保障 /dev, /proc, /tmp
 * - 只有 sandboxDir 可读写 (--bind)
 * - 默认切换工作目录到 sandboxDir
 */
export function wrapCommandWithBwrap(rawCmd: string, sandboxDir: string): string {
	const escapedDir = sandboxDir.replace(/'/g, "'\\''");
	return `bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp --bind '${escapedDir}' '${escapedDir}' --chdir '${escapedDir}' bash -c ${JSON.stringify(rawCmd)}`;
}

// ---------------------------------------------------------------------------
// 危险 bash 命令检测
// ---------------------------------------------------------------------------

/** 轻量 shell 分词:处理单双引号与反斜杠转义,保留变量原样 */
export function shellSplit(cmd: string): string[] {
	const tokens: string[] = [];
	let cur = "";
	let quote: "'" | '"' | null = null;
	let escaped = false;
	for (const ch of cmd) {
		if (escaped) {
			cur += ch;
			escaped = false;
			continue;
		}
		if (ch === "\\") {
			escaped = true;
			continue;
		}
		if (quote) {
			if (ch === quote) quote = null;
			else cur += ch;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			continue;
		}
		if (/\s/.test(ch)) {
			if (cur) {
				tokens.push(cur);
				cur = "";
			}
			continue;
		}
		cur += ch;
	}
	if (cur) tokens.push(cur);
	return tokens;
}

/** 路径含 shell 变量/命令替换时无法确定真实目标 */
function isUnknownPath(t: string): boolean {
	return /\$|`/.test(t);
}

/** sed 脚本特征过滤(避免把脚本当文件路径) */
function isSedScript(t: string): boolean {
	return (
		/^[sedayipcq=]?\//.test(t) ||
		/^[0-9,$]/.test(t) ||
		/^(?:d|p|q|P)$/.test(t) ||
		/^[aic]\\?$/.test(t)
	);
}

interface DangerRule {
	name: string;
	isDangerous(cmd: string, tokens: string[]): boolean;
	/** 受影响路径;null = 路径未知(需要人工确认);[] = 无实际文件受影响 */
	extractPaths(cmd: string, tokens: string[]): string[] | null;
}

const DANGER_RULES: DangerRule[] = [
	{
		name: "rm -rf",
		isDangerous: (_c, tokens) => {
			const i = tokens.indexOf("rm");
			return (
				i >= 0 &&
				tokens.slice(i + 1).some((t) => /^-(?:[a-z]*r[a-z]*f|rf|fr|recursive)$/i.test(t))
			);
		},
		extractPaths: (_c, tokens) => {
			const i = tokens.indexOf("rm");
			if (i < 0) return null;
			const paths = tokens.slice(i + 1).filter((t) => !t.startsWith("-"));
			return paths.length > 0 ? paths : null;
		},
	},
	{
		name: "sudo",
		isDangerous: (_c, tokens) => tokens.includes("sudo"),
		extractPaths: () => null,
	},
	{
		name: "chmod/chown 777",
		isDangerous: (_c, tokens) =>
			tokens.some((t) => t === "chmod" || t === "chown") && tokens.join(" ").includes("777"),
		extractPaths: (_c, tokens) => {
			const i = tokens.findIndex((t) => t === "chmod" || t === "chown");
			if (i < 0) return null;
			const paths = tokens
				.slice(i + 1)
				.filter((t) => !t.startsWith("-") && !/^[0-7]+$/.test(t));
			return paths.length > 0 ? paths : null;
		},
	},
	{
		name: "sed/perl 原地编辑",
		isDangerous: (_c, tokens) =>
			tokens.some((t) => t === "sed" || t === "perl") &&
			tokens.some((t) => /^-i(?:\.\S*)?$/.test(t) || t === "--in-place"),
		extractPaths: (_c, tokens) => {
			const i = tokens.findIndex((t) => /^-i(?:\.\S*)?$/.test(t) || t === "--in-place");
			if (i < 0) return null;
			const paths = tokens.slice(i + 1).filter((t) => !t.startsWith("-") && !isSedScript(t));
			return paths.length > 0 ? paths : null;
		},
	},
	{
		name: "重定向写入",
		isDangerous: (_c, tokens) => tokens.some((t) => />>?/.test(t) && !/^\d+$/.test(t)),
		extractPaths: (_c, tokens) => {
			const paths: string[] = [];
			let unknown = false;
			for (let i = 0; i < tokens.length; i++) {
				const t = tokens[i];
				let target: string | undefined;
				if (/^(?:[0-9]?>>?|&>>?)$/.test(t)) {
					target = tokens[i + 1];
				} else {
					const m = t.match(/^(?:[0-9]?|&)?(>>?)(.+)$/);
					if (m) target = m[2];
				}
				if (target === undefined) continue;
				// 跳过 fd 重定向与 /dev/null 等
				if (/^(?:&?[0-9]+|\/dev\/(?:null|stdout|stderr|tty)|-)$/.test(target)) continue;
				if (isUnknownPath(target)) {
					unknown = true;
					continue;
				}
				paths.push(target);
			}
			return unknown ? null : paths;
		},
	},
	{
		name: "tee",
		isDangerous: (_c, tokens) => tokens.includes("tee"),
		extractPaths: (_c, tokens) => {
			const i = tokens.indexOf("tee");
			if (i < 0) return null;
			const paths = tokens.slice(i + 1).filter((t) => !t.startsWith("-"));
			return paths.length > 0 ? paths : null;
		},
	},
	{
		name: "install",
		isDangerous: (_c, tokens) => tokens.includes("install"),
		extractPaths: (_c, tokens) => {
			const i = tokens.indexOf("install");
			if (i < 0) return null;
			const args = tokens.slice(i + 1).filter((t) => !t.startsWith("-"));
			return args.length > 0 ? [args[args.length - 1]] : null;
		},
	},
	{
		name: "cp",
		isDangerous: (_c, tokens) => tokens.includes("cp"),
		extractPaths: (_c, tokens) => {
			const i = tokens.indexOf("cp");
			if (i < 0) return null;
			const args = tokens.slice(i + 1).filter((t) => !t.startsWith("-"));
			return args.length >= 2 ? [args[args.length - 1]] : null;
		},
	},
	{
		name: "python 写文件",
		isDangerous: (cmd, tokens) => {
			const i = tokens.findIndex((t) => /^python[0-9.]*$/.test(t));
			if (i < 0) return false;
			if (!tokens.slice(i + 1).includes("-c")) return false;
			return (
				/open\(\s*['"][^'"]+['"]\s*,\s*['"][wax+]/.test(cmd) ||
				/write_text|write_bytes|\.replace\(|shutil\.(?:copy|move)|unlink\(|os\.remove|os\.rename/.test(cmd)
			);
		},
		extractPaths: (_c, tokens) => {
			const i = tokens.findIndex((t) => /^python[0-9.]*$/.test(t));
			if (i < 0) return null;
			const ci = tokens.indexOf("-c", i + 1);
			if (ci < 0 || ci + 1 >= tokens.length) return null;
			return extractPythonWritePaths(tokens[ci + 1]);
		},
	},
];

/** 从 python 代码中提取写操作的目标路径 */
function extractPythonWritePaths(code: string): string[] | null {
	const patterns: Array<{ re: RegExp; modeCapture?: boolean }> = [
		{ re: /open\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g, modeCapture: true },
		{
			re: /Path\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*(?:write_text|write_bytes|unlink|replace|rename|touch|mkdir|symlink_to|hardlink_to)\s*\(/g,
		},
		{ re: /(?:os\.)?replace\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g },
		{ re: /shutil\.(?:copy|copy2|copyfile|move)\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g },
	];
	const paths: string[] = [];
	let unknown = false;
	for (const { re, modeCapture } of patterns) {
		for (const m of code.matchAll(re)) {
			const path = m[1];
			if (modeCapture) {
				const mode = m[2] ?? "";
				if (!/[wax+]/.test(mode)) continue; // 只读 open 不视为写
			}
			if (isUnknownPath(path)) {
				unknown = true;
				continue;
			}
			paths.push(path);
		}
	}
	if (paths.length === 0 && unknown) return null;
	return paths;
}

export interface BashAssessment {
	dangerous: boolean;
	/** null = 路径未知;[] = 无实际文件受影响 */
	paths: string[] | null;
}

/** 评估 bash 命令是否危险,以及受影响的路径 */
export function assessBash(command: string): BashAssessment {
	const tokens = shellSplit(command);
	let sawDanger = false;
	let unknown = false;
	const paths = new Set<string>();
	for (const rule of DANGER_RULES) {
		if (!rule.isDangerous(command, tokens)) continue;
		sawDanger = true;
		const extracted = rule.extractPaths(command, tokens);
		if (extracted === null) {
			unknown = true;
		} else {
			for (const p of extracted) paths.add(p);
		}
	}
	if (!sawDanger) return { dangerous: false, paths: [] };
	return { dangerous: true, paths: unknown ? null : [...paths] };
}

// ---------------------------------------------------------------------------
// 扩展入口
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// /yolo [on|off|status|sub <dir>|sub off]
	pi.registerCommand("yolo", {
		description: "YOLO 安全模式与 Subagent bwrap 沙箱开关",
		handler: async (args, ctx) => {
			const raw = args.trim();
			const lower = raw.toLowerCase();
			const parts = raw.split(/\s+/);
			const subCmd = parts[0]?.toLowerCase();

			// 1. subagent 专属沙箱 YOLO: /yolo sub <dir> 或 /yolo sub off
			if (subCmd === "sub") {
				const target = parts.slice(1).join(" ").trim();
				if (!target || target === "status") {
					const current = getSubagentSandboxDir();
					ctx.ui.notify(
						current
							? `📦 Subagent bwrap 沙箱 YOLO: 开启\n目标目录: ${current}`
							: "🛡️ Subagent bwrap 沙箱 YOLO: 未开启",
						"info",
					);
					return;
				}
				if (target.toLowerCase() === "off" || target === "0") {
					setSubagentSandboxDir(null);
					ctx.ui.notify("🛡️ 已关闭 Subagent 沙箱 YOLO 模式", "info");
					return;
				}
				const resolvedDir = normalizeDir(target, ctx.cwd);
				setSubagentSandboxDir(resolvedDir);
				ctx.ui.notify(
					`🚀 已为 Subagent 开启 YOLO!\n已启用 bwrap 强隔离, 仅允许写入: ${resolvedDir}`,
					"warning",
				);
				return;
			}

			// 2. 查看状态: /yolo status
			if (lower === "status") {
				const sandbox = getSubagentSandboxDir();
				ctx.ui.notify(
					`全局 YOLO: ${isYoloEnabled() ? "开启 🚀" : "关闭 🛡️"}\nSubagent 沙箱目录: ${sandbox ?? "未设置 (继承默认拦截)"}`,
					"info",
				);
				return;
			}

			// 3. 全局开/关: /yolo on / /yolo off
			if (lower === "on" || lower === "1" || lower === "true") {
				setYolo(true);
				ctx.ui.notify("🚀 全局 YOLO 模式已开启: 所有命令与文件写入均自动放行(包括主会话与 subagent)", "warning");
			} else if (lower === "off" || lower === "0" || lower === "false") {
				setYolo(false);
				ctx.ui.notify("🛡️ 全局 YOLO 模式已关闭: 恢复严格安全确认", "info");
			} else {
				// 无参数直接切换全局 YOLO 开关
				const next = !isYoloEnabled();
				setYolo(next);
				if (next) {
					ctx.ui.notify("🚀 全局 YOLO 模式已开启: 所有命令与文件写入均自动放行", "warning");
				} else {
					ctx.ui.notify("🛡️ 全局 YOLO 模式已关闭: 恢复严格安全确认", "info");
				}
			}
		},
	});

	pi.on("tool_call", async (event, ctx) => {
		const isSubagent = !ctx.hasUI;
		const subSandbox = getSubagentSandboxDir();

		// 1. 全局 YOLO 开启时: 无论主会话还是子 agent，直接全放行
		if (isYoloEnabled()) {
			return undefined;
		}

		// 2. 如果是 Subagent, 并且配置了 /yolo sub <dir> 的 bwrap 沙箱
		if (isSubagent && subSandbox !== null) {
			if (event.toolName === "write" || event.toolName === "edit") {
				const p = event.input.path as string;
				if (isPathInside(p, subSandbox)) {
					return undefined; // 沙箱目录内放行
				}
				return {
					block: true,
					reason: `[bwrap 沙箱保护] ${event.toolName} ${p} 超出沙箱工作目录(${subSandbox}), 已阻止修改`,
				};
			}

			if (event.toolName === "bash") {
				// 将子 agent 的 bash 命令透明包装进 bwrap 沙箱执行
				const rawCommand = event.input.command as string;
				event.input.command = wrapCommandWithBwrap(rawCommand, subSandbox);
				return undefined; // 自动包装后直接安全放行！
			}

			return undefined;
		}

		// 3. 默认安全检查: write / edit 工具
		if (event.toolName === "write" || event.toolName === "edit") {
			const p = event.input.path as string;
			if (!ctx.hasUI) {
				return {
					block: true,
					reason: `${event.toolName} ${p} 需要权限确认, 无 UI 已阻止 (可用 /yolo 或 /yolo sub <dir> 开启放行)`,
				};
			}
			const label = event.toolName === "write" ? "📝 创建/覆盖" : "✏️ 编辑";
			const ok = await ctx.ui.confirm(`${label}文件: ${p}`, "确定允许修改该文件吗?");
			if (!ok) return { block: true, reason: "用户拒绝" };
			return undefined;
		}

		// 4. 默认安全检查: bash 工具
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		const result = assessBash(command);

		if (!result.dangerous) return undefined;

		if (!ctx.hasUI) {
			return {
				block: true,
				reason: `危险命令被阻止(无 UI 确认, 可用 /yolo 或 /yolo sub <dir> 开启放行): ${command}`,
			};
		}

		const detail = result.paths === null ? "无法确定受影响路径" : `受影响路径:\n${result.paths.join("\n")}`;
		const ok = await ctx.ui.confirm("⚠️ 危险命令", `${command}\n\n${detail}\n\n允许执行吗?`);
		if (!ok) return { block: true, reason: "用户拒绝" };
		return undefined;
	});
}
