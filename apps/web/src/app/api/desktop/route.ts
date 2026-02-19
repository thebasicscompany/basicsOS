export const GET = (): Response =>
  Response.redirect(
    process.env["DESKTOP_DOWNLOAD_URL"] ?? "https://github.com/basicsos/basicsos/releases/latest",
  );
