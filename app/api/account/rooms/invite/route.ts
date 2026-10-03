import { accountRouteError } from "../../../../../server/accounts";
import { regenerateAccountRoomInvite } from "../../../../../server/accountsRooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return await regenerateAccountRoomInvite(request); }
  catch (error) { return accountRouteError(error); }
}
