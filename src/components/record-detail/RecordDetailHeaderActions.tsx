import {
  CaretLeftIcon,
  CaretRightIcon,
  TrashIcon,
  CopyIcon,
  DotsThreeIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RecordDetailHeaderActionsProps {
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
  listIdsLength,
  prevId,
  nextId,
  onPrev,
  onNext,
  onDuplicate,
  onDeleteOpen,
}: RecordDetailHeaderActionsProps) {
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
