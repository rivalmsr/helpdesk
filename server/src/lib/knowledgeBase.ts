import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads the support knowledge base (`server/knowledge-base.md`) — the official
 * policies and troubleshooting guides the AI triage pipeline uses to auto-resolve
 * tickets. Read once and cached: the file is static, so there's no reason to hit
 * disk per job.
 *
 * The path is resolved relative to this module (`__dirname` is `server/src/lib`
 * under `bun --watch`, or `server/dist/lib` in a production build — both two levels
 * below the `server/` root where the markdown lives).
 */
const KNOWLEDGE_BASE_PATH = join(__dirname, "../../knowledge-base.md");

let cached: string | undefined;

export function getKnowledgeBase(): string {
  if (cached === undefined) {
    cached = readFileSync(KNOWLEDGE_BASE_PATH, "utf8");
  }
  return cached;
}
