import { Search, Video, Mic, Camera, Tabs, TabsList, TabsTrigger } from "@basicsos/ui";

type Tab = "ask" | "meetings" | "voice" | "capture";

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export const TabBar = ({ active, onChange }: TabBarProps): JSX.Element => (
  <div className="px-4 pb-3">
    <Tabs value={active} onValueChange={(v) => onChange(v as Tab)}>
      <TabsList className="w-full">
        <TabsTrigger value="ask" className="flex-1 gap-1.5 text-[11px]">
          <Search size={13} /> Ask
        </TabsTrigger>
        <TabsTrigger value="meetings" className="flex-1 gap-1.5 text-[11px]">
          <Video size={13} /> Meetings
        </TabsTrigger>
        <TabsTrigger value="voice" className="flex-1 gap-1.5 text-[11px]">
          <Mic size={13} /> Voice
        </TabsTrigger>
        <TabsTrigger value="capture" className="flex-1 gap-1.5 text-[11px]">
          <Camera size={13} /> Capture
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
);

export type { Tab };
