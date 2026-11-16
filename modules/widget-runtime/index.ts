import { requireOptionalNativeModule } from "expo";

/**
 * JS side of the native Android home-screen widget (`android/`, Kotlin + RemoteViews).
 * Null on iOS, web and builds made before the module existed, so callers check
 * `homeScreenWidgets` before using it.
 */
type WidgetRuntimeModule = {
  deviceId(): string;
  canPin(): boolean;
  save(widgetId: string, payloadJson: string): void;
  setBackgroundRefreshCredentials?(apiBaseUrl: string, userId: string, accessToken: string, refreshToken: string): void;
  backgroundRefreshSession?(): { userId: string; refreshToken: string } | null;
  clearBackgroundRefreshCredentials?(): void;
  requestPin(widgetId: string): boolean;
  placedWidgetIds(): string[];
  placedInstances(): { widgetId: string; deviceId: string; platformWidgetId: number; renderer: string }[];
  pendingRemovals(): { widgetId: string; deviceId: string; platformWidgetId: number }[];
  acknowledgeRemoval(platformWidgetId: number): void;
  requestLockScreenAdmin(): boolean;
};

/** What the widget draws: the spec from the API and the data last fetched for it. */
export type WidgetPayload = {
  id: string;
  spec: unknown;
  /** Keyed by data source id; null until data was fetched. */
  data: Record<string, unknown> | null;
  /** True when `data` is sample data because no account is connected. */
  sample: boolean;
  updatedAt: string;
};

const native = requireOptionalNativeModule<WidgetRuntimeModule>("WidgetRuntime");

export const homeScreenWidgets = native && {
  deviceId: () => native.deviceId(),
  canPin: () => native.canPin(),
  save: (payload: WidgetPayload) => native.save(payload.id, JSON.stringify(payload)),
  setBackgroundRefreshCredentials: (apiBaseUrl: string, userId: string, accessToken: string, refreshToken: string) =>
    native.setBackgroundRefreshCredentials?.(apiBaseUrl, userId, accessToken, refreshToken),
  backgroundRefreshSession: () => native.backgroundRefreshSession?.() ?? null,
  clearBackgroundRefreshCredentials: () => native.clearBackgroundRefreshCredentials?.(),
  /** Shows the launcher's "Add widget" prompt. False when the launcher can't do that. */
  requestPin: (widgetId: string) => native.requestPin(widgetId),
  placedWidgetIds: () => native.placedWidgetIds(),
  placedInstances: () => native.placedInstances(),
  pendingRemovals: () => native.pendingRemovals(),
  acknowledgeRemoval: (platformWidgetId: number) => native.acknowledgeRemoval(platformWidgetId),
  /** Opens Android's system confirmation screen for device-admin activation. */
  requestLockScreenAdmin: () => native.requestLockScreenAdmin(),
};
