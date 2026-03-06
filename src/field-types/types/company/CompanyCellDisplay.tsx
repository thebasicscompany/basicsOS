import { useQuery } from "@tanstack/react-query";
import { BuildingIcon } from "@phosphor-icons/react";
import type { CellDisplayProps } from "@/field-types/types";
import { getOne } from "@/lib/api/crm";
import { snakeToCamel } from "@/lib/crm/field-mapper";

export function CompanyCellDisplay({ value }: CellDisplayProps) {
  const companyId = value != null && value !== "" ? Number(value) : null;

  const { data: company } = useQuery({
    queryKey: ["companies", companyId],
    queryFn: async () => {
      const row = await getOne<Record<string, unknown>>("companies", companyId!);
      return snakeToCamel(row) as { id: number; name: string };
    },
    enabled: companyId != null && companyId > 0,
    staleTime: 60_000,
  });

  if (companyId == null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <span className="flex w-full items-center gap-1.5 truncate text-sm">
      <BuildingIcon className="size-3.5 shrink-0 text-muted-foreground" />
      {company?.name ?? "…"}
    </span>
  );
}
