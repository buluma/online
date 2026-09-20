// Shape of public/data/status.json (also the SEED_DATA fallback in data.js).
// Type-only module: consumed through JSDoc imports, never loaded at runtime.

/**
 * Per-day outage detail for a Claude or GitHub component, keyed by "MM-DD".
 * @typedef {Record<string, { partialMinutes: number, majorMinutes: number, events: string[] }>} OutageDetail
 */

/**
 * Per-day incident titles for an OpenAI service, keyed by "MM-DD".
 * @typedef {Record<string, { titles: string[] }>} TitleDetail
 */

/**
 * @typedef {object} StatusData
 * @property {string} updated ISO timestamp of the last refresh
 * @property {string} startDate "MM-DD" of the first entry in dates
 * @property {string[]} dates "MM-DD" per day, oldest first
 * @property {Record<string, string>} currentStatus by service name, one status letter (g, y, o, r or b)
 * @property {Record<string, string>} claudeDaily one status letter per day, by service
 * @property {Record<string, string>} openaiDaily one status letter per day, by service
 * @property {Record<string, string>} githubDaily one status letter per day, by service
 * @property {Record<string, number>} uptime percent, by service
 * @property {Record<string, string[]>} oaiIncidents incident titles by "MM-DD"
 * @property {Record<string, string[]>} githubIncidents incident titles by "MM-DD"
 * @property {Record<string, number>} claudeMinutes outage minutes by "MM-DD"
 * @property {Record<string, OutageDetail>} claudeDetails by service
 * @property {Record<string, TitleDetail>} openaiDetails by service
 * @property {Record<string, OutageDetail>} githubDetails by service
 */

export {};
