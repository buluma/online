import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inferOpenAIIncidentGroups,
  liveOpenAIGroupStatus,
  openAIComponentGroups,
} from './openai-groups.js';

const STATUS_MAP = {
  operational: 'g',
  degraded_performance: 'y',
  partial_outage: 'o',
  major_outage: 'r',
  under_maintenance: 'b',
};

const PRIORITY = { g: 0, b: 1, y: 2, o: 3, r: 4 };

test('maps title-only API incidents to the API group instead of all groups', () => {
  const groups = inferOpenAIIncidentGroups({
    name: 'GET /v1/responses endpoint is currently down and unable to serve requests',
    components: [],
  });

  assert.deepEqual([...groups].sort(), ['OpenAI APIs']);
});

test('maps title-only ChatGPT incidents to the ChatGPT group instead of all groups', () => {
  const groups = inferOpenAIIncidentGroups({
    name: 'Some users may experience empty response from ChatGPT in web',
    components: [],
  });

  assert.deepEqual([...groups].sort(), ['ChatGPT']);
});

test('keeps multi-surface title-only incidents scoped to matched groups', () => {
  const groups = inferOpenAIIncidentGroups({
    name: 'Responses API and Sora Increased Error Rates',
    components: [],
  });

  assert.deepEqual([...groups].sort(), ['OpenAI APIs', 'Sora']);
});

test('computes live grouped status from the current summary components', () => {
  const status = liveOpenAIGroupStatus([
    { name: 'Fine-tuning', status: 'operational' },
    { name: 'Embeddings', status: 'major_outage' },
    { name: 'Codex Web', status: 'operational' },
  ], 'OpenAI APIs', STATUS_MAP, PRIORITY);

  assert.equal(status, 'r');
});

test('maps current summary-only ChatGPT components into the ChatGPT group', () => {
  assert.deepEqual(openAIComponentGroups('Feed'), ['ChatGPT']);
});

test('maps current summary-only API components into the OpenAI APIs group', () => {
  assert.deepEqual(openAIComponentGroups('Ads API'), ['OpenAI APIs']);
});
