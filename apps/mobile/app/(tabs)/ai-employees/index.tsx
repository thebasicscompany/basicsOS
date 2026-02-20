import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Briefcase, X } from "lucide-react-native";
import { Screen } from "../../../components/Screen";
import { MobileEmptyState } from "../../../components/MobileEmptyState";
import { trpc } from "../../../lib/trpc";
import { colors, radius, shadows } from "../../../lib/tokens";

type JobStatus = "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "killed";

const STATUS_CONFIG: Record<JobStatus, { label: string; bg: string; text: string }> = {
  pending:            { label: "Pending",           bg: colors.surfaceSubtle,   text: colors.textSecondary },
  running:            { label: "Running",           bg: colors.violetSubtle,    text: colors.violet },
  awaiting_approval:  { label: "Needs Approval",    bg: colors.warningSubtle,   text: colors.amber },
  completed:          { label: "Completed",         bg: colors.successSubtle,   text: colors.emerald },
  failed:             { label: "Failed",            bg: colors.destructiveSubtle, text: colors.destructive },
  killed:             { label: "Killed",            bg: colors.surfaceSubtle,   text: colors.textSecondary },
};

const StatusBadge = ({ status }: { status: string }): JSX.Element => {
  const cfg = STATUS_CONFIG[status as JobStatus] ?? { label: status, bg: colors.surfaceSubtle, text: colors.textSecondary };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

type Output = {
  id: string;
  type: string;
  content: string;
  requiresApproval: boolean;
  approvedAt: Date | null;
};

type JobDetail = {
  id: string;
  title: string;
  instructions: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  outputs: Output[];
};

const JobDetailPanel = ({ jobId, onDismiss }: { jobId: string; onDismiss: () => void }): JSX.Element => {
  const { data: job, isLoading, refetch } = trpc.aiEmployees.getJob.useQuery({ id: jobId });
  const approveOutput = trpc.aiEmployees.approveOutput.useMutation({
    onSuccess: () => { void refetch(); },
    onError: (err) => Alert.alert("Error", err.message),
  });
  const killJob = trpc.aiEmployees.kill.useMutation({
    onSuccess: () => { void refetch(); },
    onError: (err) => Alert.alert("Error", err.message),
  });

  if (isLoading || !job) {
    return (
      <View style={styles.panel}>
        <ActivityIndicator size="small" color={colors.brand} />
      </View>
    );
  }

  const jobData = job as JobDetail;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle} numberOfLines={1}>{jobData.title}</Text>
        <TouchableOpacity onPress={onDismiss}>
          <X size={16} color={colors.textPlaceholder} />
        </TouchableOpacity>
      </View>

      <StatusBadge status={jobData.status} />

      <Text style={styles.instructionsLabel}>Instructions</Text>
      <Text style={styles.instructionsText} numberOfLines={4}>{jobData.instructions}</Text>

      {jobData.outputs.length > 0 && (
        <>
          <Text style={styles.outputsLabel}>Outputs</Text>
          {jobData.outputs.map((out) => (
            <View key={out.id} style={styles.outputCard}>
              <Text style={styles.outputContent} numberOfLines={6}>{out.content}</Text>
              {out.requiresApproval && !out.approvedAt && (
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveOutput.mutate({ outputId: out.id })}
                  disabled={approveOutput.isPending}
                >
                  <Text style={styles.approveBtnText}>
                    {approveOutput.isPending ? "Approving..." : "Approve Output"}
                  </Text>
                </TouchableOpacity>
              )}
              {out.approvedAt && (
                <Text style={styles.approvedText}>Approved</Text>
              )}
            </View>
          ))}
        </>
      )}

      {(jobData.status === "pending" || jobData.status === "running") && (
        <TouchableOpacity
          style={styles.killBtn}
          onPress={() => killJob.mutate({ id: jobData.id })}
          disabled={killJob.isPending}
        >
          <Text style={styles.killBtnText}>Stop Job</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Expo Router requires default export for screens.
const AiEmployeesScreen = (): JSX.Element => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const { data: jobs, isLoading, refetch } = trpc.aiEmployees.listJobs.useQuery();

  if (isLoading) {
    return (
      <Screen title="AI Employees">
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      </Screen>
    );
  }

  const jobList = (jobs ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date;
  }>;

  return (
    <Screen title="AI Employees">
      {selectedJobId && (
        <JobDetailPanel
          jobId={selectedJobId}
          onDismiss={() => { setSelectedJobId(null); void refetch(); }}
        />
      )}

      {!selectedJobId && (
        <>
          {jobList.length === 0 ? (
            <MobileEmptyState
              Icon={Briefcase}
              heading="No AI Employee Jobs"
              description="Create a job from the web app to delegate tasks to an AI employee."
            />
          ) : (
            <FlatList
              data={jobList}
              keyExtractor={(j) => j.id}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.jobCard}
                  onPress={() => setSelectedJobId(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.jobCardRow}>
                    <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text style={styles.jobDate}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  sep: { height: 8 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
  jobCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 14,
    ...shadows.card,
  },
  jobCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  jobTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, flex: 1 },
  jobDate: { fontSize: 12, color: colors.textPlaceholder, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  panel: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: 16,
    ...shadows.card,
    marginBottom: 16,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  panelTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  closeBtn: { fontSize: 16, color: colors.textPlaceholder, paddingLeft: 8 },
  instructionsLabel: { fontSize: 11, fontWeight: "700", color: colors.textPlaceholder, textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  instructionsText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  outputsLabel: { fontSize: 11, fontWeight: "700", color: colors.textPlaceholder, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  outputCard: {
    backgroundColor: colors.surfaceApp,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    ...shadows.card,
  },
  outputContent: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  approveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: "center",
  },
  approveBtnText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  approvedText: { fontSize: 12, color: colors.success, fontWeight: "600" },
  killBtn: {
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 12,
  },
  killBtnText: { color: colors.destructive, fontSize: 13, fontWeight: "600" },
});

export default AiEmployeesScreen;
