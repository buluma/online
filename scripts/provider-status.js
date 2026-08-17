import { OPENAI_COMPONENT_GROUPS } from './openai-groups.js';

const OPENAI_HISTORY_LABEL_TO_SERVICE = {
  APIs: 'OpenAI APIs',
  ChatGPT: 'ChatGPT',
  Codex: 'Codex',
  Sora: 'Sora',
  FedRAMP: 'FedRAMP',
};

const OPENAI_PILL_TO_STATUS = {
  Operational: 'g',
  DegradedPerformance: 'y',
  PartialOutage: 'o',
  FullOutage: 'r',
};

const OPENAI_FEED_COMPONENT_GROUPS = {
  'OpenAI APIs': [
    'Responses', 'Chat Completions', 'Embeddings', 'Fine-tuning', 'Images',
    'Batch', 'Audio', 'Moderations', 'Compliance API', 'Realtime', 'Audit Logs',
  ],
  'ChatGPT': [
    'Login', 'Conversations', 'Voice mode', 'GPTs', 'Image Generation',
    'Deep Research', 'Agent', 'Connectors/Apps', 'App', 'Apps', 'ChatGPT Atlas',
    'File uploads', 'Files', 'Search', 'Shopping Research',
  ],
  'Codex': ['Codex Web', 'CLI', 'VS Code extension', 'Codex Cloud', 'Codex Github', 'Codex'],
  'Sora': ['Sora', 'Video viewing', 'Video generation', 'Sora API'],
  'FedRAMP': ['FedRAMP'],
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function extractJsonObjectAfter(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Missing marker: ${marker}`);

  const start = markerIndex + marker.length;
  let index = start;
  let depth = 0;
  let inString = false;
  let escape = false;
  let started = false;

  for (; index < text.length; index++) {
    const ch = text[index];
    if (!started) {
      if (ch === '{') {
        started = true;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        index++;
        break;
      }
    }
  }

  return text.slice(start, index);
}

function dateKeyFromIso(isoDate) {
  const date = new Date(isoDate);
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function buildUtcDateRange(days, endDate = new Date()) {
  const today = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d);
  }
  return dates;
}

export function extractClaudeHistory(html) {
  const raw = extractJsonObjectAfter(html, 'var uptimeData = ');
  const uptimeData = JSON.parse(raw);

  const dates = Object.values(uptimeData)[0].days.map(day => dateKeyFromIso(day.date));
  const historyBySource = {};

  for (const value of Object.values(uptimeData)) {
    const code = value.component.code;
    const uptimeMatch = html.match(new RegExp(`id="uptime-percent-${escapeRegExp(code)}"[\\s\\S]*?<var data-var="uptime-percent">([\\d.]+)</var>`));
    historyBySource[value.component.name] = {
      uptime: uptimeMatch ? Number(uptimeMatch[1]) : null,
      days: value.days.map(day => ({
        date: dateKeyFromIso(day.date),
        status: day.outages.m ? 'r' : day.outages.p ? 'o' : (day.related_events?.length ? 'y' : 'g'),
        partialMinutes: Math.round((day.outages.p || 0) / 60),
        majorMinutes: Math.round((day.outages.m || 0) / 60),
        relatedEvents: (day.related_events || []).map(event => event.name),
      })),
    };
  }

  return { dates, historyBySource };
}

export function extractOpenAIHistory(html, targetDays) {
  const sectionRe = /<h3 class="font-medium(?:[^"]*)">([^<]+)<\/h3>[\s\S]*?<var percentage>([\d.]+)<\/var>% uptime[\s\S]*?<svg width="100%" height="16" viewBox="0 0 668 16"[^>]*>([\s\S]*?)<\/svg>/g;
  const historyByService = {};

  for (const match of html.matchAll(sectionRe)) {
    const rawName = match[1];
    const service = OPENAI_HISTORY_LABEL_TO_SERVICE[rawName];
    if (!service) continue;

    const statuses = [...match[3].matchAll(/pill([A-Za-z]+)/g)]
      .map(item => OPENAI_PILL_TO_STATUS[item[1]] || 'g');

    const normalized = targetDays && statuses.length > targetDays
      ? statuses.slice(-targetDays)
      : statuses;

    historyByService[service] = {
      uptime: Number(match[2]),
      statuses: normalized.join(''),
      rawLength: statuses.length,
    };
  }

  return historyByService;
}

export function parseOpenAIFeed(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = match[1];
    const title = stripCdata((body.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '');
    const updated = (body.match(/<updated>([^<]+)<\/updated>/) || [])[1];
    const content = stripCdata((body.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '');
    const components = [...content.matchAll(/<li>([^<(]+)\s*\([^)]*\)<\/li>/g)].map(item => item[1].trim());
    if (!title || !updated) continue;
    entries.push({ title, updated, date: dateKeyFromIso(updated), components });
  }
  return entries;
}

export function openAIFeedGroups(entry) {
  const groups = new Set();

  for (const component of entry.components || []) {
    for (const [groupName, names] of Object.entries(OPENAI_COMPONENT_GROUPS)) {
      if (names.includes(component)) groups.add(groupName);
    }
    for (const [groupName, names] of Object.entries(OPENAI_FEED_COMPONENT_GROUPS)) {
      if (names.includes(component)) groups.add(groupName);
    }
    if (/fedramp/i.test(component)) groups.add('FedRAMP');
  }

  if (groups.size > 0) return groups;

  const text = [entry.title, ...(entry.components || [])].join(' ');
  if (/\b(api|responses?|chat completions?|realtime|embeddings?|fine[- ]tuning|moderations?|audio|images?|batch|compliance|audit logs)\b/i.test(text)) groups.add('OpenAI APIs');
  if (/\b(chatgpt|conversations?|gpts|voice|deep research|agent|connectors?|apps|atlas|login|workspace|sso|search|files?|uploads?|shopping|artifact)\b/i.test(text)) groups.add('ChatGPT');
  if (/\b(codex|cli|vs code|vscode|extension)\b/i.test(text)) groups.add('Codex');
  if (/\b(sora|video)\b/i.test(text)) groups.add('Sora');
  if (/\bfedramp\b/i.test(text)) groups.add('FedRAMP');
  return groups;
}
