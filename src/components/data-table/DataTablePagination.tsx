import {
  CaretLeftIcon,
  CaretRightIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DataTablePaginationProps {
  total: number;
  singularName: string;
  pluralName: string;
  page: number;
  perPage: number;
  totalPages: number;
  onPaginationChange: (page: number, perPage: number) => void;
}

export function DataTablePagination({
  total,
  singularName,
  pluralName,
  page,
  perPage,
  totalPages,
  onPaginationChange,
}: DataTablePaginationProps) {
  const canPrevPage = page > 1;
  const canNextPage = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-2 text-sm">
      <div className="text-muted-foreground whitespace-nowrap text-xs">
        {total}{" "}
        {total === 1 ? singularName.toLowerCase() : pluralName.toLowerCase()}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Rows per page
          </span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => onPaginationChange(1, Number(v))}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[25, 50, 100, 200].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Page {page} of {totalPages}
        </span>

        <div className="flex items-center gap-1">
          <Button
            aria-label="Go to first page"
            variant="outline"
            size="icon-xs"
            onClick={() => onPaginationChange(1, perPage)}
            disabled={!canPrevPage}
          >
            <CaretDoubleLeftIcon className="size-3.5" />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon-xs"
            onClick={() => onPaginationChange(page - 1, perPage)}
            disabled={!canPrevPage}
          >
            <CaretLeftIcon className="size-3.5" />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon-xs"
            onClick={() => onPaginationChange(page + 1, perPage)}
            disabled={!canNextPage}
          >
            <CaretRightIcon className="size-3.5" />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            size="icon-xs"
            onClick={() => onPaginationChange(totalPages, perPage)}
            disabled={!canNextPage}
          >
            <CaretDoubleRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
