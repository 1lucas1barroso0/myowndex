import { accountRouteError, logoutAccount } from "../../../../server/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return await logoutAccount(request); }
  catch (error) { return accountRouteError(error); }
}
