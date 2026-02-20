import { useState } from "react";
import { Sparkles, Kbd } from "@basicsos/ui";
import { TabBar } from "./components/TabBar";
import type { Tab } from "./components/TabBar";
import { AskTab } from "./tabs/AskTab";
import { MeetingsTab } from "./tabs/MeetingsTab";
import { VoiceTab } from "./tabs/VoiceTab";
import { CaptureTab } from "./tabs/CaptureTab";
import { sendIPC } from "./lib/ipc";

export const OverlayApp = (): JSX.Element => {
  const [tab, setTab] = useState<Tab>("ask");

  const handleMouseEnter = (): void => {
    sendIPC("set-ignore-mouse", false);
  };
  const handleMouseLeave = (): void => {
    sendIPC("set-ignore-mouse", true);
  };

  return (
    <div className="p-3">
      <div
        className="flex flex-col text-stone-900 select-none rounded-[20px] overflow-hidden bg-white/92 backdrop-blur-2xl backdrop-saturate-150 shadow-overlay"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Drag handle + Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-2.5" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white flex-shrink-0">
            <Sparkles size={14} />
          </div>
          <span className="text-[13px] font-semibold text-stone-800 tracking-tight">Basics OS</span>
          <Kbd className="ml-auto" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {navigator.platform.includes("Mac") ? "\u2318\u21e7Space" : "Ctrl+Shift+Space"}
          </Kbd>
        </div>

        {/* Tab bar */}
        <TabBar active={tab} onChange={setTab} />

        {/* Tab content */}
        <div className="overflow-y-auto flex-1" style={{ maxHeight: "340px" }}>
          {tab === "ask" && <AskTab />}
          {tab === "meetings" && <MeetingsTab />}
          {tab === "voice" && <VoiceTab />}
          {tab === "capture" && <CaptureTab />}
        </div>
      </div>
    </div>
  );
};
