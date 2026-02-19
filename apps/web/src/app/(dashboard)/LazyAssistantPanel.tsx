"use client";

import dynamic from "next/dynamic";

const AssistantPanel = dynamic(
  () => import("./AssistantPanel").then((m) => m.AssistantPanel),
  { ssr: false },
);

export const LazyAssistantPanel = (): JSX.Element => <AssistantPanel />;
