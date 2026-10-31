import { type DataSource } from "@/types/data-source";
import { type WidgetDocument } from "@/widget-engine/document";

/** Response of POST /api/agent. Shared by the server agent and the app client. */
export type AgentResult =
  | {
      ok: true;
      name: string;
      summary: string;
      document: WidgetDocument;
      /** Where the widget's values refresh from; absent for widgets with fixed content. */
      dataSource?: DataSource;
      /** Composio tools the agent called, shown in the chat for transparency. */
      toolsUsed: string[];
    }
  /** The agent needs the user to act first, e.g. open a Composio connect link. */
  | { ok: false; reason: "needs_input"; message: string; toolsUsed: string[] }
  | { ok: false; reason: "unconfigured" | "failed"; message: string; toolsUsed: string[] };
