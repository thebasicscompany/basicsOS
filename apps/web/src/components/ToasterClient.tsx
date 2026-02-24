"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(
  () => import("@basicsos/ui").then((m) => ({ default: m.Toaster })),
  { ssr: false },
);

export function ToasterClient(): JSX.Element {
  return <Toaster />;
}
