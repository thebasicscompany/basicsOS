export type VoiceCommand =
  | { type: "create_task"; title: string }
  | { type: "search"; query: string }
  | { type: "navigate"; module: string; url: string }
  | null;

export const MODULE_ROUTES: Record<string, string> = {
  tasks: "/tasks",
  task: "/tasks",
  crm: "/crm",
  contacts: "/crm",
  meetings: "/meetings",
  meeting: "/meetings",
  knowledge: "/knowledge",
  hub: "/hub",
  assistant: "/assistant",
  ai: "/assistant",
  settings: "/settings",
  admin: "/admin",
};

export const detectCommand = (text: string): VoiceCommand => {
  const lower = text.trim().toLowerCase();

  const taskMatch =
    lower.match(/^(?:create|add|new) (?:a )?task[: ]+(.*)/i) ??
    lower.match(/^(?:remind me to|todo)[: ]+(.*)/i);
  if (taskMatch?.[1]) return { type: "create_task", title: taskMatch[1].trim() };

  const searchMatch = lower.match(/^(?:search|find|look up|look for)[: ]+(.*)/i);
  if (searchMatch?.[1]) return { type: "search", query: searchMatch[1].trim() };

  const openMatch = lower.match(/^(?:open|go to|show)[: ]+(\w+)/i);
  if (openMatch?.[1]) {
    const mod = openMatch[1].toLowerCase();
    const url = MODULE_ROUTES[mod];
    if (url) return { type: "navigate", module: mod, url };
  }

  return null;
};
