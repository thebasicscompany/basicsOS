"use client";

import { useState } from "react";
import { cn } from "../lib/utils.js";
import { Button } from "./Button.js";

interface CodeBlockProps {
  /** Label displayed above the code block. */
  label?: string;
  /** Code content to display. */
  code: string;
  /** Additional className for the outer wrapper. */
  className?: string;
}

export const CodeBlock = ({ label, code, className }: CodeBlockProps): JSX.Element => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {label}
          </span>
        )}
        <div className={cn(!label && "ml-auto")}>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-sm bg-stone-900 p-4 text-xs text-stone-100 whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
};
