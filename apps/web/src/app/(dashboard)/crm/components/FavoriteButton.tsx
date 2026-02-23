"use client";

import { trpc } from "@/lib/trpc";
import { Button, Star, addToast, cn } from "@basicsos/ui";

type FavoriteEntity = "contact" | "company" | "deal";

interface FavoriteButtonProps {
  entity: FavoriteEntity;
  recordId: string;
}

export const FavoriteButton = ({ entity, recordId }: FavoriteButtonProps): JSX.Element => {
  const utils = trpc.useUtils();

  const { data: favorites } = trpc.crm.favorites.list.useQuery();

  const isFavorited =
    favorites?.some((f) => f.entity === entity && f.recordId === recordId) ?? false;

  const toggle = trpc.crm.favorites.toggle.useMutation({
    onSuccess: (result) => {
      void utils.crm.favorites.list.invalidate();
      addToast({
        title: result.favorited ? "Added to favorites" : "Removed from favorites",
        variant: "success",
      });
    },
    onError: (err) => {
      addToast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleClick = (): void => {
    toggle.mutate({ entity, recordId });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      onClick={handleClick}
      disabled={toggle.isPending}
      className={cn(
        "size-8 transition-colors",
        isFavorited
          ? "text-amber-500 hover:text-amber-600"
          : "text-stone-400 hover:text-amber-500",
      )}
    >
      <Star
        size={16}
        className={cn(isFavorited && "fill-current")}
      />
    </Button>
  );
};
