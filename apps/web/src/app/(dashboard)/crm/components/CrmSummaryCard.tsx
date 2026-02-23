"use client";

import {
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  Button,
  Separator,
} from "@basicsos/ui";
import { Mail, Phone, Pencil, Trash2 } from "@basicsos/ui";
import { nameToColor } from "../utils";

interface CrmSummaryCardProps {
  name: string;
  subtitle?: string | undefined;
  subtitleNode?: React.ReactNode | undefined;
  avatarSize?: "sm" | "lg" | undefined;
  showEmailAction?: boolean | undefined;
  showCallAction?: boolean | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  editTrigger?: React.ReactNode | undefined;
  onDelete?: (() => void) | undefined;
}

export function CrmSummaryCard({
  name,
  subtitle,
  subtitleNode,
  avatarSize = "lg",
  showEmailAction = false,
  showCallAction = false,
  email,
  phone,
  editTrigger,
  onDelete,
}: CrmSummaryCardProps): JSX.Element {
  const sizeClass = avatarSize === "lg" ? "size-16" : "size-12";
  const textSize = avatarSize === "lg" ? "text-xl" : "text-base";

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-6">
        <Avatar className={sizeClass}>
          <AvatarFallback className={`${textSize} font-semibold ${nameToColor(name)}`}>
            {name[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{name}</p>
          {subtitleNode ?? (subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>)}
        </div>
        <Separator />
        <div className="flex flex-wrap items-center gap-2">
          {showEmailAction && email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${email}`}><Mail size={14} className="mr-1.5" /> Email</a>
            </Button>
          )}
          {showCallAction && phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${phone}`}><Phone size={14} className="mr-1.5" /> Call</a>
            </Button>
          )}
          {editTrigger}
          {onDelete && (
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 size={14} className="mr-1.5" /> Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
