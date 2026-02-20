"use client";

import { trpc } from "@/lib/trpc";
import { Card, Button, Plus, SectionLabel } from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";

const MODULES = [
  { title: "Knowledge Base", desc: "Documents, wikis, and team knowledge", href: "/knowledge" },
  { title: "CRM", desc: "Contacts, companies, and deals", href: "/crm" },
  { title: "Tasks", desc: "Track work across the team", href: "/tasks" },
  { title: "Meetings", desc: "Transcripts, summaries, action items", href: "/meetings" },
  { title: "Hub", desc: "Links, integrations, and tools", href: "/hub" },
  { title: "AI Assistant", desc: "Ask questions about company data", href: "/assistant" },
] as const;

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Next.js App Router requires default export — framework exception.
const DashboardPage = (): JSX.Element => {
  const { user } = useAuth();
  const { data: taskStats } = trpc.tasks.list.useQuery({});
  const { data: meetingList } = trpc.meetings.list.useQuery({ limit: 5 });
  const { data: contactList } = trpc.crm.contacts.list.useQuery({});
  const { data: docList } = trpc.knowledge.list.useQuery({ parentId: null });

  const taskCount = taskStats?.length ?? 0;
  const meetingCount = meetingList?.length ?? 0;
  const contactCount = contactList?.length ?? 0;
  const docCount = docList?.length ?? 0;

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold font-serif tracking-tight text-stone-900">{getGreeting()}, {firstName}</h1>
        <p className="mt-2 text-stone-500">Your Company Operating System</p>
      </div>

      {/* Info widgets — number + label, no decorative icons */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Tasks", count: taskCount },
          { label: "Meetings", count: meetingCount },
          { label: "Contacts", count: contactCount },
          { label: "Documents", count: docCount },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-2xl font-semibold text-stone-900">{stat.count}</p>
            <p className="mt-1 text-xs text-stone-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <SectionLabel as="h2" className="mb-3">
          Quick Actions
        </SectionLabel>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/tasks"><Plus size={14} className="mr-1" /> New Task</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/meetings"><Plus size={14} className="mr-1" /> New Meeting</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/crm"><Plus size={14} className="mr-1" /> New Contact</a>
          </Button>
        </div>
      </div>

      {/* Module grid — text-only cards, no decorative icons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
          <a key={module.title} href={module.href} className="block">
            <Card className="p-5 transition-colors hover:bg-stone-50">
              <h3 className="text-sm font-semibold text-stone-900">{module.title}</h3>
              <p className="mt-1 text-xs text-stone-500 line-clamp-2">{module.desc}</p>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
