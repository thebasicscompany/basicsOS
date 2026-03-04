"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRecords } from "@/hooks/use-records";

const chartConfig = {
  deals: {
    label: "Deals",
    color: "var(--primary)",
  },
  value: {
    label: "Value ($)",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

type ChartPoint = { date: string; deals: number; value: number };

function buildChartData(
  deals: Record<string, any>[],
  days: number,
): ChartPoint[] {
  const now = new Date();
  const points: ChartPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    points.push({
      date: d.toISOString().slice(0, 10),
      deals: 0,
      value: 0,
    });
  }

  for (const deal of deals) {
    // API returns camelCase (createdAt) from Drizzle; fallback for snake_case
    const createdAt = deal.createdAt ?? deal.created_at ?? deal.CreatedAt;
    if (!createdAt) continue;
    const key = String(createdAt).slice(0, 10);
    const pt = points.find((p) => p.date === key);
    if (pt) {
      pt.deals += 1;
      pt.value += Number(deal.amount) || 0;
    }
  }

  return points;
}

export function ChartAreaInteractive() {
  const [timeRange, setTimeRange] = React.useState("7d");

  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;

  const { data, isPending } = useRecords("deals", {
    page: 1,
    perPage: 200,
    sort: { field: "created_at", order: "DESC" },
  });

  const chartData = React.useMemo(
    () => buildChartData((data?.data ?? []) as Record<string, any>[], days),
    [data, days],
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Deal Activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            New deals created in the selected period
          </span>
          <span className="@[540px]/card:hidden">Deals over time</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select time range"
            >
              <SelectValue placeholder="Last 7 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">Last 3 months</SelectItem>
              <SelectItem value="30d" className="rounded-lg">Last 30 days</SelectItem>
              <SelectItem value="7d" className="rounded-lg">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isPending ? (
          <div className="flex aspect-auto h-[250px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillDeals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-deals)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-deals)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="deals"
                type="natural"
                fill="url(#fillDeals)"
                stroke="var(--color-deals)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
