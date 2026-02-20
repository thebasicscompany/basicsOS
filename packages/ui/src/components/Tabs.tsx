"use client";

import { createContext, forwardRef, useContext } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/utils.js";

type TabsVariant = "pill" | "underline";

const TabsVariantContext = createContext<TabsVariant>("pill");

const Tabs = TabsPrimitive.Root;

interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant;
}

const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "pill", ...props }, ref) => (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          variant === "pill" &&
            "inline-flex h-9 items-center justify-center rounded-lg bg-stone-100 p-1 text-stone-500",
          variant === "underline" &&
            "inline-flex items-center border-b border-stone-100 bg-transparent gap-0 text-stone-500",
          className,
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  ),
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        variant === "pill" &&
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-card",
        variant === "underline" &&
          "inline-flex items-center justify-center whitespace-nowrap px-3 pb-2.5 pt-2 text-sm font-medium transition-colors border-b-2 border-transparent rounded-none bg-transparent shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-primary hover:text-stone-700",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
