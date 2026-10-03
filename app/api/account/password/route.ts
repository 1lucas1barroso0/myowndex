import { accountRouteError, changeAccountPassword } from "../../../../server/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return await changeAccountPassword(request); }
  catch (error) { return accountRouteError(error); }
}
