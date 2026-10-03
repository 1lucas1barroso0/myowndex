import { accountRouteError, deletePreviousAccountDocument, getAccountDocument, putAccountDocument } from "../../../../server/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try { return await getAccountDocument(request); }
  catch (error) { return accountRouteError(error); }
}

export async function PUT(request: Request) {
  try { return await putAccountDocument(request); }
  catch (error) { return accountRouteError(error); }
}

export async function DELETE(request: Request) {
  try { return await deletePreviousAccountDocument(request); }
  catch (error) { return accountRouteError(error); }
}
