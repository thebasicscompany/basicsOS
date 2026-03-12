import { ROUTES } from "@basics-os/hub";

export type HelpAction = {
  label: string;
  description: string;
  path: string;
};

export type OnboardingChecklistItem = {
  id: string;
  title: string;
  description: string;
  action: HelpAction;
};

export type HelpTab = {
  id: string;
  label: string;
  title: string;
  description: string;
  sections: Array<{
    title: string;
    body: string;
    bullets: string[];
    actions?: HelpAction[];
  }>;
};

export type HelpShortcut = {
  label: string;
  keys: string[];
  description: string;
};

type HelpOptions = {
  isAdmin: boolean;
  hasApiKey: boolean;
};

const contactsRoute = "/objects/contacts";
const companiesRoute = "/objects/companies";
const dealsRoute = "/objects/deals";

export function getOnboardingChecklistItems({
  isAdmin,
  hasApiKey,
}: HelpOptions): OnboardingChecklistItem[] {
  return [
    {
      id: "try-voice",
      title: "Try voice assistance",
      description: hasApiKey
        ? "Open Voice and send your first spoken prompt so you can feel how the assistant fits into the workspace."
        : "Open Voice and explore the assistant entry point. If sending messages is unavailable, you may still need API access configured.",
      action: {
        label: "Open Voice",
        description: "Try the voice assistant.",
        path: ROUTES.VOICE,
      },
    },
    {
      id: "import-data",
      title: "Import your data",
      description:
        "Bring in a CSV so the app is immediately useful instead of starting from a blank CRM.",
      action: {
        label: "Open Import",
        description: "Upload contacts, companies, or other records.",
        path: ROUTES.IMPORT,
      },
    },
    {
      id: "add-company",
      title: "Add your first company",
      description:
        "Create or review a company record so you can see how the CRM is structured around real work.",
      action: {
        label: "Open Companies",
        description: "Add or review companies.",
        path: companiesRoute,
      },
    },
    {
      id: "add-contact",
      title: "Add your first contact",
      description:
        "Add a person record so you can connect contacts, notes, tasks, and deals in one place.",
      action: {
        label: "Open Contacts",
        description: "Add or review contacts.",
        path: contactsRoute,
      },
    },
    isAdmin
      ? {
          id: "admin-setup",
          title: "Finish workspace setup",
          description:
            "As an admin, review shared settings like organization info, AI/API access, and invites so your team has what it needs.",
          action: {
            label: "Open Settings",
            description: "Review org setup, AI config, and invites.",
            path: ROUTES.SETTINGS,
          },
        }
      : {
          id: "member-setup",
          title: "Review your setup",
          description: hasApiKey
            ? "Check your personal settings and profile so you know where preferences and account details live."
            : "Check your profile and settings, and ask an admin if AI access, organization settings, or invites still need to be configured.",
          action: {
            label: "Open Profile",
            description: "Review your personal account setup.",
            path: ROUTES.PROFILE,
          },
        },
  ];
}

export function getHelpTabs({ isAdmin, hasApiKey }: HelpOptions): HelpTab[] {
  return [
    {
      id: "start-here",
      label: "Start here",
      title: "How BasicsOS fits together",
      description:
        "Use this for the fastest mental model of the product before you dive into a specific area.",
      sections: [
        {
          title: "Apps vs records",
          body: "Apps are work areas like Chat, Tasks, Meetings, and Automations. Records are the CRM entities you manage inside the workspace.",
          bullets: [
            "Home is your launchpad for recent work and quick assistant prompts.",
            "Records like contacts, companies, and deals live under the Records section in the sidebar.",
            "If you want a lighter first-run experience, use the checklist on Home and open Help only when you want more context.",
          ],
          actions: [
            {
              label: "Open Home",
              description: "Return to your main starting point.",
              path: ROUTES.CRM,
            },
          ],
        },
        {
          title: "What to do first",
          body: "The best first session is usually simple: get data in, try the assistant, then create a few real records so the app starts feeling like your workspace.",
          bullets: [
            "Import data or manually create your first company and contact.",
            "Try Voice or Chat so you know how the assistant fits into the workflow.",
            isAdmin
              ? "If you are an admin, review shared settings and invites when you are ready."
              : "If shared settings or AI access are missing, your admin likely still needs to configure them.",
          ],
          actions: [
            {
              label: "Open Import",
              description: "Bring in data from a CSV.",
              path: ROUTES.IMPORT,
            },
            {
              label: "Open Companies",
              description: "Start creating CRM records manually.",
              path: companiesRoute,
            },
          ],
        },
      ],
    },
    {
      id: "navigation",
      label: "Navigation",
      title: "Move around the app quickly",
      description:
        "BasicsOS is built so you can navigate by habit instead of hunting through menus.",
      sections: [
        {
          title: "Sidebar structure",
          body: "The sidebar is split into apps, recent chats, records, and automations so your workspace stays predictable.",
          bullets: [
            "Apps sit at the top for daily navigation.",
            "Recent chats keep assistant work one click away.",
            "Records collects your CRM objects and custom objects.",
          ],
        },
        {
          title: "Command palette",
          body: "Use the command palette when typing is faster than clicking.",
          bullets: [
            "Search for pages and jump there directly.",
            "Look up contacts, companies, and deals from one place.",
            "Use it as a recovery tool whenever you are not sure where something lives.",
          ],
          actions: [
            {
              label: "Open Contacts",
              description: "See a core record list.",
              path: contactsRoute,
            },
            {
              label: "Open Companies",
              description: "Review another core object.",
              path: companiesRoute,
            },
          ],
        },
      ],
    },
    {
      id: "assistant",
      label: "Assistant",
      title: "AI and voice workflows",
      description:
        "The assistant is part of the product, not a separate tool you have to mentally switch into.",
      sections: [
        {
          title: "Where to start",
          body: "You can kick off a conversation from Home, use the full Chat page, or open Voice for spoken interaction.",
          bullets: [
            "Home is best for quick prompts and getting unstuck.",
            "Chat is better for deeper, longer-running conversations.",
            hasApiKey
              ? "Your workspace already has AI access, so you can start experimenting immediately."
              : "If AI features are unavailable, check Settings or ask your admin whether shared access still needs to be configured.",
          ],
          actions: [
            {
              label: "Open Chat",
              description: "Start a dedicated conversation.",
              path: ROUTES.CHAT,
            },
            {
              label: "Open Voice",
              description: "Try the voice assistant entry point.",
              path: ROUTES.VOICE,
            },
          ],
        },
        {
          title: "When the assistant helps most",
          body: "The assistant is strongest when it helps you move work forward instead of becoming a separate destination.",
          bullets: [
            "Use it to research, summarize, draft, and organize CRM work faster.",
            "Keep related records and tasks nearby so AI output turns into action.",
            "Use recent threads in the sidebar so context is not lost between sessions.",
          ],
        },
      ],
    },
    {
      id: "daily-work",
      label: "Daily work",
      title: "Run work from the CRM instead of around it",
      description:
        "The product is designed to keep follow-up, notes, meetings, and record updates tied together.",
      sections: [
        {
          title: "Core CRM workflow",
          body: "Contacts, companies, and deals are the center of most day-to-day work.",
          bullets: [
            "Track who you are talking to in Contacts.",
            "Keep account context in Companies.",
            "Use Deals when you need pipeline visibility.",
          ],
          actions: [
            {
              label: "Open Contacts",
              description: "Review people and their details.",
              path: contactsRoute,
            },
            {
              label: "Open Deals",
              description: "Inspect the pipeline workflow.",
              path: dealsRoute,
            },
          ],
        },
        {
          title: "Operational follow-through",
          body: "Tasks, Notes, Meetings, and Automations make the CRM operational instead of static.",
          bullets: [
            "Tasks keep follow-up work actionable.",
            "Notes preserve context directly in the workspace.",
            "Meetings centralize recordings and summaries.",
            "Automations help scale repeated processes later.",
          ],
          actions: [
            {
              label: "Open Tasks",
              description: "See active follow-up work.",
              path: ROUTES.TASKS,
            },
            {
              label: "Open Meetings",
              description: "Review meeting context.",
              path: ROUTES.MEETINGS,
            },
          ],
        },
      ],
    },
    {
      id: "setup",
      label: "Setup",
      title: "Settings and workspace readiness",
      description:
        "This is where the admin-only lines matter. Not every user should be responsible for organization setup, API access, or invites.",
      sections: [
        {
          title: isAdmin ? "Admin responsibilities" : "What you can change yourself",
          body: isAdmin
            ? "Admins control shared workspace setup like organization details, AI access, and member invites."
            : "Non-admin users should focus on their own profile and preferences, while shared setup stays with admins.",
          bullets: isAdmin
            ? [
                "Review organization settings and branding.",
                "Configure AI/API access for the workspace if needed.",
                "Invite teammates and manage member access when the team is ready.",
              ]
            : [
                "Review your profile and personal preferences.",
                "Use Settings to understand what is available to you.",
                "Ask an admin for organization changes, shared AI setup, or member invites.",
              ],
          actions: isAdmin
            ? [
                {
                  label: "Open Settings",
                  description: "Manage workspace setup.",
                  path: ROUTES.SETTINGS,
                },
              ]
            : [
                {
                  label: "Open Profile",
                  description: "Review your personal account setup.",
                  path: ROUTES.PROFILE,
                },
                {
                  label: "Open Settings",
                  description: "See your available settings.",
                  path: ROUTES.SETTINGS,
                },
              ],
        },
        {
          title: "Bringing data in",
          body: "The product gets useful fast once there is real data inside it.",
          bullets: [
            "Use Import when you want to seed contacts, companies, or other CRM records from CSV.",
            "You can always start manually by creating a few records first.",
            "The Home checklist is the lightest way to get started without a guided tour.",
          ],
          actions: [
            {
              label: "Open Import",
              description: "Upload records from CSV.",
              path: ROUTES.IMPORT,
            },
          ],
        },
      ],
    },
  ];
}

export const HELP_SHORTCUTS: HelpShortcut[] = [
  {
    label: "Command palette",
    keys: ["Ctrl", "K"],
    description: "Search pages, records, and actions from anywhere.",
  },
  {
    label: "Voice assistant",
    keys: ["Cmd", "Space"],
    description:
      "In Electron, trigger the assistant overlay with the main voice shortcut.",
  },
  {
    label: "Dictation mode",
    keys: ["Cmd", "Shift", "Space"],
    description: "In Electron, toggle dictation when you want text injected.",
  },
];
