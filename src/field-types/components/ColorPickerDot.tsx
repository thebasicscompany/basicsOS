import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TAG_COLOR_PALETTE } from "@/field-types/colors";
import { cn } from "@/lib/utils";

interface ColorPickerDotProps {
  currentColor: string;
  dotClass: string;
  onSelect: (colorName: string) => void;
}

export function ColorPickerDot({
  currentColor,
  dotClass,
  onSelect,
}: ColorPickerDotProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-4 w-4 shrink-0 rounded-full border border-transparent transition-shadow hover:ring-2 hover:ring-ring/40",
            dotClass,
          )}
          title="Change color"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-auto p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-6 gap-1.5">
          {TAG_COLOR_PALETTE.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => {
                onSelect(color.name);
                setOpen(false);
              }}
              className={cn(
                "h-5 w-5 rounded-full border transition-shadow",
                color.bg,
                color.border,
                currentColor === color.name
                  ? "ring-2 ring-primary ring-offset-1"
                  : "hover:ring-2 hover:ring-ring/40",
              )}
              title={color.name}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
