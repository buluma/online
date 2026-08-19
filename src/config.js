// Scoring weights and configuration constants

export const TOTAL_DAYS = 90;
export const DEFAULT_DAYS = 60;
export const LIVE_REFRESH_MS = 120000;

export const STATUS_SCORE = { g: 1, y: 0.6, o: 0.3, r: 0, b: 0.8 };
export const UPTIME_SCORE = { g: 100, y: 99.5, o: 98, r: 95, b: 99 };
export const STATUS_PRIORITY = { r: 4, o: 3, y: 2, b: 1, g: 0 };

export const C_WEIGHTS = [3, 3, 2];
export const O_WEIGHTS = [3, 3, 2];
export const G_WEIGHTS = [3, 3, 2, 1, 1];
