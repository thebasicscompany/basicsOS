import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useTasks } from "@/hooks/use-tasks";

interface TaskTypeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TaskTypeInput({
  value,
  onChange,
  className,
}: TaskTypeInputProps) {
  const { data: tasksData } = useTasks();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingTypes = useMemo(() => {
    const all = tasksData?.data ?? [];
    const types = new Set<string>();
    for (const t of all) {
      if (t.type && t.type !== "None") types.add(t.type);
    }
    return Array.from(types).sort();
  }, [tasksData?.data]);

  const suggestions = useMemo(() => {
    if (!value.trim()) return existingTypes;
    const q = value.toLowerCase();
    return existingTypes.filter((t) => t.toLowerCase().includes(q));
  }, [existingTypes, value]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Type or select..."
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((type) => (
            <button
              key={type}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(type);
                setOpen(false);
                inputRef.current?.blur();
              }}
            >
              {type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
