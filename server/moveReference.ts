import { AuthoritativeActionError } from "./authoritativeActions.js";
import { getCurrentMoveReference } from "../src/core/championsMoves.js";

export type PokeApiMove = { name?: string; priority?: number } & Record<string, unknown>;

/** Both declarations and rolls consult the same accepted move reference. */
export const fetchServerMove = async (name: string): Promise<PokeApiMove | null> => {
  if (!name) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`, {
      headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) throw new AuthoritativeActionError("A Pokédex não conseguiu confirmar este movimento agora.", 502);
    const move = getCurrentMoveReference(await response.json()) as PokeApiMove | null;
    if (!move || move.name !== name) throw new AuthoritativeActionError("A Pokédex não conseguiu confirmar este movimento agora.", 502);
    return move;
  } catch (error) {
    if (error instanceof AuthoritativeActionError) throw error;
    throw new AuthoritativeActionError("A Pokédex não conseguiu confirmar este movimento agora.", 502);
  } finally {
    clearTimeout(timeout);
  }
};
