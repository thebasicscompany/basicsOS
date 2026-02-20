import { auth } from "@basicsos/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { createLogger } from "@basicsos/shared";
import type { NextRequest } from "next/server";

const logger = createLogger("auth-route");

// Mount Better Auth handler at /api/auth/* for all HTTP methods.
const handlers = toNextJsHandler(auth);

// Wrap handlers with error logging
export const GET = async (req: NextRequest): Promise<Response> => {
  try {
    const response = await handlers.GET(req);
    return response;
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        method: "GET",
        url: req.url,
        pathname: req.nextUrl.pathname,
      },
      "Auth GET handler error",
    );
    throw error;
  }
};

export const POST = async (req: NextRequest): Promise<Response> => {
  try {
    // Log the request details for debugging
    const body = await req.clone().text().catch(() => "");
    logger.debug(
      {
        method: "POST",
        url: req.url,
        pathname: req.nextUrl.pathname,
        hasBody: body.length > 0,
      },
      "Auth POST request",
    );

    const response = await handlers.POST(req);
    return response;
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        method: "POST",
        url: req.url,
        pathname: req.nextUrl.pathname,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      "Auth POST handler error",
    );
    throw error;
  }
};
