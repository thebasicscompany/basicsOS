import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { TypeConfigProps, StatusOption } from "@/field-types/types";
import { Input } from "@/components/ui/input";
import { getNextAvailableColor, getStatusDotClass } from "@/field-types/colors";
import { ColorPickerDot } from "@/field-types/components/ColorPickerDot";
import { cn } from "@/lib/utils";

export function StatusTypeConfig({ config, onChange }: TypeConfigProps) {
  const [newLabel, setNewLabel] = useState("");
  const options: StatusOption[] = config.options ?? [];

  const addOption = () => {
    if (newLabel.trim() === "") return;
    const existingColors = options.map((option) => option.color ?? "gray");
    const newOption: StatusOption = {
      id: `status_${Date.now()}`,
      label: newLabel.trim(),
      color: getNextAvailableColor(existingColors),
      order: options.length,
    };
    onChange({ ...config, options: [...options, newOption] });
    setNewLabel("");
  };

  const removeOption = (id: string) => {
    onChange({
      ...config,
      options: options
        .filter((o) => o.id !== id)
        .map((o, i) => ({ ...o, order: i })),
    });
  };

  const updateOptionColor = (id: string, color: string) => {
    onChange({
      ...config,
      options: options.map((option) =>
        option.id === id ? { ...option, color } : option,
      ),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Options</p>
      <div className="flex flex-col gap-1">
        {options.map((option) => {
          const dotColor = getStatusDotClass(option.label, option.color);
          return (
            <div
              key={option.id}
              className="group flex h-8 items-center gap-2.5 rounded-md px-2 hover:bg-muted/50"
            >
              <ColorPickerDot
                currentColor={option.color ?? "gray"}
                dotClass={cn("h-3 w-3", dotColor)}
                onSelect={(color) => updateOptionColor(option.id, color)}
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {option.label}
              </span>
              <button
                type="button"
                onClick={() => removeOption(option.id)}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder="Add status..."
          className="h-8 text-sm"
        />
        <button
          type="button"
          onClick={addOption}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
