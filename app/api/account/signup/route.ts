import { accountRouteError, signupAccount } from "../../../../server/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return await signupAccount(request); }
  catch (error) { return accountRouteError(error); }
}
