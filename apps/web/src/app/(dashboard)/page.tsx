"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, Button, Plus, CheckSquare, Video, Users, BookOpen, Link2, Sparkles } from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";

const MODULES = [
  { title: "Knowledge Base", desc: "Documents, wikis, and team knowledge", href: "/knowledge", Icon: BookOpen, color: "bg-emerald-50 text-emerald-600" },
  { title: "CRM", desc: "Contacts, companies, and deals", href: "/crm", Icon: Users, color: "bg-blue-50 text-blue-600" },
  { title: "Tasks", desc: "Track work across the team", href: "/tasks", Icon: CheckSquare, color: "bg-violet-50 text-violet-600" },
  { title: "Meetings", desc: "Transcripts, summaries, action items", href: "/meetings", Icon: Video, color: "bg-amber-50 text-amber-600" },
  { title: "Hub", desc: "Links, integrations, and tools", href: "/hub", Icon: Link2, color: "bg-rose-50 text-rose-600" },
  { title: "AI Assistant", desc: "Ask questions about company data", href: "/assistant", Icon: Sparkles, color: "bg-primary/8 text-primary" },
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
        <h1 className="text-3xl font-bold text-stone-900">{getGreeting()}, {firstName}</h1>
        <p className="mt-2 text-stone-500">Your Company Operating System</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Tasks", count: taskCount, Icon: CheckSquare, color: "bg-violet-50 text-violet-600" },
          { label: "Meetings", count: meetingCount, Icon: Video, color: "bg-amber-50 text-amber-600" },
          { label: "Contacts", count: contactCount, Icon: Users, color: "bg-blue-50 text-blue-600" },
          { label: "Documents", count: docCount, Icon: BookOpen, color: "bg-emerald-50 text-emerald-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                <stat.Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900">{stat.count}</p>
                <p className="text-xs text-stone-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
          Quick Actions
        </h2>
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

      {/* Module grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
          <a
            key={module.title}
            href={module.href}
            className="group block rounded-xl border border-stone-200 bg-white p-6 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${module.color}`}>
              <module.Icon size={20} />
            </div>
            <h3 className="text-lg font-semibold text-stone-900">{module.title}</h3>
            <p className="mt-1 text-sm text-stone-500">{module.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
