"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "@basicsos/ui";
import { formatCurrency } from "../utils";

interface RelatedRecord {
  id: string;
  href: string;
  cells: Array<{ value: string | React.ReactNode; align?: "left" | "right" }>;
}

interface CrmRelatedListProps {
  title: string;
  count: number;
  headers: string[];
  records: RelatedRecord[];
  viewAllHref?: string;
  emptyText?: string;
  maxVisible?: number;
}

export function CrmRelatedList({
  title,
  count,
  headers,
  records,
  viewAllHref,
  emptyText = "None yet",
  maxVisible = 5,
}: CrmRelatedListProps): JSX.Element {
  const visible = records.slice(0, maxVisible);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {title} ({count})
          </CardTitle>
          {viewAllHref && count > maxVisible && (
            <Link href={viewAllHref} className="text-xs text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-accent/50">
                  {r.cells.map((cell, i) => (
                    <TableCell key={i} className={cell.align === "right" ? "text-right" : ""}>
                      {i === 0 ? (
                        <Link href={r.href} className="font-medium text-foreground hover:text-primary">
                          {cell.value}
                        </Link>
                      ) : (
                        cell.value
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
