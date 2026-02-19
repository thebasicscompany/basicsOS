import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/providers/TRPCProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@basicsos/ui";

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
      <TRPCProvider>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </TRPCProvider>
    </body>
  </html>
);

export default RootLayout;
