/**
 * Widgets only read data, so Composio tools whose slug names a write are refused in
 * code — a prompt asking for read-only use is not a guarantee. Shared by the agent and
 * the Composio connector, which runs saved tool calls on refresh without the agent.
 */
export const WRITE_SLUG =
  /\b[A-Z0-9]+(?:_[A-Z0-9]+)*_(?:CREATE|DELETE|UPDATE|SEND|POST|REMOVE|ADD|EDIT|PATCH|PUT|MERGE|FORK|STAR|INVITE|REPLY|UPLOAD|MOVE|ARCHIVE)(?:_[A-Z0-9]+)*\b/;

/** Composio's sandbox tools can run arbitrary code, which a widget never needs. */
export const SANDBOX_TOOL = /WORKBENCH|BASH|SANDBOX/;

/** Why a tool call must not run, or null when it may. Checks the slug and every argument. */
export function readOnlyViolation(tool: string, args: unknown): string | null {
  if (SANDBOX_TOOL.test(tool)) return "code execution is not available";
  const blocked = JSON.stringify(args ?? {}).match(WRITE_SLUG) ?? tool.match(WRITE_SLUG);
  return blocked ? `${blocked[0]} changes data, and widgets may only read` : null;
}
