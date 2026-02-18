import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// GET /api/branding — returns tenant branding config
// Desktop and mobile apps call this on first launch to get the company name, logo, and accent color
export const GET = (_req: NextRequest): NextResponse => {
  const branding = {
    companyName: process.env["BASICOS_COMPANY_NAME"] ?? "Basics OS",
    logoUrl: process.env["BASICOS_LOGO_URL"] ?? null,
    accentColor: process.env["BASICOS_ACCENT_COLOR"] ?? "#6366f1",
    apiUrl: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001",
    mcpUrl: process.env["BASICOS_MCP_URL"] ?? "http://localhost:4000",
  };
  return NextResponse.json(branding);
};
