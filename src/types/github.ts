/** Shapes returned by `src/services/github.ts`. Public GitHub data only. */

export type PullRequestSummary = {
  id: number;
  title: string;
  repo: string;
  state: "open" | "merged" | "closed";
  updatedAt: string;
  url: string;
};

export type GitHubStats = {
  login: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  pullRequests: {
    open: number;
    merged: number;
    closed: number;
    total: number;
  };
  recent: PullRequestSummary[];
  activity: ActivityStreak;
  /** When this snapshot was fetched, for the stale-data label. */
  fetchedAt: number;
};

/**
 * Activity derived from the PUBLIC events feed.
 *
 * This is deliberately not called a "contribution streak". GitHub's contribution
 * calendar lives behind the authenticated GraphQL API, and a token must never ship
 * in the mobile bundle. The public events feed only covers roughly the last 90 days
 * or 300 events and omits private contributions, so these numbers can legitimately
 * be lower than the profile page. Surface them as public activity, never as the
 * user's real contribution streak.
 */
export type ActivityStreak = {
  /** Consecutive days with public activity ending today or yesterday; 0 otherwise. */
  currentStreak: number;
  /** Longest run of consecutive active days inside the window. */
  longestStreak: number;
  /** Distinct days with public activity inside the window. */
  activeDays: number;
  /** ISO date of the most recent public event, or null when the window is empty. */
  lastActive: string | null;
  /** Days covered by the events window. */
  windowDays: number;
};

export type GitHubError =
  | { kind: "rate-limited"; message: string; retryAfter?: number }
  | { kind: "not-found"; message: string }
  | { kind: "offline"; message: string }
  | { kind: "unknown"; message: string };
