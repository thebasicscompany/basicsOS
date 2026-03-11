import {
  CaretLeftIcon,
  CaretRightIcon,
  TrashIcon,
  CopyIcon,
  DotsThreeIcon,
  SparkleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEnrich } from "@/hooks/use-enrichment";
import { toast } from "sonner";

export interface RecordDetailHeaderActionsProps {
  objectSlug?: string;
  recordId?: number | string;
  listIdsLength: number;
  prevId: number | null;
  nextId: number | null;
  isFavorite: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDeleteOpen: () => void;
}

export function RecordDetailHeaderActions({
  objectSlug,
  recordId,
  listIdsLength,
  prevId,
  nextId,
  onPrev,
  onNext,
  onDuplicate,
  onDeleteOpen,
}: RecordDetailHeaderActionsProps) {
  const enrich = useEnrich();

  const isEnrichable =
    objectSlug === "contacts" || objectSlug === "companies";

  const handleEnrich = () => {
    if (!recordId) return;
    enrich.mutate(
      {
        entityType: objectSlug === "contacts" ? "contact" : "company",
        entityId: Number(recordId),
      },
      {
        onSuccess: () => {
          toast.success("Record enriched successfully");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to enrich record",
          );
        },
      },
    );
  };

  return (
    <>
      {listIdsLength > 1 && (
        <div className="flex">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-r-none"
            disabled={prevId == null}
            onClick={onPrev}
          >
            <CaretLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-l-none border-l-0"
            disabled={nextId == null}
            onClick={onNext}
          >
            <CaretRightIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
      {isEnrichable && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleEnrich}
          disabled={enrich.isPending}
          title="Enrich record"
        >
          {enrich.isPending ? (
            <CircleNotchIcon className="h-4 w-4 animate-spin" />
          ) : (
            <SparkleIcon className="h-4 w-4" />
          )}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <DotsThreeIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDuplicate}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDeleteOpen}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
