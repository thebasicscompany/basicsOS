"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from "@basicsos/ui";
import { Users, Building2, Briefcase, BarChart3, Activity, AlertCircle } from "@basicsos/ui";
import { STAGES, STAGE_COLORS, formatCurrency } from "./utils";

const CrmDashboard = (): JSX.Element => {
  const { data: contactsData } = trpc.crm.contacts.list.useQuery({});
  const { data: companiesData } = trpc.crm.companies.list.useQuery();
  const { data: dealsData } = trpc.crm.deals.listByStage.useQuery();
  const { data: overdueDeals } = trpc.crm.deals.listOverdue.useQuery();

  const byStage = dealsData ?? [];
  const allDeals = byStage.flatMap((g) => g.deals);
  const contacts = contactsData ?? [];
  const companies = companiesData ?? [];

  const stats = useMemo(() => computeStats(contacts, allDeals), [contacts, allDeals]);
  const analytics = useMemo(() => computeAnalytics(byStage, allDeals), [byStage, allDeals]);

  if (allDeals.length === 0 && contacts.length === 0) {
    return (
      <EmptyState
        Icon={BarChart3}
        heading="Welcome to your CRM"
        description="Get started by creating your first contact or deal."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <KpiCards stats={stats} companiesCount={companies.length} />
      {(overdueDeals ?? []).length > 0 && (
        <OverdueDealsCard deals={overdueDeals ?? []} />
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StageFunnel stageTotals={analytics.stageTotals} maxTotal={analytics.maxTotal} />
        <WinRateCard winRate={analytics.winRate} wonCount={analytics.wonCount} lostCount={analytics.lostCount} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {analytics.topDeals.length > 0 && <TopDealsTable deals={analytics.topDeals} />}
        <RecentActivityCard deals={allDeals} />
      </div>
    </div>
  );
};

function computeStats(
  contacts: Array<{ id: string }>,
  allDeals: Array<{ stage: string; value: string | null }>,
): { pipelineValue: number; wonValue: number; winRate: number; activeContacts: number } {
  const active = allDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipelineValue = active.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const wonDeals = allDeals.filter((d) => d.stage === "won");
  const wonValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const lostCount = allDeals.filter((d) => d.stage === "lost").length;
  const closedCount = wonDeals.length + lostCount;
  const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;
  return { pipelineValue, wonValue, winRate, activeContacts: contacts.length };
}

function computeAnalytics(
  byStage: Array<{ stage: string; deals: Array<{ id: string; title: string; stage: string; value: string | null }> }>,
  allDeals: Array<{ id: string; title: string; stage: string; value: string | null }>,
): {
  stageTotals: Array<{ stage: string; count: number; total: number }>;
  maxTotal: number;
  winRate: number;
  wonCount: number;
  lostCount: number;
  topDeals: Array<{ id: string; title: string; stage: string; value: string | null }>;
} {
  const stageTotals = STAGES.map((stage) => {
    const deals = byStage.find((g) => g.stage === stage)?.deals ?? [];
    const total = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    return { stage, count: deals.length, total };
  });
  const maxTotal = Math.max(...stageTotals.map((s) => s.total), 1);
  const wonCount = stageTotals.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = stageTotals.find((s) => s.stage === "lost")?.count ?? 0;
  const closedCount = wonCount + lostCount;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
  const topDeals = [...allDeals].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)).slice(0, 10);
  return { stageTotals, maxTotal, winRate, wonCount, lostCount, topDeals };
}

function KpiCards({
  stats,
  companiesCount,
}: {
  stats: { pipelineValue: number; wonValue: number; winRate: number; activeContacts: number };
  companiesCount: number;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} icon={Briefcase} />
      <StatCard label="Won Revenue" value={formatCurrency(stats.wonValue)} icon={Activity} valueClass="text-success" />
      <StatCard label="Win Rate" value={`${stats.winRate}%`} icon={BarChart3} />
      <StatCard label="Active Contacts" value={String(stats.activeContacts)} icon={Users} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  valueClass?: string;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-700">
            <Icon className="size-3.5 text-stone-500 dark:text-stone-400" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className={`mt-2 text-xl font-semibold tabular-nums ${valueClass ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StageFunnel({
  stageTotals,
  maxTotal,
}: {
  stageTotals: Array<{ stage: string; count: number; total: number }>;
  maxTotal: number;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Stage Funnel</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {stageTotals.map((s) => {
          const widthPct = maxTotal > 0 ? Math.max((s.total / maxTotal) * 100, 2) : 2;
          const barColor = STAGE_COLORS[s.stage] ?? "bg-stone-400";
          return (
            <div key={s.stage} className="flex items-center gap-3">
              <span className="w-24 text-xs font-medium capitalize text-stone-600 dark:text-stone-400">{s.stage}</span>
              <div className="flex-1">
                <div className={`h-6 rounded-sm ${barColor} transition-all`} style={{ width: `${widthPct}%` }} />
              </div>
              <span className="w-20 text-right text-xs tabular-nums text-stone-500 dark:text-stone-400">{formatCurrency(s.total)}</span>
              <span className="w-8 text-right text-[10px] text-stone-400 dark:text-stone-500">{s.count}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function WinRateCard({
  winRate,
  wonCount,
  lostCount,
}: {
  winRate: number;
  wonCount: number;
  lostCount: number;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-6">
        <div className="relative flex size-28 items-center justify-center">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-stone-200 dark:text-stone-700" />
            <circle
              cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
              strokeDasharray={`${winRate * 2.51} ${251 - winRate * 2.51}`}
              strokeLinecap="round"
              className="text-primary"
            />
          </svg>
          <span className="absolute text-2xl font-bold tabular-nums text-foreground">{winRate}%</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> {wonCount} won</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" /> {lostCount} lost</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TopDealsTable({
  deals,
}: {
  deals: Array<{ id: string; title: string; stage: string; value: string | null }>;
}): JSX.Element {
  const router = useRouter();
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Top Deals</CardTitle>
          <Link href="/crm/deals" className="text-xs text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((d) => (
              <TableRow key={d.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/crm/deals/${d.id}`)}>
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{d.stage}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(d.value ?? 0))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OverdueDealsCard({
  deals,
}: {
  deals: Array<{ id: string; title: string; stage: string; value: string; closeDate: Date | null }>;
}): JSX.Element {
  const router = useRouter();
  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive" />
            <CardTitle className="text-sm font-medium text-destructive">Overdue Deals</CardTitle>
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] py-0">
              {deals.length}
            </Badge>
          </div>
          <Link href="/crm/deals" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Close Date</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/crm/deals/${d.id}`)}
              >
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{d.stage}</Badge>
                </TableCell>
                <TableCell className="text-destructive text-xs">
                  {d.closeDate ? new Date(d.closeDate).toLocaleDateString() : "\u2014"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(Number(d.value ?? 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({
  deals,
}: {
  deals: Array<{ id: string; title: string; stage: string }>;
}): JSX.Element {
  const recentDeals = deals.slice(0, 8);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recent Deals</CardTitle>
      </CardHeader>
      <CardContent>
        {recentDeals.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No recent deals</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentDeals.map((d) => (
              <Link key={d.id} href={`/crm/deals/${d.id}`} className="flex items-center justify-between rounded-md p-2 hover:bg-accent/50 transition-colors">
                <span className="text-sm font-medium text-foreground truncate">{d.title}</span>
                <Badge variant="outline" className="capitalize text-[10px] ml-2 shrink-0">{d.stage}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CrmDashboardPage = (): JSX.Element => (
  <Suspense>
    <CrmDashboard />
  </Suspense>
);

export default CrmDashboardPage;
