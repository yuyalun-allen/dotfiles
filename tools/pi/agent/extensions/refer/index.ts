import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	SessionManager,
	SessionSelectorComponent,
} from "@earendil-works/pi-coding-agent";

function copyToClipboard(text: string): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
		proc.on("error", () => resolve(false));
		proc.stdin.write(text);
		proc.stdin.end();
		proc.on("close", (code) => resolve(code === 0));
	});
}

export default function referExtension(pi: ExtensionAPI) {
	pi.registerCommand("refer", {
		description: "Select a previous session and copy its jsonl path or paste to input",
		handler: async (_args, ctx) => {
			const cwd = process.cwd();

			// Use ctx.ui.custom to display the native SessionSelectorComponent
			// This matches /resume exactly: search bar, Tab switching, highlighted background (selectedBg), tree lines, etc.
			const selectedPath = await ctx.ui.custom<string | null>((tui, _theme, _keybindings, done) => {
				const currentLoader = (onProgress?: any, signal?: any) =>
					SessionManager.list(cwd, undefined, onProgress, signal);
				const allLoader = (onProgress?: any, signal?: any) =>
					SessionManager.listAll(undefined, onProgress, signal);

				const selector = new SessionSelectorComponent(
					currentLoader,
					allLoader,
					(sessionPath: string) => {
						done(sessionPath);
					},
					() => {
						done(null);
					},
					() => {
						done(null);
					},
					() => tui.requestRender(),
					{
						showRenameHint: false,
					},
				);

				return selector;
			});

			if (!selectedPath) {
				return;
			}

			// 1. Paste directly into editor
			if (typeof ctx.ui.pasteToEditor === "function") {
				ctx.ui.pasteToEditor(selectedPath);
			} else if (typeof (ctx.ui as any).setEditorText === "function") {
				const current = typeof (ctx.ui as any).getEditorText === "function" ? (ctx.ui as any).getEditorText() : "";
				(ctx.ui as any).setEditorText(current ? `${current} ${selectedPath}` : selectedPath);
			}

			// 2. Copy to system clipboard via wl-copy
			const copied = await copyToClipboard(selectedPath);
			if (copied) {
				ctx.ui.notify(`Session path copied to clipboard & input:\n${selectedPath}`, "info");
			} else {
				ctx.ui.notify(`Session path set to input:\n${selectedPath}`, "info");
			}
		},
	});
}
