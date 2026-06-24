import { useState } from "react";
import { ChatCircleIcon } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RecordChatTab } from "@/components/record-detail";

/** Floating chat-bubble (bottom-right) that opens an assistant SCOPED to this
 * grid/object: ask about the data, bulk-import a CSV (auto-adding columns),
 * add/update/delete records — all on this object. */
export function GridChatBubble({
  objectSlug,
  singular,
  plural,
}: {
  objectSlug: string;
  singular: string;
  plural?: string;
}) {
  const [open, setOpen] = useState(false);
  const pluralLc = (plural || `${singular}s`).toLowerCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Chat about your ${pluralLc}`}
        aria-label="Open grid assistant"
        className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChatCircleIcon className="size-6" weight="fill" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 p-5 sm:max-w-md">
          <SheetHeader className="space-y-0 pr-6">
            <SheetTitle>{singular} grid assistant</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <RecordChatTab objectSlug={objectSlug} singular={singular} plural={plural} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
