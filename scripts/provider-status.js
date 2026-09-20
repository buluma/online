import { inferOpenAIIncidentGroups } from "./openai-groups.js";

const OPENAI_HISTORY_LABEL_TO_SERVICE = {
  APIs: "OpenAI APIs",
  ChatGPT: "ChatGPT",
  Codex: "Codex",
  Sora: "Sora",
  FedRAMP: "FedRAMP",
};

const OPENAI_PILL_TO_STATUS = {
  Operational: "g",
  DegradedPerformance: "y",
  PartialOutage: "o",
  FullOutage: "r",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCdata(value) {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
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
      if (ch === "{") {
        started = true;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
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
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function buildUtcDateRange(days, endDate = new Date()) {
  const today = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d);
  }
  return dates;
}

export function extractUptimeComponentCodes(html) {
  return [
    ...new Set(
      [...html.matchAll(/data-uptime-lazy="([a-z0-9]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
}

/** @param {any} [showcase] */
export function extractClaudeHistory(html, showcase = null) {
  let uptimeData;
  let uptimeHtml = html;

  if (showcase) {
    uptimeData = showcase.timelines || {};
    uptimeHtml += `\n${Object.values(showcase.components || {}).join("\n")}`;
  } else {
    const raw = extractJsonObjectAfter(html, "window.uptimeData = ");
    uptimeData = JSON.parse(raw);
  }

  if (Object.keys(uptimeData).length === 0) {
    throw new Error("Claude uptime history is empty");
  }

  const dates = Object.values(uptimeData)[0].days.map((day) =>
    dateKeyFromIso(day.date),
  );
  const historyBySource = {};

  for (const value of Object.values(uptimeData)) {
    const code = value.component.code;
    const uptimeMatch = uptimeHtml.match(
      new RegExp(
        `id="uptime-percent-${escapeRegExp(code)}"[\\s\\S]*?<var data-var="uptime-percent">([\\d.]+)</var>`,
      ),
    );
    historyBySource[value.component.name] = {
      uptime: uptimeMatch ? Number(uptimeMatch[1]) : null,
      days: value.days.map((day) => ({
        date: dateKeyFromIso(day.date),
        status: day.outages.m
          ? "r"
          : day.outages.p
            ? "o"
            : day.related_events?.length
              ? "y"
              : "g",
        partialMinutes: Math.round((day.outages.p || 0) / 60),
        majorMinutes: Math.round((day.outages.m || 0) / 60),
        relatedEvents: (day.related_events || []).map((event) => event.name),
      })),
    };
  }

  return { dates, historyBySource };
}

export function extractOpenAIHistory(html, targetDays) {
  const sectionRe =
    /<h3 class="font-medium(?:[^"]*)">([^<]+)<\/h3>[\s\S]*?<var percentage>([\d.]+)<\/var>% uptime[\s\S]*?<svg width="100%" height="16" viewBox="0 0 668 16"[^>]*>([\s\S]*?)<\/svg>/g;
  const historyByService = {};

  for (const match of html.matchAll(sectionRe)) {
    const rawName = match[1];
    const service = OPENAI_HISTORY_LABEL_TO_SERVICE[rawName];
    if (!service) continue;

    const statuses = [...match[3].matchAll(/pill([A-Za-z]+)/g)].map(
      (item) => OPENAI_PILL_TO_STATUS[item[1]] || "g",
    );

    const normalized =
      targetDays && statuses.length > targetDays
        ? statuses.slice(-targetDays)
        : statuses;

    historyByService[service] = {
      uptime: Number(match[2]),
      statuses: normalized.join(""),
      rawLength: statuses.length,
    };
  }

  return historyByService;
}

export function parseOpenAIFeed(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = match[1];
    const title = stripCdata(
      (body.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "",
    );
    const updated = (body.match(/<updated>([^<]+)<\/updated>/) || [])[1];
    const content = stripCdata(
      (body.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || "",
    );
    const components = [
      ...content.matchAll(/<li>([^<(]+)\s*\([^)]*\)<\/li>/g),
    ].map((item) => item[1].trim());
    if (!title || !updated) continue;
    entries.push({ title, updated, date: dateKeyFromIso(updated), components });
  }
  return entries;
}

/** @param {any} [showcase] */
export function extractGitHubHistory(html, showcase = null) {
  let uptimeData;
  let uptimeHtml = html;

  if (showcase) {
    uptimeData = showcase.timelines || {};
    uptimeHtml += `\n${Object.values(showcase.components || {}).join("\n")}`;
  } else {
    const raw = extractJsonObjectAfter(html, "window.uptimeData = ");
    uptimeData = JSON.parse(raw);
  }

  if (Object.keys(uptimeData).length === 0) {
    throw new Error("GitHub uptime history is empty");
  }

  const dates = Object.values(uptimeData)[0].days.map((day) =>
    dateKeyFromIso(day.date),
  );
  const historyBySource = {};

  for (const value of Object.values(uptimeData)) {
    const code = value.component.code;
    const uptimeMatch = uptimeHtml.match(
      new RegExp(
        `id="uptime-percent-${escapeRegExp(code)}"[\\s\\S]*?<var data-var="uptime-percent">([\\d.]+)</var>`,
      ),
    );
    historyBySource[value.component.name] = {
      id: code,
      uptime: uptimeMatch ? Number(uptimeMatch[1]) : null,
      days: value.days.map((day) => ({
        date: dateKeyFromIso(day.date),
        status: day.outages.m
          ? "r"
          : day.outages.p
            ? "o"
            : day.related_events?.length
              ? "y"
              : "g",
        partialMinutes: Math.round((day.outages.p || 0) / 60),
        majorMinutes: Math.round((day.outages.m || 0) / 60),
        relatedEvents: (day.related_events || []).map((event) => event.name),
      })),
    };
  }

  return { dates, historyBySource };
}

export function openAIFeedGroups(entry) {
  return inferOpenAIIncidentGroups({
    name: entry.title,
    components: (entry.components || []).map((name) => ({ name })),
  });
}
