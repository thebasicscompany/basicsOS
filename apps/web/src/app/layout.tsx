import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Lora } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/providers/TRPCProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@basicsos/ui";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Basics OS",
  description: "Company Operating System",
  icons: { icon: "/icon.svg" },
};

// Next.js App Router requires default exports for layout/page segments.
// This is a framework-mandated exception to the project's named-export rule.
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element => (
  <html lang="en" className={`${sans.variable} ${serif.variable}`}>
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
