"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Badge,
  Briefcase,
  Buildings,
  Input,
  CircleNotch,
  MagnifyingGlass,
  Users,
  cn,
} from "@basicsos/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContactResult = {
  id: string;
  name: string;
  email: string | null;
  type: "contact";
};

type CompanyResult = {
  id: string;
  name: string;
  domain: string | null;
  type: "company";
};

type DealResult = {
  id: string;
  title: string;
  stage: string;
  value: string | null;
  type: "deal";
};

type SearchResult = ContactResult | CompanyResult | DealResult;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  won: "default",
  lost: "destructive",
};

function useDebounce(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Result row sub-components
// ---------------------------------------------------------------------------

function ContactRow({ result }: { result: ContactResult }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-blue-50 dark:bg-blue-900/30">
        <Users className="size-3.5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {result.name}
        </p>
        {result.email && (
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">{result.email}</p>
        )}
      </div>
    </div>
  );
}

function CompanyRow({ result }: { result: CompanyResult }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-emerald-50 dark:bg-emerald-900/30">
        <Buildings className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {result.name}
        </p>
        {result.domain && (
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">{result.domain}</p>
        )}
      </div>
    </div>
  );
}

function DealRow({ result }: { result: DealResult }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-violet-50 dark:bg-violet-900/30">
        <Briefcase className="size-3.5 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {result.title}
        </p>
      </div>
      <Badge
        variant={STAGE_VARIANT[result.stage] ?? "secondary"}
        className="shrink-0 text-[10px] px-1.5 py-0 h-4 capitalize"
      >
        {result.stage}
      </Badge>
    </div>
  );
}

function ResultRow({ result }: { result: SearchResult }): JSX.Element {
  if (result.type === "contact") return <ContactRow result={result} />;
  if (result.type === "company") return <CompanyRow result={result} />;
  return <DealRow result={result} />;
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function SectionHeading({ label }: { label: string }): JSX.Element {
  return (
    <div className="px-3 pb-1 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CrmGlobalSearch(): JSX.Element {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 300);
  const enabled = debouncedQuery.length >= 2;

  const { data, isFetching } = trpc.crm.search.query.useQuery(
    { q: debouncedQuery, limit: 20 },
    { enabled },
  );

  const allResults: SearchResult[] = enabled
    ? [
        ...(data?.contacts ?? []),
        ...(data?.companies ?? []),
        ...(data?.deals ?? []),
      ]
    : [];

  const hasResults = allResults.length > 0;
  const hasNoResults =
    enabled && !isFetching && data !== undefined && !hasResults;

  const handleOpen = useCallback((): void => setIsOpen(true), []);

  const handleClose = useCallback((): void => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const navigateToResult = useCallback(
    (result: SearchResult): void => {
      handleClose();
      setQuery("");
      if (result.type === "contact") {
        router.push(`/crm/${result.id}`);
      } else if (result.type === "company") {
        router.push(`/crm/companies/${result.id}`);
      } else {
        router.push(`/crm/deals/${result.id}`);
      }
    },
    [handleClose, router],
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Escape") {
        handleClose();
        inputRef.current?.blur();
        return;
      }
      if (!isOpen || allResults.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % allResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? allResults.length - 1 : prev - 1));
      } else if (e.key === "Enter" && activeIndex >= 0) {
        const result = allResults[activeIndex];
        if (result) navigateToResult(result);
      }
    },
    [handleClose, isOpen, allResults, activeIndex, navigateToResult],
  );

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  const showDropdown = isOpen && query.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
        <Input
          ref={inputRef}
          placeholder="Search contacts, companies, deals..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) setIsOpen(true);
            else handleClose();
          }}
          onFocus={handleOpen}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-4 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
          aria-label="Search CRM"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={showDropdown ? "crm-search-results" : undefined}
          role="combobox"
        />
        {isFetching && (
          <CircleNotch className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-stone-400" />
        )}
      </div>

      {showDropdown && (
        <div
          id="crm-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-sm border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          {hasNoResults && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-stone-500 dark:text-stone-400">No results found</p>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                Try a different search term
              </p>
            </div>
          )}

          {hasResults && (
            <div className="max-h-80 overflow-y-auto py-1">
              {(data?.contacts ?? []).length > 0 && (
                <div>
                  <SectionHeading label="Contacts" />
                  {(data?.contacts ?? []).map((result) => {
                    const index = allResults.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        onClick={() => navigateToResult(result)}
                        className={cn(
                          "w-full px-3 py-2 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-800",
                          activeIndex === index && "bg-stone-100 dark:bg-stone-800",
                        )}
                      >
                        <ResultRow result={result} />
                      </button>
                    );
                  })}
                </div>
              )}

              {(data?.companies ?? []).length > 0 && (
                <div>
                  <SectionHeading label="Companies" />
                  {(data?.companies ?? []).map((result) => {
                    const index = allResults.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        onClick={() => navigateToResult(result)}
                        className={cn(
                          "w-full px-3 py-2 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-800",
                          activeIndex === index && "bg-stone-100 dark:bg-stone-800",
                        )}
                      >
                        <ResultRow result={result} />
                      </button>
                    );
                  })}
                </div>
              )}

              {(data?.deals ?? []).length > 0 && (
                <div>
                  <SectionHeading label="Deals" />
                  {(data?.deals ?? []).map((result) => {
                    const index = allResults.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        onClick={() => navigateToResult(result)}
                        className={cn(
                          "w-full px-3 py-2 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-800",
                          activeIndex === index && "bg-stone-100 dark:bg-stone-800",
                        )}
                      >
                        <ResultRow result={result} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
