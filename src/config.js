// Scoring weights and configuration constants

export const TOTAL_DAYS = 90;
export const DEFAULT_DAYS = 60;
export const LIVE_REFRESH_MS = 120000;
// status.json is only rewritten when content changes, so healthy quiet
// stretches exceed 12h. Older than this means refreshes are failing.
export const DATA_OUTDATED_MS = 24 * 60 * 60 * 1000;

/** @type {Record<string, number>} */
export const STATUS_SCORE = { g: 1, y: 0.6, o: 0.3, r: 0, b: 0.8 };
/** @type {Record<string, number>} */
export const UPTIME_SCORE = { g: 100, y: 99.5, o: 98, r: 95, b: 99 };
/** @type {Record<string, number>} */
export const STATUS_PRIORITY = { r: 4, o: 3, y: 2, b: 1, g: 0 };

export const C_WEIGHTS = [3, 3, 2];
export const O_WEIGHTS = [3, 3, 2];
export const G_WEIGHTS = [3, 3, 2, 1, 1];
