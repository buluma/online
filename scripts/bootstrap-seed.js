#!/usr/bin/env node
// One-time script: converts the hand-curated seed data from src/data.js
// into public/data/status.json so the fetch script can merge live data
// on top of the historical baseline. Run once, then delete.

import { writeFileSync, mkdirSync } from 'fs';

// The seed data covers a 90-day window ending March 31, 2026.
// We need to map each character position to an MM-DD date key
// so the merge logic can align it with the current rolling window.

const SEED_END = new Date(Date.UTC(2026, 2, 31)); // March 31, 2026
const DAYS = 90;

function dateKey(d) {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Build the seed's date range (90 days ending March 31)
const seedDates = [];
for (let i = DAYS - 1; i >= 0; i--) {
  const d = new Date(SEED_END);
  d.setUTCDate(d.getUTCDate() - i);
  seedDates.push(d);
}

// Build today's date range (90 days ending today)
const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const todayDates = [];
for (let i = DAYS - 1; i >= 0; i--) {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - i);
  todayDates.push(d);
}

// Seed data (inline to avoid import issues with ES module from src/)
const seedClaudeDaily = {
  'Claude API': 'ggggggyyyyyryggggggyyrgggyyyyggrgrrrygggyyggyyyrgyyyoyyyyrrgggyrrrggyrrrgrooggrrrgrrrg',
  'claude.ai': 'ggggggyyyyyryggggggyyrgggyyyyggrgrrrygggyyggyyyrgyyyoyyyyrrgggyrrrggyrrrgrooggrrrgrrrg',
  'Claude Code': 'gggggggggggggggggggggggggggggggrgrrrygggygggyyyrggggyyyyrrgggyrrrggyrrrgrooggrrrgrrry',
  'platform.claude.com': 'ggggggygggggyygggggyyggggyyyyrggrgrrrygggggggyyyrggyygygrrrggyrrrgggrrrgroggrrrgrrry',
  'Claude for Government': 'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggyggggggggygggg',
};
const seedOpenaiDaily = {
  'OpenAI APIs': 'ggggggggggggggggggggggggggggggggggyyggggyggyyyyogggyygggggyoggggoggyyggggyyggggggygyg',
  'ChatGPT': 'ggggggggggggggggggggggggggggggggggyygoygyyyyyogggyyggyygyogygyoggyygggyyygyggggygyg',
  'Codex': 'gggggggggggggggggggggggggggggggggggggggggggggggyyyygggggggggggggggggggggggggggggggg',
  'Sora': 'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggogggggggggggggggggoggggggg',
  'FedRAMP': 'ggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
};
const seedOaiIncidents = {
  '03-31': ['SSO failures for Enterprise/Edu'], '03-29': ['Login instability'],
  '03-26': ['Responses API and Sora errors'], '03-25': ['File download/preview issues'],
  '03-24': ['Realtime API SIP errors', 'Sync app errors', 'Project file errors'],
  '03-20': ['Pinned chats not loading'], '03-18': ['Sora video generation failing'],
  '03-17': ['ChatGPT 5.4 Pro errors', 'Excel Plugin down', 'Sign-in errors', 'Free/Guest plan errors'],
  '03-13': ['Responses API errors', 'Conversation errors'], '03-12': ['SSO access issues', 'File download errors'],
  '03-11': ['Login errors', 'Conversation errors', 'Deep Research errors', 'File upload errors'],
  '03-10': ['File upload errors', 'Codex unresponsive', 'Support chat degraded'],
  '03-09': ['Codex unresponsive', 'Deep Research LATAM errors', 'Enterprise conversation errors'],
  '03-07': ['Codex usage rate issues', 'Login issues'], '03-06': ['Compliance API errors'],
  '03-05': ['API Error Rates (11 components)', 'ChatGPT message issues', 'Realtime API EU errors'],
  '03-03': ['File upload errors', 'Codex error rate'], '03-02': ['File processing failing', 'Sora API errors', 'Auth failures'],
  '02-26': ['ChatGPT Apps issues'], '02-25': ['Artifact generation down'],
  '02-23': ['Business/Enterprise conversation errors'], '02-20': ['Increased ChatGPT latency'],
  '02-19': ['Audit Logs issues'], '02-18': ['Sora 2 degraded performance'],
  '02-16': ['Shopping Research down', 'Codex Cloud errors'], '02-14': ['Support email delays', 'Image generation errors'],
  '02-12': ['Conversation issues', 'Embeddings error rate'], '02-11': ['Login errors'],
  '02-10': ['ChatGPT Go errors', 'GPT 5.2 error rates'], '02-09': ['Codex GitHub dependency issues'],
  '02-07': ['Conversation loading issues'], '02-05': ['Increased ChatGPT errors'],
  '02-04': ['ChatGPT Availability Impacted', 'Custom GPT updates failing', 'Conversation loading issues'],
  '02-03': ['Finetuning job errors'],
};
const seedClaudeMinutes = {
  '01-14': 1300, '01-22': 2776, '01-29': 5331, '02-01': 6444, '02-04': 5091, '02-14': 4583, '02-18': 695,
  '02-23': 2997, '02-25': 11665, '02-26': 23748, '02-27': 16039, '02-28': 10369,
  '03-02': 9959, '03-03': 2914, '03-12': 5160, '03-13': 10218, '03-17': 14940, '03-18': 5851,
  '03-19': 4310, '03-21': 5714, '03-23': 960, '03-25': 31930, '03-26': 5095, '03-27': 16920,
  '03-29': 13885, '03-31': 2198,
};

// Map seed data to today's 90-day window
// Build a lookup: dateKey → index in seed
const seedDateMap = {};
seedDates.forEach((d, i) => { seedDateMap[dateKey(d)] = i; });

// For each service, build a new 90-char string aligned to today's window
function remapDaily(seedDaily) {
  const result = {};
  for (const [svc, str] of Object.entries(seedDaily)) {
    let mapped = '';
    for (const d of todayDates) {
      const dk = dateKey(d);
      const seedIdx = seedDateMap[dk];
      mapped += (seedIdx !== undefined && seedIdx < str.length) ? str[seedIdx] : 'g';
    }
    result[svc] = mapped;
  }
  return result;
}

const UPTIME_SCORES = { g: 100, y: 99.5, o: 98, r: 95, b: 99 };
function computeUptime(str) {
  if (!str.length) return 100;
  let t = 0;
  for (const c of str) t += UPTIME_SCORES[c] ?? 100;
  return +(t / str.length).toFixed(2);
}

const claudeDaily = remapDaily(seedClaudeDaily);
const openaiDaily = remapDaily(seedOpenaiDaily);

const uptime = {};
for (const s of Object.keys(claudeDaily)) uptime[s] = computeUptime(claudeDaily[s]);
for (const s of Object.keys(openaiDaily)) uptime[s] = computeUptime(openaiDaily[s]);

// Filter incidents and minutes to only include dates in the current window
const todayDateKeys = new Set(todayDates.map(dateKey));

const oaiIncidents = {};
for (const [dk, list] of Object.entries(seedOaiIncidents)) {
  if (todayDateKeys.has(dk)) oaiIncidents[dk] = list;
}

const claudeMinutes = {};
for (const [dk, mins] of Object.entries(seedClaudeMinutes)) {
  if (todayDateKeys.has(dk)) claudeMinutes[dk] = mins;
}

const data = {
  updated: new Date().toISOString(),
  startDate: dateKey(todayDates[0]),
  claudeDaily,
  openaiDaily,
  uptime,
  oaiIncidents,
  claudeMinutes,
};

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/status.json', JSON.stringify(data, null, 2));
console.log('Bootstrapped public/data/status.json with seed data aligned to today\'s 90-day window.');
console.log(`Window: ${dateKey(todayDates[0])} → ${dateKey(todayDates[todayDates.length - 1])}`);
