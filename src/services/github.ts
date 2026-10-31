import { type ActivityStreak, type GitHubError, type GitHubStats, type PullRequestSummary } from "@/types/github";

/**
 * Unauthenticated GitHub public API client.
 *
 * TEMPORARY DIRECT PROVIDER CALL. The architecture says provider traffic belongs
 * behind the WidgetComposer backend, but no backend exists in this repository yet.
 * This module is the single place the app talks to GitHub, so moving it behind
 * `/v1/integrations` later is a change to this file alone.
 *
 * It sends no token and reads only public data. Unauthenticated requests are limited
 * to 60 per hour per IP, so callers must cache and handle `rate-limited`.
 */

const API = "https://api.github.com";
const TIMEOUT_MS = 10_000;
/** The public events feed covers roughly this much history. */
const EVENT_WINDOW_DAYS = 90;

const HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export class GitHubRequestError extends Error {
  readonly detail: GitHubError;
  constructor(detail: GitHubError) {
    super(detail.message);
    this.name = "GitHubRequestError";
    this.detail = detail;
  }
}

function normalize(status: number, body: unknown): GitHubError {
  const message = typeof body === "object" && body && "message" in body ? String(body.message) : "";
  if (status === 403 && /rate limit/i.test(message)) {
    return { kind: "rate-limited", message: "GitHub's hourly limit for anonymous requests is used up." };
  }
  if (status === 404) return { kind: "not-found", message: "That GitHub user could not be found." };
  return { kind: "unknown", message: message || `GitHub returned ${status}.` };
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  // Abort if either the caller cancels or the request runs long.
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(`${API}${path}`, { headers: HEADERS, signal: timeout.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new GitHubRequestError(normalize(response.status, body));
    return body as T;
  } catch (error) {
    if (error instanceof GitHubRequestError) throw error;
    if (signal?.aborted) throw error;
    // Everything below is reported as "offline", so keep the real cause visible in development.
    if (__DEV__) console.warn(`[github] ${path} failed`, error);
    throw new GitHubRequestError({
      kind: "offline",
      message:
        "Couldn't reach GitHub. Check your connection and try again." + (__DEV__ ? ` [${path}: ${String(error)}]` : ""),
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** `search/issues` only reports totals, so each state needs its own count query. */
async function countPullRequests(login: string, qualifier: string, signal?: AbortSignal): Promise<number> {
  const q = encodeURIComponent(`author:${login} type:pr ${qualifier}`);
  const data = await get<{ total_count?: number }>(`/search/issues?q=${q}&per_page=1`, signal);
  return data.total_count ?? 0;
}

type SearchItem = {
  id: number;
  title: string;
  html_url: string;
  state: string;
  updated_at: string;
  repository_url: string;
  pull_request?: { merged_at: string | null };
};

function toPullRequest(item: SearchItem): PullRequestSummary {
  const merged = Boolean(item.pull_request?.merged_at);
  return {
    id: item.id,
    title: item.title,
    repo: item.repository_url.split("/").pop() ?? "",
    state: merged ? "merged" : item.state === "open" ? "open" : "closed",
    updatedAt: item.updated_at,
    url: item.html_url,
  };
}

type EventItem = { created_at: string };

/** Counts consecutive active days backwards from today using the public events feed. */
export function deriveStreak(dates: string[], today = new Date()): ActivityStreak {
  const days = [...new Set(dates.map((d) => d.slice(0, 10)))].sort().reverse();
  if (days.length === 0) {
    return { currentStreak: 0, longestStreak: 0, activeDays: 0, lastActive: null, windowDays: EVENT_WINDOW_DAYS };
  }

  const dayMs = 86_400_000;
  const asDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  // A streak stays alive if the latest activity was today or yesterday.
  const gap = Math.round((todayUtc - asDay(days[0])) / dayMs);
  let current = 0;
  if (gap <= 1) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (Math.round((asDay(days[i - 1]) - asDay(days[i])) / dayMs) !== 1) break;
      current++;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (Math.round((asDay(days[i - 1]) - asDay(days[i])) / dayMs) === 1) run++;
    else run = 1;
    if (run > longest) longest = run;
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    activeDays: days.length,
    lastActive: days[0],
    windowDays: EVENT_WINDOW_DAYS,
  };
}

/** Fetches everything the GitHub widgets need. Throws `GitHubRequestError`. */
export async function fetchGitHubStats(login: string, signal?: AbortSignal): Promise<GitHubStats> {
  const profile = await get<{
    login: string;
    name: string | null;
    avatar_url: string;
    public_repos: number;
    followers: number;
  }>(`/users/${encodeURIComponent(login)}`, signal);

  const recentQuery = encodeURIComponent(`author:${login} type:pr`);
  const [open, merged, closed, recent, events] = await Promise.all([
    countPullRequests(login, "is:open", signal),
    countPullRequests(login, "is:merged", signal),
    countPullRequests(login, "is:closed is:unmerged", signal),
    get<{ items?: SearchItem[] }>(`/search/issues?q=${recentQuery}&sort=updated&order=desc&per_page=5`, signal),
    get<EventItem[]>(`/users/${encodeURIComponent(login)}/events/public?per_page=100`, signal),
  ]);

  return {
    login: profile.login,
    name: profile.name,
    avatarUrl: profile.avatar_url,
    publicRepos: profile.public_repos,
    followers: profile.followers,
    pullRequests: { open, merged, closed, total: open + merged + closed },
    recent: (recent.items ?? []).map(toPullRequest),
    activity: deriveStreak(events.map((e) => e.created_at)),
    fetchedAt: Date.now(),
  };
}
