"use client";

import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./Tooltip.js";
import { Avatar, AvatarFallback } from "./Avatar.js";

export interface IconRailItem {
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
  /** Active icon color class, e.g. "text-amber-600" */
  accentColor?: string;
  /** Active background class, e.g. "bg-amber-50" */
  accentBg?: string;
}

interface IconRailProps extends HTMLAttributes<HTMLDivElement> {
  items: IconRailItem[];
  activeId?: string | undefined;
  /** Brand mark slot (top) */
  header?: ReactNode;
  /** Footer slot (below avatar) */
  footer?: ReactNode;
  /** User initials for the avatar */
  userInitials?: string | undefined;
  /** Content for avatar dropdown — rendered as children of the avatar button's click handler */
  onAvatarClick?: (() => void) | undefined;
  /** Called when a nav item is clicked */
  onNavigate?: ((href: string) => void) | undefined;
}

const RailButton = forwardRef<
  HTMLButtonElement,
  HTMLAttributes<HTMLButtonElement> & { active?: boolean; accentColor?: string | undefined; accentBg?: string | undefined }
>(({ active, accentColor, accentBg, className, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
      active
        ? cn(accentBg ?? "bg-primary/15", accentColor ?? "text-primary")
        : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200",
      className,
    )}
    {...props}
  >
    {active && (
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full",
          accentColor ? accentColor.replace("text-", "bg-") : "bg-primary",
        )}
      />
    )}
    {children}
  </button>
));
RailButton.displayName = "RailButton";

export const IconRail = forwardRef<HTMLDivElement, IconRailProps>(
  (
    {
      items,
      activeId,
      header,
      footer,
      userInitials = "A",
      onAvatarClick,
      onNavigate,
      className,
      ...props
    },
    ref,
  ) => (
    <TooltipProvider delayDuration={200}>
      <div
        ref={ref}
        className={cn(
          "flex h-full w-14 flex-col items-center pt-8 pb-3",
          className,
        )}
        {...props}
      >
        {/* Brand mark */}
        {header && <div className="mb-3">{header}</div>}

        {/* Module icons */}
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5">
          {items.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <RailButton
                  active={activeId === item.id}
                  accentColor={item.accentColor}
                  accentBg={item.accentBg}
                  onClick={() => onNavigate?.(item.href)}
                  aria-label={item.label}
                >
                  <item.Icon size={20} />
                </RailButton>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-1 border-t border-stone-200 dark:border-stone-800 pt-2 px-1.5">
          {/* User avatar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAvatarClick}
                className="mt-1 flex items-center justify-center"
                aria-label="Account"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Account
            </TooltipContent>
          </Tooltip>

          {footer}
        </div>
      </div>
    </TooltipProvider>
  ),
);
IconRail.displayName = "IconRail";
