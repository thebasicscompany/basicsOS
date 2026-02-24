"use client";

import { useState } from "react";
import { Button, IconBadge, Plus, X } from "@basicsos/ui";
import { ACTION_PRIMITIVES, getActionPrimitive } from "./action-primitives/index";
import type { ActionConfig } from "./action-primitives/index";

type Action = { type: string; config: ActionConfig };

type Props = {
  actions: Action[];
  onChange: (actions: Action[]) => void;
};

type PickerState = "idle" | "picking" | "configuring";

export const ActionBuilder = ({ actions, onChange }: Props): JSX.Element => {
  const [pickerState, setPickerState] = useState<PickerState>("idle");
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<ActionConfig>({});

  const handlePickType = (type: string): void => {
    const primitive = getActionPrimitive(type);
    if (!primitive) return;
    setPendingType(type);
    setDraftConfig({ ...primitive.defaultConfig });
    setPickerState("configuring");
  };

  const handleAdd = (): void => {
    if (!pendingType) return;
    onChange([...actions, { type: pendingType, config: draftConfig }]);
    setPickerState("idle");
    setPendingType(null);
    setDraftConfig({});
  };

  const handleCancel = (): void => {
    setPickerState("idle");
    setPendingType(null);
    setDraftConfig({});
  };

  const handleRemove = (index: number): void => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const pendingPrimitive = pendingType ? getActionPrimitive(pendingType) : null;

  return (
    <div className="space-y-2">
      {/* Action list */}
      {actions.length > 0 && (
        <div className="space-y-1.5">
          {actions.map((action, i) => {
            const primitive = getActionPrimitive(action.type);
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-sm border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 py-2"
              >
                <span className="text-xs text-stone-400 dark:text-stone-500 w-4 shrink-0 text-right">{i + 1}</span>
                {primitive ? (
                  <IconBadge Icon={primitive.Icon} size="sm" color={primitive.color} />
                ) : (
                  <div className="h-6 w-6 rounded bg-stone-200 dark:bg-stone-700 shrink-0" />
                )}
                <span className="flex-1 text-sm text-stone-700 dark:text-stone-300 truncate">
                  {primitive ? primitive.summary(action.config) : action.type}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="shrink-0 text-stone-400 dark:text-stone-500 hover:text-stone-600 transition-colors"
                  aria-label="Remove action"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Type picker */}
      {pickerState === "picking" && (
        <div className="rounded-sm border border-border bg-card p-3 space-y-2">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Choose an action type</p>
          <div className="grid grid-cols-1 gap-2">
            {ACTION_PRIMITIVES.map((primitive) => (
              <button
                key={primitive.type}
                type="button"
                onClick={() => handlePickType(primitive.type)}
                className="flex items-center gap-3 rounded-sm border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-left hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <IconBadge Icon={primitive.Icon} size="sm" color={primitive.color} />
                <div>
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{primitive.label}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{primitive.description}</p>
                </div>
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancel} className="w-full">
            Cancel
          </Button>
        </div>
      )}

      {/* Config form */}
      {pickerState === "configuring" && pendingPrimitive && (
        <div className="rounded-sm border border-border bg-card p-3 space-y-3">
          <div className="flex items-center gap-2">
            <IconBadge Icon={pendingPrimitive.Icon} size="sm" color={pendingPrimitive.color} />
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{pendingPrimitive.label}</p>
          </div>
          <pendingPrimitive.Form config={draftConfig} onChange={setDraftConfig} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd}>Add</Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Add action button (only shown when not in picker/config mode) */}
      {pickerState === "idle" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerState("picking")}
          className="w-full"
        >
          <Plus size={14} className="mr-1.5" />
          Add Action
        </Button>
      )}
    </div>
  );
};
