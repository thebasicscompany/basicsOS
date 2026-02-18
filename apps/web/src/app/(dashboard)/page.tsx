// Next.js App Router requires default export — framework exception.
const DashboardPage = (): JSX.Element => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900">Welcome to Basics OS</h1>
      <p className="mt-2 text-gray-500">Acme Corp — Company Operating System</p>
    </div>
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { title: "Knowledge Base", desc: "Documents, wikis, and team knowledge", href: "/knowledge", icon: "📚", color: "bg-purple-50 border-purple-200" },
        { title: "CRM", desc: "Contacts, companies, and deals", href: "/crm", icon: "🤝", color: "bg-blue-50 border-blue-200" },
        { title: "Tasks", desc: "Track work across the team", href: "/tasks", icon: "✅", color: "bg-green-50 border-green-200" },
        { title: "Meetings", desc: "Transcripts, summaries, action items", href: "/meetings", icon: "🎯", color: "bg-orange-50 border-orange-200" },
        { title: "Hub", desc: "Links, integrations, and tools", href: "/hub", icon: "🔗", color: "bg-pink-50 border-pink-200" },
        { title: "AI Assistant", desc: "Ask questions about company data", href: "#", icon: "🤖", color: "bg-indigo-50 border-indigo-200" },
      ].map((module) => (
        <a
          key={module.title}
          href={module.href}
          className={`block rounded-xl border p-6 transition hover:shadow-md ${module.color}`}
        >
          <div className="text-3xl mb-3">{module.icon}</div>
          <h3 className="text-lg font-semibold text-gray-900">{module.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{module.desc}</p>
        </a>
      ))}
    </div>
  </div>
);

export default DashboardPage;
