/* Generated from the backend WidgetSpec Zod schema. Do not edit by hand. */
export const WIDGET_CONTRACT_VERSION = 8 as const;
export const WIDGET_CONTRACT_SHA256 = "8233ab33656e4a58801d5a5153ef9bced536ffc9fc251281f55f2927954392d0" as const;
export type _Schema0 =
  | {
      type: "column" | "row";
      gap?: number;
      surface?: boolean;
      radiusDp?: number;
      paddingDp?: number;
      /**
       * @minItems 1
       * @maxItems 12
       */
      children: _Schema0[];
    }
  | {
      type: "text";
      text: string;
      style?: "title" | "body" | "caption";
      fontSizeDp?: number;
      weight?: "normal" | "medium" | "bold";
      colorToken?: "text" | "muted" | "accent";
    }
  | {
      type: "image";
      source: string;
      alt?: string;
      imagePrompt?: string;
      widthDp?: number;
      heightDp?: number;
      fit?: "cover" | "contain";
      radiusDp?: number;
    }
  | {
      type: "link";
      label: string;
      urlBinding: string;
    }
  | {
      type: "clock";
      format: "12_hour" | "24_hour";
      showDate?: boolean;
      showSeconds?: boolean;
    }
  | {
      type: "metric";
      label: string;
      valueBinding: string;
    }
  | {
      type: "progress";
      label?: string;
      valueBinding: string;
      maxValue: number;
      widthDp?: number;
      heightDp?: number;
    }
  | {
      type: "device_info";
      metric:
        | "battery_level"
        | "battery_status"
        | "battery_health"
        | "bluetooth_status"
        | "wifi_status"
        | "network_type"
        | "storage_free"
        | "storage_used_percent"
        | "power_saver"
        | "device_model"
        | "android_version";
      label?: string;
      display?: "text" | "metric" | "progress";
    }
  | {
      type: "list";
      source: string;
      maxItems: number;
    }
  | {
      type: "streak_chart";
      source: string;
    }
  | {
      type: "divider";
    }
  | {
      type: "spacer";
      sizeDp: number;
    }
  | {
      type: "button";
      label: string;
      action:
        | {
            type: "open_url";
            urlBinding: string;
          }
        | {
            type: "open_app";
            screen: "widget_details";
          }
        | {
            type: "refresh";
          }
        | {
            type: "lock_screen";
          };
    };

/**
 * Declarative, versioned WidgetComposer component tree.
 */
export interface WidgetSpec {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  name: string;
  presentation: {
    theme: "light" | "dark" | "system";
    fontFamily?: "sans" | "serif" | "monospace";
    palette?: {
      background: string;
      surface: string;
      text: string;
      muted: string;
      accent: string;
      border: string;
    };
    refreshMinutes: number;
    minWidthDp?: number;
    minHeightDp?: number;
  };
  /**
   * @maxItems 3
   */
  dataSources: (
    | {
        id: string;
        connector: "github";
        query: "assigned_issues" | "open_pull_requests" | "review_requests" | "contribution_streak";
      }
    | {
        id: string;
        connector: "website";
        query: "page";
        url: string;
      }
    | {
        id: string;
        connector: "news";
        query: "latest_items";
        url: string;
      }
  )[];
  root: _Schema0;
}
export type WidgetNode = WidgetSpec["root"];
export type WidgetPalette = NonNullable<WidgetSpec["presentation"]["palette"]>;
export type WidgetAction = Extract<WidgetNode, { type: "button" }>["action"];
