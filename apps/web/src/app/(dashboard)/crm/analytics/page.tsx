"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  BarChart3,
  TrendingUp,
  DollarSign,
  Activity,
} from "@basicsos/ui";

type Period = "30d" | "90d" | "365d";

const PERIOD_LABELS: Record<Period, string> = {
  "30d": "30 Days",
  "90d": "90 Days",
  "365d": "12 Months",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "#a8a29e",
  qualified: "#3b82f6",
  proposal: "#f59e0b",
  negotiation: "#8b5cf6",
  won: "#10b981",
  lost: "#ef4444",
};

const STAGE_ORDER = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
};

const formatMonth = (month: string): string => {
  const [year, m] = month.split("-");
  if (!year || !m) return month;
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string | undefined }>;
  iconColor: string;
}

const StatCard = ({ label, value, sub, icon: Icon, iconColor }: StatCardProps): JSX.Element => (
  <Card>
    <CardContent className="pt-4 pb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{sub}</p>
          )}
        </div>
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </CardContent>
  </Card>
);

interface StageFunnelProps {
  stageBreakdown: Array<{ stage: string; count: number; value: number }>;
}

const StageFunnel = ({ stageBreakdown }: StageFunnelProps): JSX.Element => {
  const sorted = [...stageBreakdown].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

  const chartData = sorted.map((s) => ({
    stage: s.stage.charAt(0).toUpperCase() + s.stage.slice(1),
    stageKey: s.stage,
    count: s.count,
    value: s.value,
  }));

  if (chartData.length === 0) {
    return (
      <EmptyState
        Icon={BarChart3}
        heading="No stage data"
        description="Create deals to see stage breakdown."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-stone-200)" vertical={false} />
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 11, fill: "var(--color-stone-500)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-stone-500)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-stone-900)",
            border: "none",
            borderRadius: "6px",
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-stone-100)", fontWeight: 600 }}
          itemStyle={{ color: "var(--color-stone-300)" }}
          formatter={(val: unknown, name: unknown) => {
            const v = typeof val === "number" ? val : 0;
            const n = String(name ?? "");
            return n === "Value ($)" ? [formatCurrency(v), n] : [v, n];
          }}
        />
        <Bar
          dataKey="count"
          name="Deals"
          fill="#6366f1"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

interface MonthlyChartProps {
  monthlyData: Array<{ month: string; created: number; won: number; value: number }>;
}

const MonthlyChart = ({ monthlyData }: MonthlyChartProps): JSX.Element => {
  const chartData = monthlyData.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  if (chartData.length === 0) {
    return (
      <EmptyState
        Icon={Activity}
        heading="No monthly data"
        description="Deals will appear here as they are created."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-stone-200)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--color-stone-500)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-stone-500)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-stone-900)",
            border: "none",
            borderRadius: "6px",
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-stone-100)", fontWeight: 600 }}
          itemStyle={{ color: "var(--color-stone-300)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--color-stone-500)" }}
          iconSize={10}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="created"
          name="Created"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#6366f1" }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="won"
          name="Won"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3, fill: "#10b981" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

interface StageValueChartProps {
  stageBreakdown: Array<{ stage: string; count: number; value: number }>;
}

const StageValueChart = ({ stageBreakdown }: StageValueChartProps): JSX.Element => {
  const sorted = [...stageBreakdown].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

  const chartData = sorted.map((s) => ({
    stage: s.stage.charAt(0).toUpperCase() + s.stage.slice(1),
    value: s.value,
  }));

  if (chartData.length === 0) {
    return (
      <EmptyState
        Icon={DollarSign}
        heading="No value data"
        description="Add deal values to see pipeline breakdown."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-stone-200)" vertical={false} />
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 11, fill: "var(--color-stone-500)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-stone-500)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: unknown) => formatCurrency(typeof v === "number" ? v : 0)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-stone-900)",
            border: "none",
            borderRadius: "6px",
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-stone-100)", fontWeight: 600 }}
          itemStyle={{ color: "var(--color-stone-300)" }}
          formatter={(val: unknown) => [formatCurrency(typeof val === "number" ? val : 0), "Value"]}
        />
        <Bar
          dataKey="value"
          name="Value"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          fill="#6366f1"
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

const AnalyticsPage = (): JSX.Element => {
  const [period, setPeriod] = useState<Period>("90d");

  const { data, isLoading } = trpc.crm.analytics.pipeline.useQuery({ period });

  const stageBreakdownSorted = (data?.stageBreakdown ?? []).sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pipeline Analytics"
        backHref="/crm"
        backLabel="CRM"
        description="Overview of your sales pipeline performance."
        action={
          <Tabs
            value={period}
            onValueChange={(v: string) => setPeriod(v as Period)}
          >
            <TabsList>
              {(["30d", "90d", "365d"] as Period[]).map((p) => (
                <TabsTrigger key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Pipeline"
          value={isLoading ? "—" : formatCurrency(data?.totalPipeline ?? 0)}
          sub="Active deals only"
          icon={DollarSign}
          iconColor="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
        />
        <StatCard
          label="Win Rate"
          value={isLoading ? "—" : `${data?.winRate ?? 0}%`}
          sub="Of closed deals"
          icon={TrendingUp}
          iconColor="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label={`Won (${PERIOD_LABELS[period]})`}
          value={isLoading ? "—" : String(data?.wonThisPeriod ?? 0)}
          sub="Deals closed won"
          icon={BarChart3}
          iconColor="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Avg Deal Size"
          value={isLoading ? "—" : formatCurrency(data?.avgDealSize ?? 0)}
          sub={`Across ${data?.totalDeals ?? 0} deals`}
          icon={Activity}
          iconColor="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Stage funnel */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Deals by Stage
            </CardTitle>
            <p className="text-xs text-stone-500 dark:text-stone-400">Count of deals per stage</p>
          </CardHeader>
          <CardContent className="pt-2">
            <StageFunnel stageBreakdown={data?.stageBreakdown ?? []} />
          </CardContent>
        </Card>

        {/* Stage value chart */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Pipeline Value by Stage
            </CardTitle>
            <p className="text-xs text-stone-500 dark:text-stone-400">Total value per stage</p>
          </CardHeader>
          <CardContent className="pt-2">
            <StageValueChart stageBreakdown={data?.stageBreakdown ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* Monthly trends chart */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-stone-700 dark:text-stone-300">
            Monthly Trends
          </CardTitle>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Deals created and won over the last 6 months
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <MonthlyChart monthlyData={data?.monthlyData ?? []} />
        </CardContent>
      </Card>

      {/* Stage breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-stone-700 dark:text-stone-300">
            Stage Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Avg Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stageBreakdownSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-stone-500 dark:text-stone-400 py-8">
                    No deals yet
                  </TableCell>
                </TableRow>
              ) : (
                stageBreakdownSorted.map((s) => (
                  <TableRow key={s.stage}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: STAGE_COLORS[s.stage] ?? "#a8a29e",
                          }}
                        />
                        <span className="capitalize text-stone-900 dark:text-stone-100">
                          {s.stage}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-stone-700 dark:text-stone-300">
                      {s.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-stone-700 dark:text-stone-300">
                      {formatCurrency(s.value)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-stone-500 dark:text-stone-400">
                      {s.count > 0 ? formatCurrency(s.value / s.count) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top companies table */}
      {(data?.topCompanies ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Top Companies by Deal Value
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.topCompanies ?? []).map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold shrink-0"
                        >
                          {i + 1}
                        </Badge>
                        <span className="text-stone-900 dark:text-stone-100 font-medium">
                          {c.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-stone-700 dark:text-stone-300">
                      {c.dealCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-stone-700 dark:text-stone-300 font-medium">
                      {formatCurrency(c.totalValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;
