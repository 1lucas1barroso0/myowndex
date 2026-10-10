import packageInfo from "../../../package.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// A public, read-only freshness signal, deliberately excluded from SW caching.
// Its release number comes from the same package as the visible footer.
export function GET(): Response {
  return Response.json(
    { version: packageInfo.version, revision: process.env.VERCEL_GIT_COMMIT_SHA || packageInfo.version },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
