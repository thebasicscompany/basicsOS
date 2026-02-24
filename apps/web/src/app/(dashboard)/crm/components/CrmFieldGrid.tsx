"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@basicsos/ui";

interface CrmField {
  icon: React.ElementType;
  label: string;
  value: string | React.ReactNode;
  href?: string;
}

interface CrmFieldGridProps {
  title?: string;
  fields: CrmField[];
}

export function CrmFieldGrid({ title, fields }: CrmFieldGridProps): JSX.Element {
  const visibleFields = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");

  return (
    <Card>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "" : "py-5"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleFields.map((field) => (
            <FieldRow key={field.label} field={field} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldRow({ field }: { field: CrmField }): JSX.Element {
  const Icon = field.icon;

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-stone-100 dark:bg-stone-700">
        <Icon className="size-3.5 text-stone-500 dark:text-stone-400" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
          {field.label}
        </span>
        {field.href ? (
          <Link href={field.href} className="block text-sm text-primary hover:underline truncate">
            {field.value}
          </Link>
        ) : (
          <p className="text-sm text-stone-900 dark:text-stone-100 truncate">
            {typeof field.value === "string" ? field.value : field.value}
          </p>
        )}
      </div>
    </div>
  );
}
