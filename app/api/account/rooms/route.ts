import { accountRouteError } from "../../../../server/accounts";
import { bindAccountRoom, listAccountRooms, unlinkAccountRoom } from "../../../../server/accountsRooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try { return await listAccountRooms(request); }
  catch (error) { return accountRouteError(error); }
}

export async function POST(request: Request) {
  try { return await bindAccountRoom(request); }
  catch (error) { return accountRouteError(error); }
}

export async function DELETE(request: Request) {
  try { return await unlinkAccountRoom(request); }
  catch (error) { return accountRouteError(error); }
}
