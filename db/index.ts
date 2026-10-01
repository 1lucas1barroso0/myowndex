import { getRuntimeBindings } from "../server/runtime";

export function getDb() {
  return getRuntimeBindings().db;
}
