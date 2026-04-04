/**
 * Permission Gate Extension
 *
 * Prompts for confirmation before:
 * - Dangerous bash commands (rm -rf, sudo, chmod/chown 777)
 * - All write operations
 * - All edit operations
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const dangerousPatterns = [/\brm\s+(-rf?|--recursive)/i, /\bsudo\b/i, /\b(chmod|chown)\b.*777/i];

	pi.on("tool_call", async (event, ctx) => {
		// Handle write and edit tools - always ask for confirmation
		if (event.toolName === "write" || event.toolName === "edit") {
			if (!ctx.hasUI) {
				return { block: true, reason: `${event.toolName} requires confirmation (no UI)` };
			}

			const action = event.toolName === "write" ? "📝 Create/Overwrite" : "✏️ Edit";
			const path = event.input.path as string;
			
			const choice = await ctx.ui.select(`${action} file:\n\n  ${path}\n\nAllow?`, ["Yes", "No"]);

			if (choice !== "Yes") {
				return { block: true, reason: "Blocked by user" };
			}

			return undefined;
		}

		// Handle bash tool - check for dangerous commands
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		const isDangerous = dangerousPatterns.some((p) => p.test(command));

		if (isDangerous) {
			if (!ctx.hasUI) {
				return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
			}

			const choice = await ctx.ui.select(`⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`, ["Yes", "No"]);

			if (choice !== "Yes") {
				return { block: true, reason: "Blocked by user" };
			}
		}

		return undefined;
	});
}
