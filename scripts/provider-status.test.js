import test from "node:test";
import assert from "node:assert/strict";

import {
  extractClaudeHistory,
  extractUptimeComponentCodes,
  openAIFeedGroups,
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

test("maps every known OpenAI feed component to its group", () => {
  const expected = {
    "OpenAI APIs": [
      "Responses", "Chat Completions", "Embeddings", "Fine-tuning", "Images",
      "Batch", "Audio", "Moderations", "Compliance API", "Realtime",
      "Audit Logs", "Ads API", "Ads Manager",
    ],
    ChatGPT: [
      "Login", "Conversations", "Voice mode", "GPTs", "Image Generation",
      "Deep Research", "Agent", "Connectors/Apps", "App", "Apps",
      "ChatGPT Atlas", "File uploads", "Files", "Search", "Shopping Research",
    ],
    Codex: [
      "Codex Web", "CLI", "VS Code extension", "Codex Cloud", "Codex Github",
      "Codex",
    ],
    Sora: ["Sora", "Video viewing", "Video generation", "Sora API"],
    FedRAMP: ["FedRAMP"],
  };

  for (const [group, components] of Object.entries(expected)) {
    for (const component of components) {
      const groups = openAIFeedGroups({ title: "", components: [component] });
      assert.ok(groups.has(group), `${component} should map to ${group}`);
    }
  }
});

test("does not attribute customer support delays to the API group", () => {
  for (const title of ["Delayed support responses", "Delays in customer support responses"]) {
    assert.equal(openAIFeedGroups({ title, components: [] }).size, 0, title);
  }
});

test("attributes title-only feed entries to the surface they name", () => {
  const cases = [
    ["Realtime API errors", "OpenAI APIs"],
    ["Audit logs delayed", "OpenAI APIs"],
    ["Elevated errors on Chat Completions", "OpenAI APIs"],
    ["Search not working in ChatGPT", "ChatGPT"],
    ["File uploads failing", "ChatGPT"],
    ["Shopping research unavailable", "ChatGPT"],
    ["Codex CLI errors", "Codex"],
    ["Sora video generation delays", "Sora"],
    ["FedRAMP environment unavailable", "FedRAMP"],
  ];

  for (const [title, group] of cases) {
    assert.ok(openAIFeedGroups({ title, components: [] }).has(group), `${title} -> ${group}`);
  }
});
