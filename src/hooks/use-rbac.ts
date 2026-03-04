import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type RbacRole = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
};

export type RbacUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  disabled: boolean;
  roles: Array<{ key: string; name: string }>;
};

export function useRbacRoles(enabled = true) {
  return useQuery({
    queryKey: ["rbac_roles"],
    queryFn: () => fetchApi<RbacRole[]>("/api/rbac/roles"),
    enabled,
  });
}

export function useRbacUsers(enabled = true) {
  return useQuery({
    queryKey: ["rbac_users"],
    queryFn: () => fetchApi<RbacUser[]>("/api/rbac/users"),
    enabled,
  });
}

export function useAssignRbacRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { crmUserId: number; roleKey: string }) =>
      fetchApi<{ ok: true }>(`/api/rbac/users/${args.crmUserId}/roles`, {
        method: "PUT",
        body: JSON.stringify({ roleKeys: [args.roleKey] }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rbac_users"] });
    },
  });
}
