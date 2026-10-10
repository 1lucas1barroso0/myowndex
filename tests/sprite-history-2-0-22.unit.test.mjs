import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("2.0.22 sprite archives keep their exact old manifest and 2.0.23 adds only Silicobra", async () => {
  const index=JSON.parse(await readFile(new URL("../assets/sprites-2d/index.json",import.meta.url)));
  const original=index.shards.slice(0,113);
  assert.equal(original.length,113);
  assert.equal(original.reduce((sum,shard)=>sum+shard.files.length,0),2609);
  assert.equal(original.reduce((sum,shard)=>sum+shard.files.reduce((n,f)=>n+f.bytes,0),0),71284820);
  assert.equal(createHash("sha256").update(JSON.stringify(original)).digest("hex"),
    "7a0dda14804a7a90fe163026c9514dcce86e306ec358c0980431418bad2532cb");
  assert.equal(index.shards[113]?.file,"sprites-2d-113.zip");
  assert.equal(index.shards[113]?.files.length,8);
  assert.equal(index.shards[113]?.sha256,"37ffdf6dc367875a2a0835eef033d938bfc99cab9633481fc2d54193427ee96a");
  assert.equal(index.entries,2617);
  assert.equal(index.bytes,71628959);
});
