import { readFile } from "node:fs/promises";

const here = new URL("./", import.meta.url);
const read = name => readFile(new URL(name, here), "utf8");
const [generator, catalog, pokedex] = await Promise.all([
  read("atualizar-indice-gerador.py"),
  read("atualizar-catalogo-bilingue.py"),
  read("atualizar-descricoes-pokedex.py"),
]);

const pin = (source, name) => {
  const match = source.match(new RegExp(`^\\s*${name}\\s*=\\s*['"]([0-9a-f]{40})['"]`, "m"));
  if (!match) throw new Error(`Não foi possível localizar ${name}.`);
  return match[1];
};

const pokePins = new Set([pin(generator, "PIN"), pin(catalog, "PIN"), pin(pokedex, "API_SHA")]);
if (pokePins.size !== 1) throw new Error("Os scripts usam commits PokeAPI diferentes.");
const POKEAPI_PIN = [...pokePins][0];
const POKEMINERS_PIN = pin(pokedex, "GO_SHA");
const SHOWDOWN_PIN = pin(catalog, "SHOWDOWN_PIN");

const sources = [
  {
    repository: "PokeAPI/pokeapi",
    branch: "master",
    pin: POKEAPI_PIN,
    paths: [
      "data/v2/csv/pokemon_species.csv",
      "data/v2/csv/pokemon.csv",
      "data/v2/csv/pokemon_forms.csv",
      "data/v2/csv/types.csv",
      "data/v2/csv/pokemon_types.csv",
      "data/v2/csv/pokemon_types_past.csv",
      "data/v2/csv/versions.csv",
      "data/v2/csv/version_groups.csv",
      "data/v2/csv/pokemon_species_names.csv",
      "data/v2/csv/pokemon_species_flavor_text.csv",
      "data/v2/csv/ability_names.csv",
      "data/v2/csv/ability_prose.csv",
      "data/v2/csv/abilities.csv",
      "data/v2/csv/ability_flavor_text.csv",
      "data/v2/csv/move_names.csv",
      "data/v2/csv/move_effect_prose.csv",
      "data/v2/csv/moves.csv",
      "data/v2/csv/move_flavor_text.csv",
      "data/v2/csv/item_names.csv",
      "data/v2/csv/item_prose.csv",
      "data/v2/csv/items.csv",
      "data/v2/csv/item_flavor_text.csv",
      "data/v2/csv/type_names.csv",
    ],
  },
  {
    repository: "PokeMiners/pogo_assets",
    branch: "master",
    pin: POKEMINERS_PIN,
    paths: [
      "Texts/Latest APK/English.txt",
      "Texts/Latest APK/BrazilianPortuguese.txt",
      "Texts/Latest Remote/English.txt",
      "Texts/Latest Remote/BrazilianPortuguese.txt",
    ],
  },
  {
    repository: "smogon/pokemon-showdown",
    branch: "master",
    pin: SHOWDOWN_PIN,
    paths: [
      "data/text/abilities.ts",
      "data/text/moves.ts",
      "data/text/items.ts",
      "data/moves.ts",
      "data/mods/gen1/moves.ts",
      "data/mods/gen2/moves.ts",
      "data/mods/gen3/moves.ts",
      "data/mods/gen4/moves.ts",
      "data/mods/gen5/moves.ts",
      "data/mods/gen6/moves.ts",
      "data/mods/gen7/moves.ts",
      "data/mods/gen8/moves.ts",
      "data/mods/champions/moves.ts",
      "data/mods/gen7letsgo/moves.ts",
      "data/mods/gen8bdsp/moves.ts",
      "data/mods/gen3/scripts.ts",
    ],
  },
];

const token = process.env.GITHUB_TOKEN?.trim();
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "myowndex-source-freshness",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const encodePath = path => path.split("/").map(encodeURIComponent).join("/");
const sourceFile = async ({ repository, path, ref }) => {
  const url = `https://api.github.com/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${repository}/${path} @ ${ref}: HTTP ${response.status}`);
  const value = await response.json();
  if (Array.isArray(value) || typeof value?.sha !== "string") throw new Error(`${repository}/${path}: resposta sem blob SHA.`);
  return {
    sha: value.sha,
    text: typeof value.content === "string" ? Buffer.from(value.content.replace(/\n/g, ""), "base64").toString("utf8") : "",
  };
};

const literalMoveMetadata = source => {
  const values = [];
  let current = "";
  for (const line of source.split(/\r?\n/)) {
    const opened = line.match(/^\t([a-z0-9]+): \{$/);
    if (opened) {
      current = opened[1];
      continue;
    }
    if (!current) continue;
    const field = line.match(/^\t\t(accuracy|basePower|category|pp|priority|target|type): (true|-?\d+|"(?:[^"\\]|\\.)*"),$/);
    if (field) values.push(`${current}:${field[1]}=${field[2]}`);
  }
  return values.join("\n");
};

const relevantSource = (path, text) => {
  if (path === "data/mods/gen3/scripts.ts") {
    return text.match(/const specialTypes = \[[^\]]+\]/)?.[0] || "";
  }
  if (path === "data/moves.ts" || /^data\/mods\/[^/]+\/moves\.ts$/.test(path)) {
    return literalMoveMetadata(text);
  }
  return null;
};

const tasks = sources.flatMap(source => source.paths.map(path => ({ ...source, path })));
const stale = [];
let cursor = 0;

const worker = async () => {
  while (cursor < tasks.length) {
    const task = tasks[cursor++];
    const [pinned, current] = await Promise.all([
      sourceFile({ ...task, ref: task.pin }),
      sourceFile({ ...task, ref: task.branch }),
    ]);
    if (pinned.sha === current.sha) continue;
    const pinnedRelevant = relevantSource(task.path, pinned.text);
    const currentRelevant = relevantSource(task.path, current.text);
    const semanticallyCurrent = pinnedRelevant !== null && currentRelevant !== null && pinnedRelevant === currentRelevant;
    if (!semanticallyCurrent) stale.push({
      repository: task.repository,
      path: task.path,
      pin: task.pin,
      pinnedSha: pinned.sha,
      currentSha: current.sha,
    });
  }
};

await Promise.all(Array.from({ length: Math.min(6, tasks.length) }, worker));

if (stale.length) {
  console.error("Fontes versionadas mudaram no upstream. Atualize, regenere e valide antes de continuar chamando esses dados de atuais:");
  for (const item of stale) console.error(`- ${item.repository}/${item.path} (${item.pinnedSha} -> ${item.currentSha})`);
  process.exitCode = 1;
} else {
  console.log(`Fontes atuais: ${tasks.length} arquivos relevantes continuam idênticos ou semanticamente equivalentes aos pins versionados.`);
}
