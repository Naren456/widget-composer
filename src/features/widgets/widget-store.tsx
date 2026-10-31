import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { syncHomeScreenWidget } from "@/features/widgets/sync-home-screen";
import { type SavedWidget } from "@/types/widget";

/**
 * Session-only widget list.
 *
 * There is no backend and no local persistence yet, so this holds widgets in memory
 * for the lifetime of the app process only — everything is lost on restart. It exists
 * so the Create → Preview → Save → Home journey is navigable end to end. Replace it
 * with server-owned data once the WidgetComposer API is available.
 */

type WidgetStore = {
  widgets: SavedWidget[];
  save: (widget: SavedWidget) => void;
  remove: (id: string) => void;
  find: (id: string) => SavedWidget | undefined;
  /**
   * One unsaved draft the preview can open by id. Agent drafts carry a document that
   * does not fit in route params, so the chat stages the draft here before navigating.
   */
  staged: SavedWidget | null;
  stage: (widget: SavedWidget) => void;
};

const WidgetStoreContext = createContext<WidgetStore | null>(null);

export function WidgetStoreProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<SavedWidget[]>([]);
  const [staged, setStaged] = useState<SavedWidget | null>(null);

  const save = useCallback((widget: SavedWidget) => {
    setWidgets((current) => [widget, ...current.filter((w) => w.id !== widget.id)]);
  }, []);

  const remove = useCallback((id: string) => {
    setWidgets((current) => current.filter((w) => w.id !== id));
  }, []);

  // Mirror the latest widget onto the home screen whenever the list changes.
  useEffect(() => {
    syncHomeScreenWidget(widgets);
  }, [widgets]);

  const value = useMemo<WidgetStore>(
    () => ({
      widgets,
      save,
      remove,
      find: (id) => widgets.find((w) => w.id === id),
      staged,
      stage: setStaged,
    }),
    [widgets, save, remove, staged],
  );

  return <WidgetStoreContext.Provider value={value}>{children}</WidgetStoreContext.Provider>;
}

export function useWidgetStore(): WidgetStore {
  const store = useContext(WidgetStoreContext);
  if (!store) throw new Error("useWidgetStore must be used inside a WidgetStoreProvider");
  return store;
}
