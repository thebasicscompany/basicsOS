import {
  CaretDownIcon,
  CaretUpIcon,
  CaretRightIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Attribute } from "@/field-types/types";
import type { ViewSort } from "@/types/views";
import {
  getAttributeDisplayName,
  getNameAttributes,
  isNameFieldId,
  shouldHideSplitNameAttribute,
} from "@/lib/crm/display-name";

export interface SortPopoverProps {
  attributes: Attribute[];
  sorts: ViewSort[];
  onAdd: (sort: Omit<ViewSort, "id">) => void;
  onRemove: (sortId: string) => void;
  onUpdate?: (sortId: string, updates: Partial<ViewSort>) => void;
  children: React.ReactNode;
}

export function SortPopover({
  attributes,
  sorts,
  onAdd,
  onRemove,
  onUpdate,
  children,
}: SortPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [isAddingSort, setIsAddingSort] = React.useState(false);
  const [nameExpanded, setNameExpanded] = React.useState(false);

  const { firstNameAttr, lastNameAttr, usesSplitName } = React.useMemo(
    () => getNameAttributes(attributes),
    [attributes],
  );

  const usedIds = React.useMemo(
    () => new Set(sorts.map((s) => s.fieldId)),
    [sorts],
  );

  const availableAttributes = React.useMemo(() => {
    return attributes.filter(
      (a) =>
        !a.isSystem &&
        !usedIds.has(a.id) &&
        !shouldHideSplitNameAttribute(a, attributes),
    );
  }, [attributes, usedIds]);

  const nameSubOptions = React.useMemo(() => {
    if (!usesSplitName) return [];
    const options: { id: string; label: string }[] = [];
    if (firstNameAttr && !usedIds.has(firstNameAttr.id))
      options.push({ id: firstNameAttr.id, label: "First Name" });
    if (lastNameAttr && !usedIds.has(lastNameAttr.id))
      options.push({ id: lastNameAttr.id, label: "Last Name" });
    return options;
  }, [usesSplitName, firstNameAttr, lastNameAttr, usedIds]);

  const hasNameEntry = nameSubOptions.length > 0;

  const nonNameAttributes = React.useMemo(
    () =>
      availableAttributes.filter(
        (a) => !isNameFieldId(a.id, attributes),
      ),
    [availableAttributes, attributes],
  );

  const attrMap = React.useMemo(
    () => new Map(attributes.map((a) => [a.id, a])),
    [attributes],
  );

  const handleAddSort = React.useCallback(
    (fieldId: string) => {
      onAdd({
        fieldId,
        direction: "asc",
        order: sorts.length,
      });
      setIsAddingSort(false);
      setNameExpanded(false);
    },
    [onAdd, sorts.length],
  );

  const getSortLabel = React.useCallback(
    (fieldId: string) => {
      const attr = attrMap.get(fieldId);
      if (!attr) return fieldId;
      if (isNameFieldId(fieldId, attributes)) {
        return getAttributeDisplayName(attr, attributes, true);
      }
      return attr.name;
    },
    [attrMap, attributes],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setIsAddingSort(false);
          setNameExpanded(false);
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-muted-foreground">Sort by</h4>

          {sorts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No sorts applied. Add a sort to order your records.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sorts.map((sort) => {
                const attr = attrMap.get(sort.fieldId);
                const isNameSort = isNameFieldId(sort.fieldId, attributes);

                return (
                  <div key={sort.id} className="flex items-center gap-2">
                    {isNameSort ? (
                      <Select
                        value={sort.fieldId}
                        onValueChange={(val) =>
                          onUpdate?.(sort.id, { fieldId: val })
                        }
                      >
                        <SelectTrigger className="h-7 flex-1 text-xs">
                          <SelectValue>
                            {getSortLabel(sort.fieldId)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {firstNameAttr && (
                            <SelectItem value={firstNameAttr.id}>
                              First Name
                            </SelectItem>
                          )}
                          {lastNameAttr && (
                            <SelectItem value={lastNameAttr.id}>
                              Last Name
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={sort.fieldId}
                        onValueChange={(val) =>
                          onUpdate?.(sort.id, { fieldId: val })
                        }
                      >
                        <SelectTrigger className="h-7 flex-1 text-xs">
                          <SelectValue>
                            {attr?.name ?? sort.fieldId}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {attr && (
                            <SelectItem value={attr.id}>{attr.name}</SelectItem>
                          )}
                          {availableAttributes
                            .filter((a) => !isNameFieldId(a.id, attributes))
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      variant="outline"
                      size="xs"
                      className="h-7 gap-1 text-xs shrink-0"
                      onClick={() =>
                        onUpdate?.(sort.id, {
                          direction: sort.direction === "asc" ? "desc" : "asc",
                        })
                      }
                    >
                      {sort.direction === "asc" ? (
                        <>
                          <CaretUpIcon className="size-3" />
                          Ascending
                        </>
                      ) : (
                        <>
                          <CaretDownIcon className="size-3" />
                          Descending
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(sort.id)}
                    >
                      <TrashIcon className="size-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {(nonNameAttributes.length > 0 || hasNameEntry) && (
            <>
              <div className="border-t" />
              {isAddingSort ? (
                <div className="rounded-md border">
                  <div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs text-muted-foreground">
                    <PlusIcon className="size-3" />
                    <span>Add sort</span>
                  </div>
                  <Command>
                    <CommandInput placeholder="Search fields..." />
                    <CommandList className="max-h-48">
                      <CommandEmpty>No fields found.</CommandEmpty>

                      {hasNameEntry && !nameExpanded && (
                        <CommandItem
                          value="Name"
                          onSelect={() => {
                            if (nameSubOptions.length === 1) {
                              handleAddSort(nameSubOptions[0].id);
                            } else {
                              setNameExpanded(true);
                            }
                          }}
                        >
                          <span className="flex-1">Name</span>
                          {nameSubOptions.length > 1 && (
                            <CaretRightIcon className="size-3 text-muted-foreground" />
                          )}
                        </CommandItem>
                      )}

                      {hasNameEntry && nameExpanded && (
                        <>
                          <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                            Name
                          </div>
                          {nameSubOptions.map((opt) => (
                            <CommandItem
                              key={opt.id}
                              value={opt.label}
                              onSelect={() => handleAddSort(opt.id)}
                              className="pl-5"
                            >
                              {opt.label}
                            </CommandItem>
                          ))}
                          <div className="border-t my-1" />
                        </>
                      )}

                      {nonNameAttributes.map((a) => (
                        <CommandItem
                          key={a.id}
                          value={a.name}
                          onSelect={() => handleAddSort(a.id)}
                        >
                          {a.name}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-fit gap-1.5 text-xs"
                  onClick={() => {
                    setIsAddingSort(true);
                    setNameExpanded(false);
                  }}
                >
                  <PlusIcon className="size-3.5" />
                  Add sort
                </Button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
