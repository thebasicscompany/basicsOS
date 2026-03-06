import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { TypeConfigProps, SelectOption } from "@/field-types/types";
import { Input } from "@/components/ui/input";
import { getColorClasses, getNextAvailableColor } from "@/field-types/colors";
import { ColorPickerDot } from "@/field-types/components/ColorPickerDot";
import { cn } from "@/lib/utils";

export function SelectTypeConfig({ config, onChange }: TypeConfigProps) {
  const [newLabel, setNewLabel] = useState("");
  const options: SelectOption[] = config.options ?? [];

  const addOption = () => {
    if (newLabel.trim() === "") return;
    const existingColors = options.map((o) => o.color);
    const color = getNextAvailableColor(existingColors);
    const newOption: SelectOption = {
      id: `opt_${Date.now()}`,
      label: newLabel.trim(),
      color,
    };
    onChange({ ...config, options: [...options, newOption] });
    setNewLabel("");
  };

  const removeOption = (id: string) => {
    onChange({ ...config, options: options.filter((o) => o.id !== id) });
  };

  const updateOptionColor = (id: string, color: string) => {
    onChange({
      ...config,
      options: options.map((o) => (o.id === id ? { ...o, color } : o)),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Options</p>
      <div className="flex flex-col gap-1">
        {options.map((option) => {
          const colors = getColorClasses(option.color);
          return (
            <div
              key={option.id}
              className="group flex h-8 items-center gap-2.5 rounded-md px-2 hover:bg-muted/50"
            >
              <ColorPickerDot
                currentColor={option.color}
                dotClass={cn("h-3 w-3 rounded-full", colors.bg)}
                onSelect={(color) => updateOptionColor(option.id, color)}
              />
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  colors.bg,
                  colors.text,
                  colors.border,
                )}
              >
                {option.label}
              </span>
              <div className="flex-1" />
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
          placeholder="Add option..."
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
