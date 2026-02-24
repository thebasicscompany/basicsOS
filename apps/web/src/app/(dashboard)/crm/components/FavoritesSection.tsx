"use client";

import type { FC } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  SectionLabel,
  Star,
  Users,
  Building2,
  Briefcase,
  EmptyState,
} from "@basicsos/ui";

type FavoriteEntity = "contact" | "company" | "deal";

const ENTITY_LABELS: Record<FavoriteEntity, string> = {
  contact: "Contacts",
  company: "Companies",
  deal: "Deals",
};

const ENTITY_HREF: Record<FavoriteEntity, (id: string) => string> = {
  contact: (id) => `/crm/${id}`,
  company: (id) => `/crm/companies/${id}`,
  deal: (id) => `/crm/deals/${id}`,
};

type IconComponent = FC<{ size?: number; className?: string }>;
const ENTITY_ICON: Record<FavoriteEntity, IconComponent> = {
  contact: Users as unknown as IconComponent,
  company: Building2 as unknown as IconComponent,
  deal: Briefcase as unknown as IconComponent,
};

const MAX_PER_ENTITY = 5;
const ENTITY_ORDER: FavoriteEntity[] = ["contact", "company", "deal"];

interface FavoriteItem {
  id: string;
  entity: string;
  recordId: string;
  createdAt: Date | string;
}

const groupByEntity = (
  favorites: FavoriteItem[],
): Map<FavoriteEntity, FavoriteItem[]> => {
  const grouped = new Map<FavoriteEntity, FavoriteItem[]>();
  for (const fav of favorites) {
    const entity = fav.entity as FavoriteEntity;
    if (!ENTITY_ORDER.includes(entity)) continue;
    const existing = grouped.get(entity) ?? [];
    grouped.set(entity, [...existing, fav]);
  }
  return grouped;
};

export const FavoritesSection = (): JSX.Element => {
  const { data: favorites, isLoading } = trpc.crm.favorites.list.useQuery();

  if (isLoading) return <div />;

  const list = favorites ?? [];

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Star size={14} className="text-amber-500 fill-amber-500" />
            Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            Icon={Star}
            heading="No favorites yet"
            description="Star contacts, companies, or deals to pin them here."
          />
        </CardContent>
      </Card>
    );
  }

  const grouped = groupByEntity(list);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Star size={14} className="text-amber-500 fill-amber-500" />
          Favorites
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          {ENTITY_ORDER.map((entity) => {
            const items = grouped.get(entity);
            if (!items || items.length === 0) return null;
            const Icon = ENTITY_ICON[entity];
            const limited = items.slice(0, MAX_PER_ENTITY);
            return (
              <div key={entity} className="min-w-[160px] flex-1">
                <SectionLabel className="mb-2">{ENTITY_LABELS[entity]}</SectionLabel>
                <ul className="flex flex-col gap-1">
                  {limited.map((fav) => (
                    <li key={fav.id}>
                      <Link
                        href={ENTITY_HREF[entity](fav.recordId)}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100"
                      >
                        <Icon size={13} className="shrink-0 text-stone-400" />
                        <span className="truncate font-mono text-xs text-stone-500 dark:text-stone-400">
                          {fav.recordId.slice(0, 8)}…
                        </span>
                      </Link>
                    </li>
                  ))}
                  {items.length > MAX_PER_ENTITY && (
                    <li className="px-2 py-1 text-xs text-stone-400 dark:text-stone-500">
                      +{items.length - MAX_PER_ENTITY} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
