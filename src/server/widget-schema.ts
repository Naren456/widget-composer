import { androidWidgetProfile } from "@/widget-engine/document";

/**
 * JSON Schema for a WidgetComposer Document, given to the agent as the input of its
 * `submit_widget` tool. It describes the shape; `validateDocument` remains the source
 * of truth and catches what JSON Schema cannot (unknown tokens, values, state keys).
 */

const color = { type: "string", description: '"#RRGGBB", "#RRGGBBAA", or "@token" from theme' };

const modifiers = {
  type: "object",
  additionalProperties: false,
  properties: {
    pad: {
      description: "All sides in dp, or [start, top, end, bottom]",
      anyOf: [{ type: "number" }, { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 }],
    },
    width: { anyOf: [{ type: "number" }, { const: "fill" }] },
    height: { anyOf: [{ type: "number" }, { const: "fill" }] },
    bg: color,
    radius: { type: "number" },
  },
};

const layout = (type: "column" | "row") => ({
  type: "object",
  additionalProperties: false,
  required: ["type", "children"],
  properties: {
    type: { const: type },
    mod: modifiers,
    gap: { type: "number" },
    arrange: { enum: ["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly"] },
    align: { enum: ["start", "center", "end"] },
    children: { type: "array", items: { $ref: "#/$defs/node" } },
  },
});

export const widgetDocumentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["v", "profile", "scheme", "theme", "values", "state", "root"],
  properties: {
    v: { const: 1 },
    profile: { const: androidWidgetProfile.id },
    scheme: { enum: ["light", "dark", "system"] },
    theme: {
      type: "object",
      description: "Named colours, each with a light and dark variant",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["light", "dark"],
        properties: { light: { type: "string" }, dark: { type: "string" } },
      },
    },
    values: {
      type: "object",
      description: "Named strings referenced from text as {{name}}. Real data only.",
      additionalProperties: { type: "string" },
    },
    state: {
      type: "object",
      description: "Integer state referenced as {{#name}}, by pick nodes and by button actions",
      additionalProperties: { type: "integer" },
    },
    root: { $ref: "#/$defs/node" },
  },
  $defs: {
    node: {
      anyOf: [
        layout("column"),
        layout("row"),
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "children"],
          properties: {
            type: { const: "box" },
            mod: modifiers,
            align: { enum: ["topStart", "center", "bottomEnd"] },
            children: { type: "array", items: { $ref: "#/$defs/node" } },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "text"],
          properties: {
            type: { const: "text" },
            mod: modifiers,
            text: { type: "string", description: "Template: {{value}}, {{#state}}, {{$date}}, {{$time}}" },
            color,
            size: { type: "number" },
            weight: { enum: ["400", "500", "600", "700", "800"] },
            lines: { type: "integer" },
            align: { enum: ["start", "center", "end"] },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type"],
          properties: { type: { const: "spacer" }, mod: modifiers },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "label", "action"],
          properties: {
            type: { const: "button" },
            mod: modifiers,
            label: { type: "string" },
            action: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["do", "key", "count"],
                  properties: { do: { const: "cycle" }, key: { type: "string" }, count: { type: "integer" } },
                },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["do", "key", "value"],
                  properties: { do: { const: "set" }, key: { type: "string" }, value: { type: "integer" } },
                },
              ],
            },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "key", "children"],
          properties: {
            type: { const: "pick" },
            key: { type: "string", description: "State key whose value selects the child shown" },
            children: { type: "array", items: { $ref: "#/$defs/node" } },
          },
        },
      ],
    },
  },
} as const;

/**
 * JSON Schema for a data source, used by the agent's `test_data_source` and
 * `submit_widget` tools. `validateDataSource` remains the source of truth.
 */
const mapping = {
  type: "object",
  description: 'Document value name → response path, e.g. {"title": "items[0].title"}',
  additionalProperties: { type: "string" },
} as const;

export const dataSourceSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["v", "connector", "url", "auth", "mapping"],
      properties: {
        v: { const: 1 },
        connector: { const: "rest" },
        url: { type: "string", description: "Public https JSON endpoint; always fetched with GET" },
        query: { type: "object", additionalProperties: { type: "string" } },
        headers: { type: "object", description: "Only accept, accept-language and x-* headers", additionalProperties: { type: "string" } },
        auth: {
          anyOf: [
            { type: "object", additionalProperties: false, required: ["strategy"], properties: { strategy: { const: "none" } } },
            {
              type: "object",
              additionalProperties: false,
              required: ["strategy", "credentialRef", "in", "name"],
              properties: {
                strategy: { const: "apiKey" },
                credentialRef: { type: "string" },
                in: { enum: ["header", "query"] },
                name: { type: "string" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["strategy", "credentialRef"],
              properties: { strategy: { const: "bearer" }, credentialRef: { type: "string" } },
            },
          ],
        },
        mapping,
        cacheSeconds: { type: "integer", minimum: 0, maximum: 3600 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["v", "connector", "tool", "args", "mapping"],
      properties: {
        v: { const: 1 },
        connector: { const: "composio" },
        tool: { type: "string", description: "A read-only Composio tool slug you already called successfully" },
        args: { type: "object" },
        mapping,
        cacheSeconds: { type: "integer", minimum: 0, maximum: 3600 },
      },
    },
  ],
} as const;
