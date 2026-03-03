import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function SortableHeaderCell({
  id,
  children,
  style,
  className,
  ...rest
}: React.ComponentProps<"th"> & { id: string }) {
  const {
    attributes: dndAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const mergedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={mergedStyle}
      className={cn(className, "relative select-none")}
      {...rest}
    >
      <div className="flex items-center gap-1">
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
          {...dndAttributes}
          {...listeners}
        >
          <DotsThreeVerticalIcon className="size-3" />
        </button>
        {children}
      </div>
    </TableHead>
  );
}
