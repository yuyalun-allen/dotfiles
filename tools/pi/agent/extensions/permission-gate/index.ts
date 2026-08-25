/**
 * Permission Gate Extension
 *
 * 权限门控:
 * - 危险 bash 命令需要权限:rm -rf、sudo、chmod/chown 777、sed -i、perl -i、
 *   重定向写入(>、>>)、tee、install、cp、python -c 文件写操作
 * - write / edit 工具需要权限
 * - 受影响路径位于"允许目录"内、或命令已在白名单中时自动放行;
 *   否则弹窗确认(无 UI 时阻止)
 *
 * 允许规则(仅当前 session 生效,不持久化):
 * - /permit <dir>      允许对指定目录的所有操作
 * - /permit(无参数)    允许"当前命令":最近一次被拦截/询问的危险命令,加入命令白名单
 * - /permit            无当前命令时显示允许列表
 * - /unpermit <目录|命令> 撤销允许项
 */

import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// 允许状态(仅内存,session 内生效)
// ---------------------------------------------------------------------------

const allowedDirs = new Set<string>(); // /permit <dir> 允许的目录
const allowedCommands = new Set<string>(); // /permit(无参数)允许的命令
let lastDangerousCommand: string | null = null; // 最近一次需要授权的危险命令

function expandHome(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return join(homedir(), p.slice(2));
	return p;
}

function normalizeDir(input: string, cwd: string): string {
	return resolve(cwd, expandHome(input.trim()));
}

/** 规范化命令字符串(折叠空白),用于白名单匹配 */
export function normalizeCommand(cmd: string): string {
	return cmd.replace(/\s+/g, " ").trim();
}

export function isAllowedPath(p: string, allowedDirs: string[]): boolean {
	const abs = resolve(expandHome(p));
	return allowedDirs.some((dir) => {
		const base = dir.endsWith(sep) ? dir : dir + sep;
		return abs === dir || abs.startsWith(base);
	});
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
	// /permit <dir> | /permit | /unpermit <目录|命令>
	pi.registerCommand("permit", {
		description: "允许对指定目录的所有操作;无参数时允许最近一次被拦截的危险命令(仅当前会话)",
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (!arg) {
				// 默认允许"当前命令"
				if (lastDangerousCommand !== null) {
					allowedCommands.add(normalizeCommand(lastDangerousCommand));
					ctx.ui.notify(`已允许该命令,后续直接放行:\n${lastDangerousCommand}`, "info");
					lastDangerousCommand = null;
					return;
				}
				// 无当前命令 → 显示允许列表
				const dirs = [...allowedDirs];
				const cmds = [...allowedCommands];
				const sections: string[] = [];
				if (dirs.length > 0) sections.push(`目录:\n${dirs.join("\n")}`);
				if (cmds.length > 0) sections.push(`命令:\n${cmds.join("\n")}`);
				ctx.ui.notify(
					sections.length > 0
						? `允许列表(当前会话):\n${sections.join("\n\n")}`
						: "(允许列表为空;agent 执行危险命令被拦截后,输入 /permit 即可允许该命令)",
					"info",
				);
				return;
			}
			const dir = normalizeDir(arg, ctx.cwd);
			allowedDirs.add(dir);
			ctx.ui.notify(`已允许目录(当前会话): ${dir}`, "info");
		},
	});

	pi.registerCommand("unpermit", {
		description: "撤销允许:移除一个目录或命令(仅当前会话)",
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (!arg) {
				ctx.ui.notify("用法: /unpermit <目录|命令>", "warning");
				return;
			}
			const removedCmd = allowedCommands.delete(normalizeCommand(arg));
			const removedDir = allowedDirs.delete(normalizeDir(arg, ctx.cwd));
			ctx.ui.notify(
				removedCmd || removedDir ? `已移除: ${arg}` : `不在允许列表中: ${arg}`,
				removedCmd || removedDir ? "info" : "warning",
			);
		},
	});

	pi.on("tool_call", async (event, ctx) => {
		// write / edit:路径在允许目录内放行,否则确认
		if (event.toolName === "write" || event.toolName === "edit") {
			const p = event.input.path as string;
			if (isAllowedPath(p, [...allowedDirs])) return undefined;

			if (!ctx.hasUI) {
				return { block: true, reason: `${event.toolName} ${p} 超出允许目录,无 UI 确认,已阻止` };
			}
			const label = event.toolName === "write" ? "📝 创建/覆盖" : "✏️ 编辑";
			const ok = await ctx.ui.confirm(`${label}文件: ${p}`, "路径不在允许目录内,允许吗?");
			if (!ok) return { block: true, reason: "用户拒绝" };
			return undefined;
		}

		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		const result = assessBash(command);

		if (!result.dangerous) return undefined;

		// 命令白名单:已允许的命令直接放行
		if (allowedCommands.has(normalizeCommand(command))) return undefined;

		// 路径全部在允许目录内 → 放行
		if (result.paths !== null && result.paths.every((p) => isAllowedPath(p, [...allowedDirs]))) {
			return undefined;
		}

		// 记录当前命令,供 /permit(无参数)授权
		lastDangerousCommand = command;

		if (!ctx.hasUI) {
			return { block: true, reason: `危险命令被阻止(无 UI 确认,可用 /permit 允许该命令): ${command}` };
		}

		const detail = result.paths === null ? "无法确定受影响路径" : `受影响路径:\n${result.paths.join("\n")}`;
		const ok = await ctx.ui.confirm("⚠️ 危险命令", `${command}\n\n${detail}\n\n允许执行吗?(拒绝后可用 /permit 允许该命令)`);
		if (!ok) return { block: true, reason: "用户拒绝(可用 /permit 允许该命令)" };
		return undefined;
	});
}
