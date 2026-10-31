import { useCallback, useEffect, useState } from "react";

import { fetchGitHubStats, GitHubRequestError } from "@/services/github";
import { type GitHubError, type GitHubStats } from "@/types/github";

type State = {
  data: GitHubStats | null;
  error: GitHubError | null;
  loading: boolean;
  /** True while refetching with a previous snapshot still on screen. */
  refreshing: boolean;
};

const INITIAL: State = { data: null, error: null, loading: true, refreshing: false };

function toError(error: unknown): GitHubError {
  if (error instanceof GitHubRequestError) return error.detail;
  return { kind: "unknown", message: "Something went wrong loading GitHub." };
}

/**
 * Loads public GitHub stats for a login.
 *
 * Keeps the last good snapshot when a refetch fails so the screen can show stale
 * data with a timestamp rather than blanking out — anonymous GitHub requests are
 * capped at 60/hour, so failures are expected rather than exceptional.
 *
 * `refresh` bumps `attempt` instead of running its own fetch, so there is exactly
 * one place that talks to the service and the in-flight request is always aborted
 * by the effect's own cleanup.
 */
export function useGitHubStats(login: string) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    (async () => {
      try {
        const data = await fetchGitHubStats(login, controller.signal);
        if (!active) return;
        setState({ data, error: null, loading: false, refreshing: false });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        // Preserve the previous snapshot so the UI can fall back to stale data.
        setState((s) => ({ data: s.data, error: toError(error), loading: false, refreshing: false }));
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [login, attempt]);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, refreshing: true, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, refresh };
}
