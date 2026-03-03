import { useCallback, useState } from "react";
import { Upload, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/contexts/page-header";

export function ImportPage() {
  usePageTitle("Import");
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Future: handle CSV file drop
  }, []);

  const handleFileSelect = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = () => {
      // Future: handle CSV file selection
    };
    input.click();
  }, []);

  return (
    <div className="flex h-full flex-col overflow-auto py-4">
      <p className="mb-4 text-[12px] text-muted-foreground">
        Import contacts from a CSV file
      </p>

      <div className="max-w-lg space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center transition-colors ${
            isDragging
              ? "border-primary/50 bg-primary/5"
              : "border-border bg-muted/30"
          }`}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Upload className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[13px] font-medium">
              Drop a CSV file here, or click to browse
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Supports .csv files with contact data
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-7 gap-1.5 text-[13px]"
            onClick={handleFileSelect}
          >
            <FileUp className="size-3.5" />
            Choose file
          </Button>
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-[12px] font-medium">Expected format</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            CSV with headers: First Name, Last Name, Email, Phone, Company, Title
          </p>
        </div>
      </div>
    </div>
  );
}

ImportPage.path = "/import";
