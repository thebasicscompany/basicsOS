import type { ComponentType, SVGProps } from "react";
import { cn } from "../lib/utils.js";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface SidebarItem {
  label: string;
  href: string;
  icon?: string;
  Icon?: LucideIcon;
  section?: string;
}

interface SidebarProps {
  items: SidebarItem[];
  activeHref?: string;
  /** Override the root <nav> classes. Merged with defaults via cn(). */
  className?: string;
  /** Override the width. Defaults to `w-60`. */
  width?: string;
  /** Slot rendered above the nav items (e.g. logo, branding). */
  header?: React.ReactNode;
  /** Slot rendered below the nav items (e.g. user widget, sign-out). */
  footer?: React.ReactNode;
}

// Uses <a> (not next/link) for portability across Next.js and non-Next environments.
export const Sidebar = ({
  items,
  activeHref,
  className,
  width = "w-60",
  header,
  footer,
}: SidebarProps): JSX.Element => {
  // Group items by section
  const sections: { label: string | undefined; items: SidebarItem[] }[] = [];
  let currentSection: string | undefined;
  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      sections.push({ label: currentSection, items: [] });
    }
    sections[sections.length - 1]?.items.push(item);
  }

  return (
    <nav
      className={cn(
        "flex flex-col",
        width,
        className,
      )}
    >
      {header && <div className="px-3 py-3">{header}</div>}

      <ul className="flex flex-col gap-0.5 flex-1 overflow-y-auto px-2 py-2">
        {sections.map((section, si) => (
          <li key={si}>
            {section.label && (
              <div className="px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400">
                {section.label}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = activeHref === item.href;
                const IconComp = item.Icon;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-sm px-3 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary/8 text-primary font-medium"
                          : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100",
                      )}
                    >
                      {IconComp ? (
                        <IconComp size={18} className="shrink-0" />
                      ) : item.icon !== undefined && item.icon !== "" ? (
                        <span className="text-base">{item.icon}</span>
                      ) : null}
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {footer && <div className="px-3 py-3">{footer}</div>}
    </nav>
  );
};
