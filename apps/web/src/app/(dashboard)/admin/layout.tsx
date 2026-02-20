// Next.js App Router requires default exports for layout/page segments.
// This is a framework-mandated exception to the project's named-export rule.
const AdminLayout = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div>
    <header className="mb-6 border-b border-stone-200 pb-4">
      <h2 className="text-2xl font-bold text-stone-900">Admin Panel</h2>
      <nav className="mt-3 flex gap-4 text-sm">
        <a href="/admin/team" className="text-primary hover:underline">
          Team
        </a>
        <a href="/admin/billing" className="text-primary hover:underline">
          Billing
        </a>
        <a href="/admin/api-keys" className="text-primary hover:underline">
          API Keys
        </a>
      </nav>
    </header>
    <div>{children}</div>
  </div>
);

export default AdminLayout;
