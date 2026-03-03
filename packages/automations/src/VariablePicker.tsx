import { BracketsCurlyIcon } from "@phosphor-icons/react";
import { useRef } from "react";
import { Button } from "basics-os/src/components/ui/button";
import { Input } from "basics-os/src/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "basics-os/src/components/ui/popover";
import { Textarea } from "basics-os/src/components/ui/textarea";
import { cn } from "basics-os/src/lib/utils";
import type { Variable } from "./useAvailableVariables";

export interface VariablePickerProps {
  variables: Variable[];
  onInsert: (text: string) => void;
  className?: string;
}

export function VariablePicker({ variables, onInsert, className }: VariablePickerProps) {
  const handleSelectVariable = (label: string) => {
    onInsert(label);
  };

  if (variables.length === 0) {
    return null;
  }

  const grouped = new Map<string, Variable[]>();
  for (const v of variables) {
    const key = v.sourceLabel || "Other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(v);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-7 shrink-0 text-muted-foreground hover:text-foreground", className)}
          title="Insert variable"
        >
          <BracketsCurlyIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0" side="top">
        <div className="max-h-56 overflow-y-auto py-1">
          {Array.from(grouped.entries()).map(([sourceLabel, vars]) => (
            <div key={sourceLabel} className="px-2 py-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1.5 py-0.5">
                From: {sourceLabel}
              </p>
              <div className="space-y-0.5">
                {vars.map((v) => (
                  <button
                    key={`${v.sourceNodeId}-${v.name}`}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => handleSelectVariable(v.label)}
                  >
                    <code className="font-mono text-[11px] text-foreground">{v.label}</code>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface VariableInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
}

export function VariableInput({
  value,
  onChange,
  variables,
  className,
  ...rest
}: VariableInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleInsert = (text: string) => {
    const el = containerRef.current?.querySelector("input") as HTMLInputElement | null;
    if (!el) return;
    const { start, end } = selectionRef.current ?? { start: el.selectionStart, end: el.selectionEnd };
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const captureSelection = () => {
    const el = containerRef.current?.querySelector("input") as HTMLInputElement | null;
    if (el) {
      selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
    }
  };

  return (
    <div ref={containerRef} className="flex w-full min-w-0 items-center gap-1.5">
      <Input
        value={value}
        onChange={handleChange}
        className={cn("min-w-0 flex-1", className)}
        {...rest}
      />
      {variables.length > 0 && (
        <div onMouseDown={captureSelection}>
          <VariablePicker variables={variables} onInsert={handleInsert} />
        </div>
      )}
    </div>
  );
}

export interface VariableTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
}

export function VariableTextarea({
  value,
  onChange,
  variables,
  className,
  ...rest
}: VariableTextareaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleInsert = (text: string) => {
    const el = containerRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;
    if (!el) return;
    const { start, end } = selectionRef.current ?? { start: el.selectionStart, end: el.selectionEnd };
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const captureSelection = () => {
    const el = containerRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;
    if (el) {
      selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
    }
  };

  return (
    <div ref={containerRef} className="flex w-full min-w-0 items-start gap-1.5">
      <Textarea
        value={value}
        onChange={handleChange}
        className={cn("min-w-0 flex-1", className)}
        {...rest}
      />
      {variables.length > 0 && (
        <div className="mt-1.5 shrink-0" onMouseDown={captureSelection}>
          <VariablePicker variables={variables} onInsert={handleInsert} />
        </div>
      )}
    </div>
  );
}
