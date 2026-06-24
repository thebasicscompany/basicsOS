import { PlusCircleIcon, TableIcon } from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useObjects } from "@/hooks/use-object-registry";

/** Sentinel objectSlug for the "create a brand-new grid from this CSV" path. */
export const NEW_GRID_VALUE = "__new__";

export interface ImportObjectSelectorProps {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
}

export function ImportObjectSelector({
  value,
  onChange,
  disabled,
}: ImportObjectSelectorProps) {
  const objects = useObjects();

  return (
    <div className="space-y-2">
      <Label>Import into</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue placeholder="Choose a grid…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NEW_GRID_VALUE}>
            <span className="flex items-center gap-2">
              <PlusCircleIcon className="size-4" />
              Create a new grid from this CSV
            </span>
          </SelectItem>
          {objects.map((o) => (
            <SelectItem key={o.slug} value={o.slug}>
              <span className="flex items-center gap-2">
                <TableIcon className="size-4" />
                {o.pluralName || o.slug}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
