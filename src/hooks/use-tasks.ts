import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, create, update, remove } from "@/lib/api/crm";
import { mapRecords, unmapRecord } from "@/lib/crm/field-mapper";

export interface Task {
  id: number;
  contactId: number | null;
  companyId: number | null;
  crmUserId: number | null;
  assigneeId: number | null;
  type: string | null;
  text: string | null;
  description: string | null;
  dueDate: string | null;
  doneDate: string | null;
}

export interface CreateTaskData {
  contactId?: number;
  companyId?: number;
  assigneeId?: number;
  type?: string;
  text: string;
  description?: string;
  dueDate?: string;
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const result = await getList<Record<string, unknown>>("tasks", {
        sort: { field: "due_date", order: "ASC" },
        pagination: { page: 1, perPage: 500 },
      });
      return { data: mapRecords(result.data) as Task[], total: result.total };
    },
  });
}

export function useMarkTaskDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      update<Task>("tasks", id, {
        doneDate: done ? new Date().toISOString() : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => remove<Task>("tasks", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<
      CreateTaskData & { doneDate: string | null }
    >) =>
      update<Task>("tasks", id, unmapRecord(data as Record<string, unknown>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskData) =>
      create<Task>("tasks", unmapRecord(data as Record<string, unknown>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
    },
  });
}
