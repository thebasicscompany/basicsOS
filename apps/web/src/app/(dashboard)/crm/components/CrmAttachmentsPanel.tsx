"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  EmptyState,
  addToast,
  File,
  FileText,
  Image,
  Paperclip,
  X,
  Upload,
} from "@basicsos/ui";

interface CrmAttachmentsPanelProps {
  entity: "contact" | "company" | "deal";
  recordId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): React.ComponentType<{ className?: string }> {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

interface UploadingFile {
  name: string;
  progress: "uploading" | "confirming";
}

export function CrmAttachmentsPanel({ entity, recordId }: CrmAttachmentsPanelProps): JSX.Element {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const { data: attachments, isLoading } = trpc.crm.attachments.list.useQuery({
    entity,
    recordId,
  });

  const getUploadUrl = trpc.crm.attachments.getUploadUrl.useMutation();
  const confirmUpload = trpc.crm.attachments.confirmUpload.useMutation();
  const deleteAttachment = trpc.crm.attachments.delete.useMutation({
    onSuccess: () => {
      void utils.crm.attachments.list.invalidate({ entity, recordId });
    },
    onError: (err) => {
      addToast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFiles = async (files: FileList): Promise<void> => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      setUploadingFiles((prev) => [...prev, { name: file.name, progress: "uploading" }]);

      try {
        const { uploadUrl, storageKey } = await getUploadUrl.mutateAsync({
          entity,
          recordId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        setUploadingFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, progress: "confirming" } : f)),
        );

        await confirmUpload.mutateAsync({
          entity,
          recordId,
          filename: file.name,
          storageKey,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        });

        void utils.crm.attachments.list.invalidate({ entity, recordId });
        addToast({ title: `${file.name} uploaded`, variant: "success" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        addToast({ title: "Upload failed", description: message, variant: "destructive" });
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      }
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  const attachmentList = attachments ?? [];
  const count = attachmentList.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Attachments</CardTitle>
          {count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {count}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-stone-600"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFiles.length > 0}
        >
          <Upload size={13} />
          Attach
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileInputChange}
        />
      </CardHeader>

      <CardContent className="pt-0">
        {uploadingFiles.length > 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            {uploadingFiles.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-2 rounded-md bg-stone-100 px-3 py-2 text-xs text-stone-600"
              >
                <Upload size={12} className="animate-pulse shrink-0" />
                <span className="truncate flex-1">{f.name}</span>
                <span className="shrink-0 text-stone-400">
                  {f.progress === "uploading" ? "Uploading…" : "Saving…"}
                </span>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <p className="py-4 text-center text-xs text-stone-400">Loading…</p>
        )}

        {!isLoading && attachmentList.length === 0 && uploadingFiles.length === 0 && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="rounded-lg border-2 border-dashed border-stone-200 py-8 text-center"
          >
            <EmptyState
              Icon={Paperclip}
              heading="No attachments yet"
              description="Drag and drop files or click Attach above."
            />
          </div>
        )}

        {!isLoading && attachmentList.length > 0 && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="flex flex-col gap-1"
          >
            {attachmentList.map((attachment) => {
              const FileIcon = getFileIcon(attachment.mimeType);
              const uploadedDate = new Date(attachment.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={attachment.id}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-stone-100">
                    <FileIcon className="size-4 text-stone-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {attachment.filename}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {formatBytes(attachment.sizeBytes)} · {uploadedDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500"
                    onClick={() => deleteAttachment.mutate({ id: attachment.id })}
                    aria-label={`Delete ${attachment.filename}`}
                  >
                    <X size={14} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
