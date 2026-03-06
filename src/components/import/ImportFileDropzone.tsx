import { UploadSimpleIcon } from "@phosphor-icons/react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { parseCSVFile, type ParsedCSV } from "./import-utils";

export interface ImportFileDropzoneProps {
  onParsed: (data: ParsedCSV) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export function ImportFileDropzone({
  onParsed,
  onError,
  disabled,
}: ImportFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        onError?.("Please select a .csv file.");
        return;
      }
      try {
        const result = await parseCSVFile(file);
        onParsed(result);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Failed to parse file.");
      }
    },
    [onParsed, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileSelect = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted/50 p-12 text-center transition-colors hover:bg-muted/70"
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <UploadSimpleIcon className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[13px] font-medium">
          Drop a CSV file here, or click to browse
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Supports .csv files with contact data (max 5MB, 2000 rows)
        </p>
      </div>
      <input
        ref={(el) => {
          inputRef.current = el;
        }}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleInputChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="mt-1 h-7 gap-1.5 text-[13px]"
        onClick={handleFileSelect}
        disabled={disabled}
      >
        <UploadSimpleIcon className="size-3.5" />
        Choose file
      </Button>
    </div>
  );
}
