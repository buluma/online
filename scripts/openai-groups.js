export const OPENAI_COMPONENT_GROUPS = {
  'OpenAI APIs': [
    'Fine-tuning', 'Embeddings', 'Images', 'Batch', 'Audio', 'Moderations',
    'Compliance API', 'Codex API', 'Responses', 'Chat Completions', 'Realtime',
    'Audit Logs', 'Ads API',
  ],
  'ChatGPT': [
    'Login', 'Conversations', 'Voice mode', 'GPTs', 'Image Generation',
    'Deep Research', 'Agent', 'Connectors/Apps', 'App', 'Apps', 'ChatGPT Atlas',
    'Search', 'File uploads', 'Files', 'Shopping Research', 'Feed',
  ],
  'Codex': ['Codex Web', 'CLI', 'VS Code extension'],
  'Sora': ['Sora', 'Video viewing', 'Video generation'],
  'FedRAMP': [],
};

export const OPENAI_SERVICES = ['OpenAI APIs', 'ChatGPT', 'Codex', 'Sora', 'FedRAMP'];
export const TRACKED_OPENAI_COMPONENT_NAMES = Object.values(OPENAI_COMPONENT_GROUPS).flat();

const OPENAI_TITLE_GROUP_RULES = [
  { group: 'OpenAI APIs', pattern: /\b(api|endpoint|embeddings?|fine[- ]tuning|batch|audio|moderations?|compliance|completions?)\b|\/v\d\/responses\b|responses api|images api/i },
  { group: 'ChatGPT', pattern: /\b(chatgpt|conversations?|gpts|voice|deep research|agent|connectors?|apps|atlas|dictation|workspace|sso|login|web)\b/i },
  { group: 'Codex', pattern: /\b(codex|cli|vs code|vscode|extension)\b/i },
  { group: 'Sora', pattern: /\b(sora|video viewing|video generation|video)\b/i },
  { group: 'FedRAMP', pattern: /\bfedramp\b/i },
];

export function openAIComponentGroups(name) {
  const groups = [];
  for (const [groupName, components] of Object.entries(OPENAI_COMPONENT_GROUPS)) {
    if (components.includes(name)) groups.push(groupName);
  }
  if (/fedramp/i.test(name || '')) groups.push('FedRAMP');
  return groups;
}

export function inferOpenAIIncidentGroups(incident) {
  const groups = new Set();

  for (const component of incident.components || []) {
    for (const groupName of openAIComponentGroups(component.name || '')) {
      groups.add(groupName);
    }
  }
  if (groups.size > 0) return groups;

  const text = [
    incident.name || '',
    ...(incident.components || []).map(component => component.name || ''),
  ].join(' ');

  for (const rule of OPENAI_TITLE_GROUP_RULES) {
    if (rule.pattern.test(text)) groups.add(rule.group);
  }

  return groups;
}

export function liveOpenAIGroupStatus(components, groupName, statusMap, priority) {
  const relevant = groupName === 'FedRAMP'
    ? (components || []).filter(component => /fedramp/i.test(component.name || ''))
    : (components || []).filter(component => OPENAI_COMPONENT_GROUPS[groupName]?.includes(component.name));

  let worst = 'g';
  for (const component of relevant) {
    const code = statusMap[component.status] || 'g';
    if ((priority[code] || 0) > (priority[worst] || 0)) worst = code;
  }
  return worst;
}
