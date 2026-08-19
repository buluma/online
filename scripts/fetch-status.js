#!/usr/bin/env node
// Fetches Claude & OpenAI provider pages, preserves their native daily history,
// and writes the normalized data shape the frontend expects.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { OPENAI_SERVICES, liveOpenAIGroupStatus } from "./openai-groups.js";
import {
  extractClaudeHistory,
  extractGitHubHistory,
  extractOpenAIHistory,
  openAIFeedGroups,
  parseOpenAIFeed,
} from "./provider-status.js";

const STATUS_MAP = {
  operational: "g",
  degraded_performance: "y",
  partial_outage: "o",
  major_outage: "r",
  under_maintenance: "b",
};

const PRIORITY = { g: 0, b: 1, y: 2, o: 3, r: 4 };
const UPTIME_SCORES = { g: 100, y: 99.5, o: 98, r: 95, b: 99 };

const REQUIRED_DAILY_KEYS = ["claudeDaily", "openaiDaily", "githubDaily"];

const VALID_STATUS_CHARS = new Set(["g", "y", "o", "r", "b"]);

function validateData(data) {
  const errors = [];

  if (!data.updated || isNaN(Date.parse(data.updated))) {
    errors.push("missing or invalid 'updated' timestamp");
  }

  if (!Array.isArray(data.dates) || data.dates.length < 30) {
    errors.push(
      `dates array too short (${data.dates?.length ?? 0} days, need 30+)`,
    );
  }

  if (!data.startDate) {
    errors.push("missing 'startDate'");
  }

  for (const key of REQUIRED_DAILY_KEYS) {
    const group = data[key];
    if (!group || typeof group !== "object") {
      errors.push(`missing '${key}' object`);
      continue;
    }
    for (const [service, str] of Object.entries(group)) {
      if (typeof str !== "string") {
        errors.push(`${key}.${service} is not a string`);
        continue;
      }
      if (str.length !== data.dates.length) {
        errors.push(
          `${key}.${service} length ${str.length} != dates length ${data.dates.length}`,
        );
      }
      for (let i = 0; i < str.length; i++) {
        if (!VALID_STATUS_CHARS.has(str[i])) {
          errors.push(
            `${key}.${service} invalid char '${str[i]}' at index ${i}`,
          );
          break;
        }
      }
    }
  }

  if (!data.uptime || typeof data.uptime !== "object") {
    errors.push("missing 'uptime' object");
  }

  return errors;
}

const CLAUDE_COMPONENT_MAP = {
  "claude.ai": "claude.ai",
  "Claude Console (platform.claude.com)": "platform.claude.com",
  "platform.claude.com (formerly console.anthropic.com)": "platform.claude.com",
  "Claude API (api.anthropic.com)": "Claude API",
  "Claude Code": "Claude Code",
  "Claude Cowork": "Claude Cowork",
  "Claude for Government": "Claude for Government",
};

const CLAUDE_SERVICES = [
  "Claude API",
  "claude.ai",
  "Claude Code",
  "platform.claude.com",
  "Claude Cowork",
  "Claude for Government",
];

const TRACKED_CLAUDE_SERVICES = new Set([
  "Claude API",
  "claude.ai",
  "Claude Code",
]);
const TRACKED_OPENAI_SERVICES = new Set(["OpenAI APIs", "ChatGPT", "Codex"]);

const GITHUB_COMPONENT_MAP = {
  "API Requests": "GitHub API",
  "Git Operations": "Git Operations",
  Actions: "Actions",
  Copilot: "Copilot",
  Webhooks: "Webhooks",
  Issues: "Issues",
  "Pull Requests": "Pull Requests",
  Packages: "Packages",
  Pages: "Pages",
  Codespaces: "Codespaces",
  "Copilot AI Model Providers": "Copilot AI Model Providers",
};

const GITHUB_SERVICES = [
  "GitHub API",
  "Git Operations",
  "Actions",
  "Copilot",
  "Webhooks",
  "Issues",
  "Pull Requests",
  "Packages",
  "Pages",
  "Codespaces",
  "Copilot AI Model Providers",
];

const TRACKED_GITHUB_SERVICES = new Set([
  "GitHub API",
  "Git Operations",
  "Actions",
]);

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
        headers: { "User-Agent": "thenines-action/1.0" },
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
      console.warn(
        `  Attempt ${attempt}/${retries} failed for ${url}: ${err.message}, retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function fetchTextWithCurl(url) {
  console.warn(`  Node fetch received 405 for ${url}; retrying with curl.`);
  return execFileSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "15",
      "--user-agent",
      "thenines-action/1.0",
      url,
    ],
    {
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    },
  );
}

async function fetchJSON(url, retries = 3) {
  const text = await fetchText(url, retries);
  return JSON.parse(text);
}

async function main() {
  console.log("Fetching provider status pages...");
  const [
    claudeSummary,
    openaiSummary,
    githubSummary,
    claudeHtml,
    openaiHtml,
    openaiFeedXml,
    githubHtml,
  ] = await Promise.all([
    fetchJSON("https://status.claude.com/api/v2/summary.json"),
    fetchJSON("https://status.openai.com/api/v2/summary.json"),
    fetchJSON("https://www.githubstatus.com/api/v2/summary.json"),
    fetchText("https://status.claude.com/"),
    fetchText("https://status.openai.com/"),
    fetchText("https://status.openai.com/feed.atom"),
    fetchText("https://www.githubstatus.com/"),
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
    claudeDaily[serviceName] = "g".repeat(dates.length);
    claudeDetails[serviceName] = {};
  }

  for (const [sourceName, history] of Object.entries(
    claudeHistory.historyBySource,
  )) {
    const serviceName = CLAUDE_COMPONENT_MAP[sourceName];
    if (!serviceName) continue;

    const statuses = history.days.map((day) => day.status).join("");
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
    if (serviceName)
      currentStatus[serviceName] = STATUS_MAP[component.status] || "g";
  }

  const openaiHistory = extractOpenAIHistory(openaiHtml, dates.length);
  const openaiDaily = {};
  const openaiDetails = {};
  const oaiIncidents = {};

  for (const serviceName of OPENAI_SERVICES) {
    const history = openaiHistory[serviceName];
    openaiDaily[serviceName] = history?.statuses || "g".repeat(dates.length);
    openaiDetails[serviceName] = {};
    uptime[serviceName] =
      history?.uptime ?? computeUptime(openaiDaily[serviceName]);
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

  const githubHistory = extractGitHubHistory(githubHtml);
  const githubDaily = {};
  const githubDetails = {};
  const githubIncidents = {};

  for (const serviceName of GITHUB_SERVICES) {
    githubDaily[serviceName] = "g".repeat(dates.length);
    githubDetails[serviceName] = {};
  }

  for (const [sourceName, history] of Object.entries(
    githubHistory.historyBySource,
  )) {
    const serviceName = GITHUB_COMPONENT_MAP[sourceName];
    if (!serviceName) continue;

    const statuses = history.days.map((day) => day.status).join("");
    githubDaily[serviceName] = statuses;
    uptime[serviceName] = history.uptime ?? computeUptime(statuses);

    for (const day of history.days) {
      const totalMinutes = (day.partialMinutes || 0) + (day.majorMinutes || 0);
      if (totalMinutes > 0 || day.relatedEvents.length > 0) {
        githubDetails[serviceName][day.date] = {
          partialMinutes: day.partialMinutes || 0,
          majorMinutes: day.majorMinutes || 0,
          events: day.relatedEvents,
        };
      }
      if (TRACKED_GITHUB_SERVICES.has(serviceName) && totalMinutes > 0) {
        const titles = githubIncidents[day.date] || [];
        for (const event of day.relatedEvents) {
          if (!titles.includes(event)) titles.push(event);
        }
        if (titles.length > 0) githubIncidents[day.date] = titles;
      }
    }
  }

  for (const component of githubSummary.components || []) {
    const serviceName = GITHUB_COMPONENT_MAP[component.name];
    if (serviceName)
      currentStatus[serviceName] = STATUS_MAP[component.status] || "g";
  }

  const data = {
    updated: new Date().toISOString(),
    startDate: dates[0],
    dates,
    currentStatus,
    claudeDaily,
    openaiDaily,
    githubDaily,
    uptime,
    oaiIncidents,
    githubIncidents,
    claudeMinutes,
    claudeDetails,
    openaiDetails,
    githubDetails,
  };

  mkdirSync("public/data", { recursive: true });
  const outPath = "public/data/status.json";

  const validationErrors = validateData(data);
  if (validationErrors.length > 0) {
    console.error("Data validation failed:");
    for (const err of validationErrors) console.error(`  - ${err}`);
    process.exit(1);
  }

  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, "utf8"));
    const { updated: _prevUpdated, ...prevData } = prev;
    const { updated: _newUpdated, ...newData } = data;
    if (JSON.stringify(prevData) === JSON.stringify(newData)) {
      console.log("No changes detected, skipping write.");
      process.exit(0);
    }
  }

  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(
    `Wrote ${outPath} (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
