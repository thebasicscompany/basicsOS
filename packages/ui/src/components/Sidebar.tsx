import type { Icon } from "@phosphor-icons/react";

interface SidebarItem {
  label: string;
  href: string;
  icon?: Icon;
}

interface SidebarProps {
  items: SidebarItem[];
}

export const Sidebar = ({ items }: SidebarProps): JSX.Element => (
  <nav className="flex h-full w-64 flex-col bg-gray-900 px-4 py-6">
    <div className="mb-8">
      <h1 className="text-xl font-bold text-white">Basics OS</h1>
    </div>
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.href}>
          <a
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            {item.icon !== undefined && <item.icon size={20} />}
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);
