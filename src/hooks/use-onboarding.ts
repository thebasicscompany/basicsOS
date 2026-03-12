import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useMe } from "@/hooks/use-me";

type UpdateMePayload = {
  markOnboardingSeen?: boolean;
  completeOnboarding?: boolean;
};

function useMeUpdater() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateMePayload) =>
      fetchApi<{ ok: true }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useOnboarding() {
  const meQuery = useMe();
  const me = meQuery.data;
  const markSeenMutation = useMeUpdater();
  const completeMutation = useMeUpdater();

  return {
    isLoadingOnboarding: meQuery.isPending,
    hasSeenOnboarding: Boolean(me?.onboardingSeenAt),
    hasCompletedOnboarding: Boolean(me?.onboardingCompletedAt),
    onboardingSeenAt: me?.onboardingSeenAt ?? null,
    onboardingCompletedAt: me?.onboardingCompletedAt ?? null,
    markOnboardingSeen: () =>
      markSeenMutation.mutateAsync({ markOnboardingSeen: true }),
    completeOnboarding: () =>
      completeMutation.mutateAsync({ completeOnboarding: true }),
    isMarkingSeen: markSeenMutation.isPending,
    isCompletingOnboarding: completeMutation.isPending,
  };
}
