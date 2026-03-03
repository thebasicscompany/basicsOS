"use client";

import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePageTitle } from "@/contexts/page-header";
import { ConnectionsContent } from "@/components/connections";

export function ConnectionsPage() {
  usePageTitle("Connections");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      const name = connected.charAt(0).toUpperCase() + connected.slice(1);
      toast.success(`${name} connected!`);
      setSearchParams({}, { replace: true });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    }
  }, [searchParams, setSearchParams, queryClient]);

  return <ConnectionsContent />;
}
