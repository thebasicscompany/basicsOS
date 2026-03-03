import { SectionCards } from "@/components/dashboard/section-cards";
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive";
import { usePageTitle } from "@/contexts/page-header";

export function DashboardPage() {
  usePageTitle("Dashboard");
  return (
    <div className="flex h-full flex-col overflow-auto py-4">
      <SectionCards />
      <div className="mt-4">
        <ChartAreaInteractive />
      </div>
    </div>
  );
}
