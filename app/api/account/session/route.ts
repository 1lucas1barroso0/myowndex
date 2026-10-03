import { accountRouteError, accountSessionResponse } from "../../../../server/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try { return await accountSessionResponse(request); }
  catch (error) { return accountRouteError(error); }
}
