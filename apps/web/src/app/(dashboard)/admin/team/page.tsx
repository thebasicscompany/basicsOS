// Next.js App Router requires default exports for page segments.
// This is a framework-mandated exception to the project's named-export rule.
const TeamPage = (): JSX.Element => (
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
    <p className="mt-2 text-sm text-gray-500">
      Manage team members, roles, and invitations.
    </p>
  </div>
);

export default TeamPage;
