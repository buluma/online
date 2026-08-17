#!/usr/bin/env node
// Smoke test: validates public/data/status.json against the providers'
// native historical uptime bars and live current-status summaries.

import { readFileSync } from 'fs';
import {
  OPENAI_SERVICES,
  liveOpenAIGroupStatus,
  openAIComponentGroups,
} from './openai-groups.js';
import {
  extractClaudeHistory,
  extractOpenAIHistory,
} from './provider-status.js';

const VALID_STATUS_CHARS = new Set(['g', 'y', 'o', 'r', 'b']);

const CLAUDE_SERVICES = [
  'Claude API',
  'claude.ai',
  'Claude Code',
  'platform.claude.com',
  'Claude Cowork',
  'Claude for Government',
];

const TRACKED_CLAUDE_SERVICES = ['Claude API', 'claude.ai', 'Claude Code'];
const TRACKED_OPENAI_SERVICES = ['OpenAI APIs', 'ChatGPT', 'Codex'];

const CLAUDE_COMPONENT_MAP = {
  'claude.ai': 'claude.ai',
  'Claude Console (platform.claude.com)': 'platform.claude.com',
  'platform.claude.com (formerly console.anthropic.com)': 'platform.claude.com',
  'Claude API (api.anthropic.com)': 'Claude API',
  'Claude Code': 'Claude Code',
  'Claude Cowork': 'Claude Cowork',
  'Claude for Government': 'Claude for Government',
};

const STATUS_MAP = {
  operational: 'g',
  degraded_performance: 'y',
  partial_outage: 'o',
  major_outage: 'r',
  under_maintenance: 'b',
};

const PRIORITY = { g: 0, b: 1, y: 2, o: 3, r: 4 };

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'thenines-smoketest/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function fetchJSON(url) {
  return JSON.parse(await fetchText(url));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

async function main() {
  console.log('Loading status.json...');
  const raw = readFileSync('public/data/status.json', 'utf8');
  const data = JSON.parse(raw);
  const days = data.dates?.length || 90;

  console.log('\n── Structure ──');
  assert(typeof data.updated === 'string' && data.updated.length > 0, 'updated is non-empty string');
  assert(typeof data.startDate === 'string' && /^\d{2}-\d{2}$/.test(data.startDate), 'startDate is MM-DD format');
  assert(Array.isArray(data.dates) && data.dates.length === days, 'dates is an array');
  assert(data.dates.every(date => /^\d{2}-\d{2}$/.test(date)), 'dates entries are MM-DD');
  assert(typeof data.currentStatus === 'object', 'currentStatus is object');
  assert(typeof data.claudeDaily === 'object', 'claudeDaily is object');
  assert(typeof data.openaiDaily === 'object', 'openaiDaily is object');
  assert(typeof data.uptime === 'object', 'uptime is object');
  assert(typeof data.oaiIncidents === 'object', 'oaiIncidents is object');
  assert(typeof data.claudeMinutes === 'object', 'claudeMinutes is object');
  assert(typeof data.claudeDetails === 'object', 'claudeDetails is object');
  assert(typeof data.openaiDetails === 'object', 'openaiDetails is object');

  console.log('\n── Claude Services ──');
  for (const svc of CLAUDE_SERVICES) {
    const str = data.claudeDaily[svc];
    assert(typeof str === 'string', `${svc} exists in claudeDaily`);
    assert(str?.length === days, `${svc} has ${days} days (got ${str?.length})`);
    assert([...(str || '')].every(ch => VALID_STATUS_CHARS.has(ch)), `${svc} contains only valid status chars`);
  }

  console.log('\n── OpenAI Services ──');
  for (const svc of OPENAI_SERVICES) {
    const str = data.openaiDaily[svc];
    assert(typeof str === 'string', `${svc} exists in openaiDaily`);
    assert(str?.length === days, `${svc} has ${days} days (got ${str?.length})`);
    assert([...(str || '')].every(ch => VALID_STATUS_CHARS.has(ch)), `${svc} contains only valid status chars`);
  }

  console.log('\n── Live Provider Data ──');
  console.log('Fetching official pages...');
  const [claudeSummary, openaiSummary, claudeHtml, openaiHtml] = await Promise.all([
    fetchJSON('https://status.claude.com/api/v2/summary.json'),
    fetchJSON('https://status.openai.com/api/v2/summary.json'),
    fetchText('https://status.claude.com/'),
    fetchText('https://status.openai.com/'),
  ]);

  const claudeHistory = extractClaudeHistory(claudeHtml);
  const openaiHistory = extractOpenAIHistory(openaiHtml, days);

  console.log('\n── Date Range Alignment ──');
  assert(JSON.stringify(data.dates) === JSON.stringify(claudeHistory.dates), 'dates matches Claude provider history');
  assert(data.startDate === claudeHistory.dates[0], 'startDate matches first provider date');

  console.log('\n── Claude History Alignment ──');
  for (const componentName of (claudeSummary.components || []).map(component => component.name)) {
    const serviceName = CLAUDE_COMPONENT_MAP[componentName];
    assert(Boolean(serviceName), `Claude component "${componentName}" is mapped`);
    if (!serviceName) continue;

    const providerService = claudeHistory.historyBySource[componentName];
    assert(Boolean(providerService), `${componentName} exists in Claude provider history`);
    if (!providerService) continue;

    const expectedStatuses = providerService.days.map(day => day.status).join('');
    assert(data.claudeDaily[serviceName] === expectedStatuses, `${serviceName} historical bars match Claude`);
    assert(data.uptime[serviceName] === providerService.uptime, `${serviceName} uptime matches Claude (${providerService.uptime})`);
    assert(data.currentStatus[serviceName] === (STATUS_MAP[(claudeSummary.components || []).find(component => component.name === componentName)?.status] || 'g'),
      `${serviceName} current status matches Claude summary`);
  }

  console.log('\n── OpenAI History Alignment ──');
  for (const serviceName of OPENAI_SERVICES) {
    const providerService = openaiHistory[serviceName];
    if (!providerService) {
      assert(data.openaiDaily[serviceName] === 'g'.repeat(days), `${serviceName} uses fallback history when provider omits a history row`);
      assert(data.uptime[serviceName] === 100, `${serviceName} uses fallback uptime when provider omits a history row`);
      const expected = liveOpenAIGroupStatus(openaiSummary.components || [], serviceName, STATUS_MAP, PRIORITY);
      assert(data.currentStatus[serviceName] === expected, `${serviceName} current status matches OpenAI summary`);
      continue;
    }
    assert(data.openaiDaily[serviceName] === providerService.statuses, `${serviceName} historical bars match OpenAI`);
    assert(data.uptime[serviceName] === providerService.uptime, `${serviceName} uptime matches OpenAI (${providerService.uptime})`);
    const expected = liveOpenAIGroupStatus(openaiSummary.components || [], serviceName, STATUS_MAP, PRIORITY);
    assert(data.currentStatus[serviceName] === expected, `${serviceName} current status matches OpenAI summary`);
  }

  console.log('\n── OpenAI Component Coverage ──');
  for (const component of openaiSummary.components || []) {
    const groups = openAIComponentGroups(component.name || '');
    assert(groups.length > 0 || /fedramp/i.test(component.name || ''), `OpenAI component "${component.name}" is assigned to a tracked group`);
  }

  console.log('\n── Aggregate Detail Consistency ──');
  for (const [date, minutes] of Object.entries(data.claudeMinutes)) {
    const total = TRACKED_CLAUDE_SERVICES.reduce((sum, serviceName) => {
      const detail = data.claudeDetails?.[serviceName]?.[date];
      return sum + ((detail?.partialMinutes || 0) + (detail?.majorMinutes || 0));
    }, 0);
    assert(minutes === total, `claudeMinutes["${date}"] matches tracked Claude row details`);
  }

  for (const [date, titles] of Object.entries(data.oaiIncidents)) {
    const aggregate = uniqueSorted(TRACKED_OPENAI_SERVICES.flatMap(serviceName => data.openaiDetails?.[serviceName]?.[date]?.titles || []));
    assert(JSON.stringify(uniqueSorted(titles)) === JSON.stringify(aggregate), `oaiIncidents["${date}"] matches tracked OpenAI row details`);
  }

  console.log('\n── Freshness ──');
  const age = Date.now() - new Date(data.updated).getTime();
  const ageHours = (age / 3600000).toFixed(1);
  if (age > 2 * 3600000) {
    console.warn(`  WARN: Data is ${ageHours}h old (> 2h)`);
  } else {
    passed++;
    console.log(`  OK: Data is ${ageHours}h old`);
  }

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
