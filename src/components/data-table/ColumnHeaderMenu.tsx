import * as React from "react";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilSimpleIcon,
  EyeSlashIcon,
  GearIcon,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface ColumnHeaderMenuProps {
  fieldId: string;
  currentTitle: string;
  isPrimary: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRename: (title: string) => void;
  onHide: () => void;
  onEditAttribute?: () => void;
  children: React.ReactNode;
}

export function ColumnHeaderMenu({
  currentTitle,
  isPrimary,
  canMoveLeft,
  canMoveRight,
  onSortAsc,
  onSortDesc,
  onMoveLeft,
  onMoveRight,
  onRename,
  onHide,
  onEditAttribute,
  children,
}: ColumnHeaderMenuProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(currentTitle);
  const [open, setOpen] = React.useState(false);

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== currentTitle) {
      onRename(trimmed);
    }
    setIsEditing(false);
    setOpen(false);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setIsEditing(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 text-left w-full outline-none">
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {isEditing ? (
          <div className="p-2">
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSubmit();
                }
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setOpen(false);
                }
                e.stopPropagation();
              }}
              className="h-7 text-xs"
            />
          </div>
        ) : (
          <>
            <DropdownMenuItem onSelect={onSortAsc}>
              <ArrowUpIcon className="size-4 mr-2" />
              Sort ascending
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSortDesc}>
              <ArrowDownIcon className="size-4 mr-2" />
              Sort descending
            </DropdownMenuItem>
            {canMoveLeft && (
              <DropdownMenuItem onSelect={onMoveLeft}>
                <ArrowLeftIcon className="size-4 mr-2" />
                Move left
              </DropdownMenuItem>
            )}
            {canMoveRight && (
              <DropdownMenuItem onSelect={onMoveRight}>
                <ArrowRightIcon className="size-4 mr-2" />
                Move right
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setEditValue(currentTitle);
                setIsEditing(true);
              }}
            >
              <PencilSimpleIcon className="size-4 mr-2" />
              Edit column label
            </DropdownMenuItem>
            {onEditAttribute && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onEditAttribute}>
                  <GearIcon className="size-4 mr-2" />
                  Edit field
                </DropdownMenuItem>
              </>
            )}
            {!isPrimary && (
              <DropdownMenuItem onSelect={onHide}>
                <EyeSlashIcon className="size-4 mr-2" />
                Hide from view
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
