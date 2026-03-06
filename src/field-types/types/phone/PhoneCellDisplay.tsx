import type { CellDisplayProps } from "@/field-types/types";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length > 10) {
    return `+${digits}`;
  }

  return raw;
}

export function PhoneCellDisplay({ value }: CellDisplayProps) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground text-sm" />;
  }

  const formatted = formatPhone(String(value));

  return (
    <a
      href={`tel:${String(value).replace(/\D/g, "")}`}
      className="truncate text-sm text-blue-600 hover:underline dark:text-blue-400"
      onClick={(e) => e.stopPropagation()}
      title={formatted}
    >
      {formatted}
    </a>
  );
}
