import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/providers/TRPCProvider";

export const metadata: Metadata = {
  title: "Basics OS",
  description: "Company Operating System",
};

// Next.js App Router requires default exports for layout/page segments.
// This is a framework-mandated exception to the project's named-export rule.
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element => (
  <html lang="en">
    <body>
      <TRPCProvider>{children}</TRPCProvider>
    </body>
  </html>
);

export default RootLayout;
