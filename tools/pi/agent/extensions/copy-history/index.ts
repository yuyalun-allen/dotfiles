import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ContentBlock = {
	type?: string;
	text?: string;
	name?: string;
	arguments?: Record<string, unknown>;
};

type SessionEntry = {
	type: string;
	message?: {
		role?: string;
		content?: unknown;
	};
};

function extractText(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return "";
	}
	const textParts: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const block = part as ContentBlock;
		if (block.type === "text" && typeof block.text === "string") {
			textParts.push(block.text);
		}
	}
	return textParts.join("\n");
}

function copyToClipboard(text: string): Promise<boolean> {
	return new Promise((resolve) => {
		// Arch Linux 下优先使用 wl-copy，如在 X11 下尝试 xclip
		const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
		proc.on("error", () => {
			const xclipProc = spawn("xclip", ["-selection", "clipboard"], {
				stdio: ["pipe", "ignore", "ignore"],
			});
			xclipProc.on("error", () => resolve(false));
			xclipProc.stdin.write(text);
			xclipProc.stdin.end();
			xclipProc.on("close", (code) => resolve(code === 0));
		});
		proc.stdin.write(text);
		proc.stdin.end();
		proc.on("close", (code) => resolve(code === 0));
	});
}

type ConversationRound = {
	userText: string;
	assistantTexts: string[];
};

export default function copyHistoryExtension(pi: ExtensionAPI) {
	pi.registerCommand("copy-history", {
		description: "Copy conversation history by rounds to clipboard. Usage: /copy-history [rounds, default: 4] [--first/-f]",
		handler: async (args, ctx) => {
			const branch = ctx.sessionManager.getBranch() as SessionEntry[];

			// 按轮次（Round）组织对话：以每次 User 提问为一轮的起点
			const rounds: ConversationRound[] = [];
			let currentRound: ConversationRound | null = null;

			for (const entry of branch) {
				if (entry.type !== "message" || !entry.message?.role) {
					continue;
				}
				const role = entry.message.role;
				const text = extractText(entry.message.content).trim();
				if (!text) continue;

				if (role === "user") {
					if (currentRound) {
						rounds.push(currentRound);
					}
					currentRound = { userText: text, assistantTexts: [] };
				} else if (role === "assistant") {
					if (!currentRound) {
						currentRound = { userText: "（无用户输入）", assistantTexts: [] };
					}
					currentRound.assistantTexts.push(text);
				}
			}

			if (currentRound) {
				rounds.push(currentRound);
			}

			if (rounds.length === 0) {
				if (ctx.hasUI) {
					ctx.ui.notify("No conversation rounds found to copy", "warning");
				}
				return;
			}

			// 解析参数，默认复制最近的轮数（rounds）；指定 --first / -f 时从头开始
			const tokens = (args || "").trim().split(/\s+/).filter(Boolean);
			let count = 4;
			let fromStart = false;

			for (const token of tokens) {
				if (token === "--first" || token === "-f" || token === "--head") {
					fromStart = true;
				} else {
					const parsed = parseInt(token, 10);
					if (!isNaN(parsed) && parsed > 0) {
						count = parsed;
					}
				}
			}

			// 截取轮次：默认取最近 count 轮，指定 option 时从开头取
			const selectedRounds = fromStart
				? rounds.slice(0, count)
				: rounds.slice(-count);

			// 格式化输出：User 内容直接作为二级标题，删去 User: 和 Assistant: 标签
			const formattedRounds = selectedRounds.map((round) => {
				const header = `## ${round.userText}`;
				const answer = round.assistantTexts.join("\n\n");
				return answer ? `${header}\n\n${answer}` : header;
			});

			const formattedText = formattedRounds.join("\n\n---\n\n");

			const success = await copyToClipboard(formattedText);
			if (success) {
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Copied ${selectedRounds.length} round(s) (${fromStart ? "first" : "last"} ${count}) to clipboard!`,
						"info"
					);
				}
			} else {
				if (ctx.hasUI) {
					ctx.ui.notify("Failed to copy to clipboard (wl-copy / xclip error)", "error");
				}
			}
		},
	});
}
