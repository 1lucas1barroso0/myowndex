import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { materializeSprites } from '../scripts/materializar-sprites-2d.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const asset = (text, extension = 'apng') => {
    const bytes = Buffer.from(text);
    return { name: `2d-${sha(bytes).slice(0, 24)}.${extension}`, bytes };
};
const first = asset('authored animation A');
const second = asset('authored animation B', 'gif');

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(tmpdir(), 'myowndex-sprite-packaging-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function fixture(t, { images = [first], archiveImages = images, archive } = {}) {
    const directory = temporaryDirectory(t);
    const archiveDirectory = path.join(directory, 'archives');
    const destination = path.join(directory, 'native');
    fs.mkdirSync(archiveDirectory);
    const zipped = archive || Buffer.from(zipSync(Object.fromEntries(archiveImages.map(image => [image.name, image.bytes])), {
        level: 6, mtime: new Date('1980-01-01T00:00:00Z'),
    }));
    const shard = {
        file: 'sprites-2d-000.zip', bytes: zipped.length, sha256: sha(zipped),
        files: images.map(image => ({ name: image.name, bytes: image.bytes.length, sha256: sha(image.bytes) })),
    };
    const manifest = { schemaVersion: 1, entries: images.length, bytes: images.reduce((sum, image) => sum + image.bytes.length, 0), shards: [shard] };
    const manifestPath = path.join(archiveDirectory, 'index.json');
    const writeManifest = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    writeManifest();
    fs.writeFileSync(path.join(archiveDirectory, shard.file), zipped);
    return { directory, manifest, writeManifest, manifestPath, archiveDirectory, destination,
        run: options => materializeSprites({ manifestPath, archiveDirectory, destination, ...options }) };
}

function assertNoImages(destination) {
    assert.deepEqual(fs.existsSync(destination) ? fs.readdirSync(destination) : [], []);
}

test('a fresh checkout reconstructs every packaged image with the original bytes and is idempotent', t => {
    const destination = path.join(temporaryDirectory(t), 'fresh', 'public', 'sprites', 'native');
    const manifestPath = path.join(root, 'assets/sprites-2d/index.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const result = materializeSprites({ manifestPath, destination });
    assert.deepEqual(result, { images: manifest.entries, bytes: manifest.bytes, written: manifest.entries });
    assert.equal(fs.readdirSync(destination).length, manifest.entries);
    for (const shard of manifest.shards) for (const entry of shard.files) {
        const bytes = fs.readFileSync(path.join(destination, entry.name));
        assert.equal(bytes.length, entry.bytes, entry.name);
        assert.equal(sha(bytes), entry.sha256, entry.name);
        assert.equal(entry.name.slice(3, 27), entry.sha256.slice(0, 24), 'public URLs retain their content-addressed identity');
    }
    const sample = path.join(destination, manifest.shards[0].files[0].name);
    const before = fs.statSync(sample);
    assert.deepEqual(materializeSprites({ manifestPath, destination, checkOnly: true }), { ...result, written: 0 });
    assert.deepEqual(materializeSprites({ manifestPath, destination }), { ...result, written: 0 });
    assert.equal(fs.statSync(sample).mtimeMs, before.mtimeMs, 'verified images are not rewritten');
});

test('repair replaces only a corrupted generated image and leaves legacy sprites and attribution intact', t => {
    const files = fixture(t, { images: [first, second] });
    files.run();
    const legacy = path.join(files.destination, 'legacy.gif');
    const attribution = path.join(files.destination, 'provenance-2d.json');
    fs.writeFileSync(legacy, 'legacy artwork');
    fs.writeFileSync(attribution, 'authorship records');
    const intact = fs.statSync(path.join(files.destination, second.name));
    fs.writeFileSync(path.join(files.destination, first.name), 'damaged');
    assert.throws(() => files.run({ checkOnly: true }), /imagem ausente ou corrompida/);
    assert.deepEqual(files.run(), { images: 2, bytes: first.bytes.length + second.bytes.length, written: 1 });
    assert.deepEqual(fs.readFileSync(path.join(files.destination, first.name)), first.bytes);
    assert.equal(fs.statSync(path.join(files.destination, second.name)).mtimeMs, intact.mtimeMs);
    assert.equal(fs.readFileSync(legacy, 'utf8'), 'legacy artwork');
    assert.equal(fs.readFileSync(attribution, 'utf8'), 'authorship records');
    assert.equal(fs.readdirSync(files.destination).some(name => name.endsWith('.tmp')), false);
});

test('check-only never creates a missing destination or changes corrupt files', t => {
    const files = fixture(t);
    assert.throws(() => files.run({ checkOnly: true }), /pasta de destino está ausente/);
    assert.equal(fs.existsSync(files.destination), false);
    fs.mkdirSync(files.destination);
    const target = path.join(files.destination, first.name);
    fs.writeFileSync(target, 'damaged');
    assert.throws(() => files.run({ checkOnly: true }), /imagem ausente ou corrompida/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'damaged');
});

test('a corrupted or truncated archive is rejected before any image is written', t => {
    for (const corruption of ['byte', 'truncate']) {
        const files = fixture(t);
        const archivePath = path.join(files.archiveDirectory, files.manifest.shards[0].file);
        const bytes = fs.readFileSync(archivePath);
        if (corruption === 'byte') bytes[bytes.length >> 1] ^= 0xff;
        fs.writeFileSync(archivePath, corruption === 'truncate' ? bytes.subarray(0, bytes.length - 10) : bytes);
        assert.throws(() => files.run(), /pacote corrompido/);
        assertNoImages(files.destination);
    }
});

test('an invalid ZIP whose checksum matches its manifest still cannot write files', t => {
    const files = fixture(t, { archive: Buffer.from('this is not a ZIP') });
    assert.throws(() => files.run());
    assertNoImages(files.destination);
});

test('a wrong image checksum rejects the whole shard before its first valid image is written', t => {
    const files = fixture(t, { images: [first, second] });
    files.manifest.shards[0].files[1].sha256 = '0'.repeat(64);
    files.writeManifest();
    assert.throws(() => files.run(), /imagem corrompida/);
    assertNoImages(files.destination);
});

test('missing, extra and case-mismatched archive entries cannot become incomplete sprite installs', t => {
    for (const archiveImages of [
        [first],
        [first, second, asset('unexpected extra', 'png')],
        [first, { ...second, name: second.name.toUpperCase() }],
    ]) {
        const files = fixture(t, { images: [first, second], archiveImages });
        assert.throws(() => files.run(), /ZIP (?:incompleto|contém)/);
        assertNoImages(files.destination);
    }
});

test('duplicate ZIP names are rejected before fflate can silently overwrite an entry', t => {
    const duplicate = asset('authored animation C');
    const original = Buffer.from(zipSync({ [first.name]: first.bytes, [duplicate.name]: duplicate.bytes }));
    const find = Buffer.from(duplicate.name);
    const replacement = Buffer.from(first.name);
    assert.equal(find.length, replacement.length);
    let position = 0;
    let replaced = 0;
    while ((position = original.indexOf(find, position)) !== -1) {
        replacement.copy(original, position);
        position += find.length;
        replaced++;
    }
    assert.equal(replaced, 2, 'both local and central directory records are renamed');
    const files = fixture(t, { images: [first, duplicate], archive: original });
    assert.throws(() => files.run(), /imagem extra ou repetida/);
    assertNoImages(files.destination);
});

test('ZIP traversal, absolute paths and Windows separators never escape the destination', t => {
    for (const name of [`../${first.name}`, `/${first.name}`, `..\\${first.name}`, `nested/${first.name}`]) {
        const files = fixture(t, { archiveImages: [{ ...first, name }] });
        assert.throws(() => files.run(), /ZIP contém caminho/);
        assertNoImages(files.destination);
        assert.equal(fs.existsSync(path.join(files.directory, first.name)), false);
    }
});

test('manifest traversal, duplicate images, inconsistent totals and oversized entries fail before filesystem writes', t => {
    for (const alter of [
        manifest => { manifest.shards[0].file = '../sprites-2d-000.zip'; },
        manifest => { manifest.shards[0].files[0].name = `../${first.name}`; },
        manifest => { manifest.shards[0].files.push({ ...manifest.shards[0].files[0] }); },
        manifest => { manifest.entries++; },
        manifest => { manifest.bytes++; },
        manifest => { manifest.shards[0].files[0].bytes = 1024 * 1024 + 1; },
        manifest => { manifest.shards[0].bytes = 2 * 1024 * 1024 + 1; },
        manifest => { manifest.shards.push({ ...manifest.shards[0] }); },
    ]) {
        const files = fixture(t);
        alter(files.manifest);
        files.writeManifest();
        assert.throws(() => files.run(), /Sprites 2D:/);
        assert.equal(fs.existsSync(files.destination), false);
    }
});

test('the ZIP original-size declaration is checked before decompression', t => {
    const files = fixture(t, { archiveImages: [{ ...first, bytes: Buffer.from('a different uncompressed length') }] });
    assert.throws(() => files.run(), /tamanho da imagem no ZIP divergente/);
    assertNoImages(files.destination);
});

test('destination symlinks, including dangling ancestor links, are never followed', t => {
    for (const dangling of [false, true]) {
        const files = fixture(t);
        const outside = path.join(files.directory, 'outside');
        if (!dangling) fs.mkdirSync(outside);
        fs.symlinkSync(outside, files.destination, 'dir');
        assert.throws(() => files.run(), /sem links simbólicos/);
        assert.equal(fs.lstatSync(files.destination).isSymbolicLink(), true);
        assert.equal(fs.existsSync(outside), !dangling);
        if (!dangling) assert.deepEqual(fs.readdirSync(outside), []);
    }
    const files = fixture(t);
    const outside = path.join(files.directory, 'outside');
    fs.mkdirSync(outside);
    const link = path.join(files.directory, 'linked-parent');
    fs.symlinkSync(outside, link, 'dir');
    assert.throws(() => materializeSprites({ ...files, destination: path.join(link, 'new', 'native') }), /sem links simbólicos/);
    assert.deepEqual(fs.readdirSync(outside), [], 'no mkdir may run through a symlink ancestor');
});

test('image and archive symlinks are rejected without modifying their targets', t => {
    const files = fixture(t);
    fs.mkdirSync(files.destination);
    const outside = path.join(files.directory, 'outside-image');
    fs.writeFileSync(outside, 'private unrelated content');
    fs.symlinkSync(outside, path.join(files.destination, first.name));
    assert.throws(() => files.run(), /imagem de destino precisa ser um arquivo real/);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'private unrelated content');
    fs.unlinkSync(path.join(files.destination, first.name));
    fs.symlinkSync(path.join(files.directory, 'missing-target'), path.join(files.destination, first.name));
    assert.throws(() => files.run(), /imagem de destino precisa ser um arquivo real/);
    assert.equal(fs.existsSync(path.join(files.directory, 'missing-target')), false);

    const linkedArchive = fixture(t);
    const archivePath = path.join(linkedArchive.archiveDirectory, linkedArchive.manifest.shards[0].file);
    const moved = path.join(linkedArchive.directory, 'outside.zip');
    fs.renameSync(archivePath, moved);
    fs.symlinkSync(moved, archivePath);
    assert.throws(() => linkedArchive.run(), /pacote precisa ser um arquivo real/);
    assertNoImages(linkedArchive.destination);
});

test('a temporary-file collision cannot erase a file that this execution did not create', t => {
    const files = fixture(t);
    fs.mkdirSync(files.destination);
    const temporary = path.join(files.destination, `${first.name}.${process.pid}.tmp`);
    fs.writeFileSync(temporary, 'preexisting temporary content');
    assert.throws(() => files.run(), { code: 'EEXIST' });
    assert.equal(fs.readFileSync(temporary, 'utf8'), 'preexisting temporary content');
    assert.equal(fs.existsSync(path.join(files.destination, first.name)), false);
});

test('npm dev, test and build materialize sprites before running their existing commands', () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
    assert.equal(scripts['sprites:prepare'], 'node scripts/materializar-sprites-2d.mjs');
    for (const command of ['dev', 'test', 'build']) assert.equal(scripts[`pre${command}`], 'npm run sprites:prepare');
});
