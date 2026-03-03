import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared types (from other phases -- inlined here for self-containment)
// ---------------------------------------------------------------------------

export interface Attribute {
  id: string;
  name: string;
  columnName: string;
  uiType: string;
  sqlType: string;
  config: Record<string, any>;
  isPrimary: boolean;
  isSystem: boolean;
  isHiddenByDefault: boolean;
  icon?: string;
  order: number;
}

export interface StatusOption {
  id: string;
  label: string;
  color: string;
  order: number;
  isTerminal?: boolean;
}

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

export interface KanbanBoardProps {
  objectSlug: string;
  singularName: string;
  records: Record<string, any>[];
  attributes: Attribute[];
  statusAttribute: Attribute;
  displayAttributes: Attribute[];
  onRecordUpdate: (recordId: number, columnName: string, value: any) => void;
  onRecordClick?: (recordId: number) => void;
  onNewRecord?: (defaultValues?: Record<string, any>) => void;
}

// ---------------------------------------------------------------------------
// Internal draggable card wrapper
// ---------------------------------------------------------------------------

function DraggableCard({
  record,
  attributes,
  primaryAttribute,
  displayAttributes,
  onClick,
  onUpdate,
}: {
  record: Record<string, any>;
  attributes: Attribute[];
  primaryAttribute: Attribute;
  displayAttributes: Attribute[];
  onClick?: () => void;
  onUpdate: (columnName: string, value: any) => void;
}) {
  const id = String(record.Id ?? record.id);
  const {
    attributes: dragAttributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id,
    data: { record },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...dragAttributes}
      className={cn(
        "transition-opacity duration-150",
        isDragging && "opacity-40",
      )}
    >
      <KanbanCard
        record={record}
        attributes={attributes}
        primaryAttribute={primaryAttribute}
        displayAttributes={displayAttributes}
        onClick={onClick}
        onUpdate={onUpdate}
        isDragging={isDragging}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal droppable column wrapper
// ---------------------------------------------------------------------------

function DroppableColumnWrapper({
  columnId,
  children,
}: {
  columnId: string;
  children: (isOver: boolean) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div ref={setNodeRef} className="flex h-full min-w-0 flex-col">
      {children(isOver)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanBoard component
// ---------------------------------------------------------------------------

export function KanbanBoard({
  objectSlug: _objectSlug,
  singularName,
  records,
  attributes,
  statusAttribute,
  displayAttributes,
  onRecordUpdate,
  onRecordClick,
  onNewRecord,
}: KanbanBoardProps) {
  // Optimistic local state so drags feel instant
  const [localRecords, setLocalRecords] = useState(records);
  const [activeRecord, setActiveRecord] = useState<Record<string, any> | null>(
    null,
  );

  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  // ------ Column definitions from status attribute config ------
  const columns: StatusOption[] = useMemo(() => {
    const opts: StatusOption[] = statusAttribute.config?.options ?? [];
    return [...opts].sort((a, b) => a.order - b.order);
  }, [statusAttribute]);

  // ------ Primary attribute (for card title) ------
  const primaryAttribute = useMemo(() => {
    return attributes.find((a) => a.isPrimary) ?? attributes[0];
  }, [attributes]);

  // ------ Group records into columns ------
  const recordsByColumn = useMemo(() => {
    const grouped: Record<string, Record<string, any>[]> = {};
    for (const col of columns) {
      grouped[col.id] = [];
    }
    // Also prepare an "uncategorized" bucket
    grouped["__uncategorized__"] = [];

    for (const record of localRecords) {
      const value = record[statusAttribute.columnName];
      // Match by label (what NocoDB stores) or by id
      const matched = columns.find((c) => c.label === value || c.id === value);
      if (matched) {
        grouped[matched.id].push(record);
      } else {
        grouped["__uncategorized__"].push(record);
      }
    }
    return grouped;
  }, [localRecords, columns, statusAttribute.columnName]);

  // ------ Sensors ------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // ------ Drag handlers ------
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const record = event.active.data.current?.record as
      | Record<string, any>
      | undefined;
    if (record) {
      setActiveRecord(record);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveRecord(null);

      const record = event.active.data.current?.record as
        | Record<string, any>
        | undefined;
      const overId = event.over?.id;

      if (!record || typeof overId !== "string") return;

      // Find the target column
      const targetColumn = columns.find((c) => c.id === overId);
      if (!targetColumn) return;

      // Determine the current column of the record
      const currentValue = record[statusAttribute.columnName];
      const currentColumn = columns.find(
        (c) => c.label === currentValue || c.id === currentValue,
      );
      if (currentColumn?.id === targetColumn.id) return;

      // Optimistic update
      const recordId = record.Id ?? record.id;
      setLocalRecords((prev) =>
        prev.map((r) =>
          (r.Id ?? r.id) === recordId
            ? { ...r, [statusAttribute.columnName]: targetColumn.label }
            : r,
        ),
      );

      // Notify parent
      onRecordUpdate(recordId, statusAttribute.columnName, targetColumn.label);
    },
    [columns, statusAttribute.columnName, onRecordUpdate],
  );

  const handleDragCancel = useCallback(() => {
    setActiveRecord(null);
  }, []);

  // ------ Render ------
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {columns.map((column) => {
            const columnRecords = recordsByColumn[column.id] ?? [];

            return (
              <DroppableColumnWrapper key={column.id} columnId={column.id}>
                {(isOver) => (
                  <KanbanColumn
                    id={column.id}
                    title={column.label}
                    color={column.color}
                    count={columnRecords.length}
                    isOver={isOver}
                    singularName={singularName}
                    onNewRecord={
                      onNewRecord
                        ? () =>
                            onNewRecord({
                              [statusAttribute.columnName]: column.label,
                            })
                        : undefined
                    }
                  >
                    {columnRecords.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                          No {singularName.toLowerCase()}s
                        </p>
                      </div>
                    ) : (
                      columnRecords.map((record) => {
                        const recordId = record.Id ?? record.id;
                        return (
                          <DraggableCard
                            key={recordId}
                            record={record}
                            attributes={attributes}
                            primaryAttribute={primaryAttribute}
                            displayAttributes={displayAttributes}
                            onClick={
                              onRecordClick
                                ? () => onRecordClick(recordId)
                                : undefined
                            }
                            onUpdate={(colName, value) =>
                              onRecordUpdate(recordId, colName, value)
                            }
                          />
                        );
                      })
                    )}
                  </KanbanColumn>
                )}
              </DroppableColumnWrapper>
            );
          })}

          {/* Uncategorized column if any records don't match a status */}
          {(recordsByColumn["__uncategorized__"]?.length ?? 0) > 0 && (
            <DroppableColumnWrapper columnId="__uncategorized__">
              {(isOver) => (
                <KanbanColumn
                  id="__uncategorized__"
                  title="Uncategorized"
                  color="gray"
                  count={recordsByColumn["__uncategorized__"].length}
                  isOver={isOver}
                  singularName={singularName}
                >
                  {recordsByColumn["__uncategorized__"].map((record) => {
                    const recordId = record.Id ?? record.id;
                    return (
                      <DraggableCard
                        key={recordId}
                        record={record}
                        attributes={attributes}
                        primaryAttribute={primaryAttribute}
                        displayAttributes={displayAttributes}
                        onClick={
                          onRecordClick
                            ? () => onRecordClick(recordId)
                            : undefined
                        }
                        onUpdate={(colName, value) =>
                          onRecordUpdate(recordId, colName, value)
                        }
                      />
                    );
                  })}
                </KanbanColumn>
              )}
            </DroppableColumnWrapper>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Drag overlay -- rendered in a portal so it floats above everything */}
      <DragOverlay>
        {activeRecord ? (
          <KanbanCard
            record={activeRecord}
            attributes={attributes}
            primaryAttribute={primaryAttribute}
            displayAttributes={displayAttributes}
            isDragging
            onUpdate={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
