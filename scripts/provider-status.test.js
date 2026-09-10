import test from "node:test";
import assert from "node:assert/strict";

import {
  extractClaudeHistory,
  extractUptimeComponentCodes,
} from "./provider-status.js";

const timeline = {
  component: { code: "abc123", name: "Claude API" },
  days: [
    {
      date: "2026-09-10",
      outages: { p: 120 },
      related_events: [{ name: "Elevated errors" }],
    },
  ],
};

test("extracts lazy uptime component codes without duplicates", () => {
  const html = [
    '<div data-uptime-lazy="abc123"></div>',
    '<div data-uptime-lazy="def456"></div>',
    '<div data-uptime-lazy="abc123"></div>',
  ].join("\n");

  assert.deepEqual(extractUptimeComponentCodes(html), ["abc123", "def456"]);
});

test("extracts history from a lazy uptime showcase response", () => {
  const html = [
    "window.uptimeData = window.uptimeData || {};",
    '<div data-uptime-lazy="abc123"></div>',
  ].join("\n");
  const showcase = {
    timelines: { abc123: timeline },
    components: {
      abc123:
        '<span id="uptime-percent-abc123"><var data-var="uptime-percent">99.5</var></span>',
    },
  };

  assert.deepEqual(extractClaudeHistory(html, showcase), {
    dates: ["09-10"],
    historyBySource: {
      "Claude API": {
        uptime: 99.5,
        days: [
          {
            date: "09-10",
            status: "o",
            partialMinutes: 2,
            majorMinutes: 0,
            relatedEvents: ["Elevated errors"],
          },
        ],
      },
    },
  });
});

test("keeps compatibility with inline uptime data", () => {
  const html = [
    `window.uptimeData = ${JSON.stringify({ abc123: timeline })};`,
    '<span id="uptime-percent-abc123"><var data-var="uptime-percent">99.5</var></span>',
  ].join("\n");

  assert.equal(
    extractClaudeHistory(html).historyBySource["Claude API"].uptime,
    99.5,
  );
});
