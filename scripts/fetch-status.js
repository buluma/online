#!/usr/bin/env node
// Fetches Claude & OpenAI provider pages, preserves their native daily history,
// and writes the normalized data shape the frontend expects.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import {
  OPENAI_SERVICES,
  liveOpenAIGroupStatus,
} from './openai-groups.js';
import {
  extractClaudeHistory,
  extractOpenAIHistory,
  openAIFeedGroups,
  parseOpenAIFeed,
} from './provider-status.js';

const STATUS_MAP = {
  operational: 'g',
  degraded_performance: 'y',
  partial_outage: 'o',
  major_outage: 'r',
  under_maintenance: 'b',
};

const PRIORITY = { g: 0, b: 1, y: 2, o: 3, r: 4 };
const UPTIME_SCORES = { g: 100, y: 99.5, o: 98, r: 95, b: 99 };

const CLAUDE_COMPONENT_MAP = {
  'claude.ai': 'claude.ai',
  'Claude Console (platform.claude.com)': 'platform.claude.com',
  'platform.claude.com (formerly console.anthropic.com)': 'platform.claude.com',
  'Claude API (api.anthropic.com)': 'Claude API',
  'Claude Code': 'Claude Code',
  'Claude Cowork': 'Claude Cowork',
  'Claude for Government': 'Claude for Government',
};

const CLAUDE_SERVICES = [
  'Claude API',
  'claude.ai',
  'Claude Code',
  'platform.claude.com',
  'Claude Cowork',
  'Claude for Government',
];

const TRACKED_CLAUDE_SERVICES = new Set(['Claude API', 'claude.ai', 'Claude Code']);
const TRACKED_OPENAI_SERVICES = new Set(['OpenAI APIs', 'ChatGPT', 'Codex']);

function computeUptime(statusStr) {
  if (!statusStr?.length) return 100;
  let total = 0;
  for (const ch of statusStr) total += UPTIME_SCORES[ch] ?? 100;
  return +(total / statusStr.length).toFixed(2);
}

async function fetchText(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'thenines-action/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        if (res.status === 405) return fetchTextWithCurl(url);
        throw new Error(`${url} -> ${res.status}`);
      }
      return res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * 2 ** (attempt - 1);
      console.warn(`  Attempt ${attempt}/${retries} failed for ${url}: ${err.message}, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function fetchTextWithCurl(url) {
  console.warn(`  Node fetch received 405 for ${url}; retrying with curl.`);
  return execFileSync('curl', [
    '--fail',
    '--silent',
    '--show-error',
    '--location',
    '--max-time',
    '15',
    '--user-agent',
    'thenines-action/1.0',
    url,
  ], {
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });
}

async function fetchJSON(url, retries = 3) {
  const text = await fetchText(url, retries);
  return JSON.parse(text);
}

async function main() {
  console.log('Fetching provider status pages...');
  const [
    claudeSummary,
    openaiSummary,
    claudeHtml,
    openaiHtml,
    openaiFeedXml,
  ] = await Promise.all([
    fetchJSON('https://status.claude.com/api/v2/summary.json'),
    fetchJSON('https://status.openai.com/api/v2/summary.json'),
    fetchText('https://status.claude.com/'),
    fetchText('https://status.openai.com/'),
    fetchText('https://status.openai.com/feed.atom'),
  ]);

  const claudeHistory = extractClaudeHistory(claudeHtml);
  const dates = claudeHistory.dates;
  const dateSet = new Set(dates);

  const claudeDaily = {};
  const claudeDetails = {};
  const claudeMinutes = {};
  const currentStatus = {};
  const uptime = {};

  for (const serviceName of CLAUDE_SERVICES) {
    claudeDaily[serviceName] = 'g'.repeat(dates.length);
    claudeDetails[serviceName] = {};
  }

  for (const [sourceName, history] of Object.entries(claudeHistory.historyBySource)) {
    const serviceName = CLAUDE_COMPONENT_MAP[sourceName];
    if (!serviceName) continue;

    const statuses = history.days.map(day => day.status).join('');
    claudeDaily[serviceName] = statuses;
    uptime[serviceName] = history.uptime ?? computeUptime(statuses);

    for (const day of history.days) {
      const totalMinutes = (day.partialMinutes || 0) + (day.majorMinutes || 0);
      if (totalMinutes > 0 || day.relatedEvents.length > 0) {
        claudeDetails[serviceName][day.date] = {
          partialMinutes: day.partialMinutes || 0,
          majorMinutes: day.majorMinutes || 0,
          events: day.relatedEvents,
        };
      }
      if (TRACKED_CLAUDE_SERVICES.has(serviceName) && totalMinutes > 0) {
        claudeMinutes[day.date] = (claudeMinutes[day.date] || 0) + totalMinutes;
      }
    }
  }

  for (const component of claudeSummary.components || []) {
    const serviceName = CLAUDE_COMPONENT_MAP[component.name];
    if (serviceName) currentStatus[serviceName] = STATUS_MAP[component.status] || 'g';
  }

  const openaiHistory = extractOpenAIHistory(openaiHtml, dates.length);
  const openaiDaily = {};
  const openaiDetails = {};
  const oaiIncidents = {};

  for (const serviceName of OPENAI_SERVICES) {
    const history = openaiHistory[serviceName];
    openaiDaily[serviceName] = history?.statuses || 'g'.repeat(dates.length);
    openaiDetails[serviceName] = {};
    uptime[serviceName] = history?.uptime ?? computeUptime(openaiDaily[serviceName]);
    currentStatus[serviceName] = liveOpenAIGroupStatus(
      openaiSummary.components || [],
      serviceName,
      STATUS_MAP,
      PRIORITY,
    );
  }

  for (const entry of parseOpenAIFeed(openaiFeedXml)) {
    if (!dateSet.has(entry.date)) continue;
    const groups = openAIFeedGroups(entry);
    if (groups.size === 0) continue;

    for (const serviceName of groups) {
      if (!openaiDetails[serviceName]) continue;
      const detail = openaiDetails[serviceName][entry.date] || { titles: [] };
      if (!detail.titles.includes(entry.title)) detail.titles.push(entry.title);
      openaiDetails[serviceName][entry.date] = detail;

      if (TRACKED_OPENAI_SERVICES.has(serviceName)) {
        const titles = oaiIncidents[entry.date] || [];
        if (!titles.includes(entry.title)) titles.push(entry.title);
        oaiIncidents[entry.date] = titles;
      }
    }
  }

  const data = {
    updated: new Date().toISOString(),
    startDate: dates[0],
    dates,
    currentStatus,
    claudeDaily,
    openaiDaily,
    uptime,
    oaiIncidents,
    claudeMinutes,
    claudeDetails,
    openaiDetails,
  };

  mkdirSync('public/data', { recursive: true });
  const outPath = 'public/data/status.json';

  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    const { updated: _prevUpdated, ...prevData } = prev;
    const { updated: _newUpdated, ...newData } = data;
    if (JSON.stringify(prevData) === JSON.stringify(newData)) {
      console.log('No changes detected, skipping write.');
      process.exit(0);
    }
  }

  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${outPath} (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
