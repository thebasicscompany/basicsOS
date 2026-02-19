import { useState } from "react";
import { Sparkles } from "lucide-react";
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
    <div className="h-screen bg-transparent">
      <div
        className="bg-white/92 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col text-stone-900 select-none border border-stone-200/60"
        style={{ boxShadow: "0 20px 40px rgba(28,25,23,0.12), 0 8px 16px rgba(28,25,23,0.06)" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white flex-shrink-0">
            <Sparkles size={14} />
          </div>
          <span className="text-sm font-semibold text-stone-900">Basics OS</span>
          <kbd className="ml-auto text-[10px] text-stone-400 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded font-mono">
            {navigator.platform.includes("Mac") ? "\u2318\u21e7Space" : "Ctrl+Shift+Space"}
          </kbd>
        </div>

        {/* Tab bar */}
        <TabBar active={tab} onChange={setTab} />

        {/* Tab content */}
        <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
          {tab === "ask" && <AskTab />}
          {tab === "meetings" && <MeetingsTab />}
          {tab === "voice" && <VoiceTab />}
          {tab === "capture" && <CaptureTab />}
        </div>
      </div>
    </div>
  );
};
