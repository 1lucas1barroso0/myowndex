import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fileName = /^2d-[a-f0-9]{24}\.(?:gif|apng|png)$/;
const shardName = /^sprites-2d-\d{3}\.zip$/;
const positive = value => Number.isSafeInteger(value) && value > 0;
const requireValid = (condition, message) => { if (!condition) throw new Error(`Sprites 2D: ${message}`); };

function safeDirectory(directory, create = true) {
    const ancestors = [];
    for (let current = path.resolve(directory); ; current = path.dirname(current)) {
        ancestors.unshift(current);
        if (current === path.dirname(current)) break;
    }
    for (const current of ancestors) {
        try { fs.lstatSync(current); } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            requireValid(create, 'a pasta de destino está ausente.');
            fs.mkdirSync(current);
        }
        const stat = fs.lstatSync(current);
        requireValid(stat.isDirectory() && !stat.isSymbolicLink(), 'o destino precisa ser uma pasta real, sem links simbólicos.');
    }
}

/** Expand the verified source packages, retaining every image byte and URL. */
export function materializeSprites({
    manifestPath = path.join(root, 'assets/sprites-2d/index.json'),
    archiveDirectory = path.dirname(manifestPath),
    destination = path.join(root, 'public/sprites/native'),
    checkOnly = false,
} = {}) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    requireValid(manifest.schemaVersion === 1 && Array.isArray(manifest.shards), 'manifesto inválido.');
    requireValid(positive(manifest.entries) && manifest.entries <= 10000 && positive(manifest.bytes) && manifest.bytes <= 96 * 1024 * 1024, 'limites do manifesto inválidos.');
    const names = new Set(), shards = new Set();
    let totalBytes = 0;
    for (const shard of manifest.shards) {
        requireValid(shardName.test(shard.file) && !shards.has(shard.file), 'pacote inválido ou repetido.');
        shards.add(shard.file);
        requireValid(positive(shard.bytes) && shard.bytes <= 2 * 1024 * 1024 && /^[a-f0-9]{64}$/.test(shard.sha256) && Array.isArray(shard.files) && shard.files.length > 0, 'metadados do pacote inválidos.');
        let shardBytes = 0;
        for (const entry of shard.files) {
            requireValid(fileName.test(entry.name) && !names.has(entry.name), 'imagem inválida ou repetida.');
            requireValid(positive(entry.bytes) && entry.bytes <= 1024 * 1024 && /^[a-f0-9]{64}$/.test(entry.sha256), 'metadados da imagem inválidos.');
            names.add(entry.name); shardBytes += entry.bytes;
        }
        requireValid(shardBytes <= 2 * 1024 * 1024, 'pacote descompactado excede o limite.');
        totalBytes += shardBytes;
    }
    requireValid(names.size === manifest.entries && totalBytes === manifest.bytes, 'contagem ou tamanho total divergente.');
    safeDirectory(destination, !checkOnly);
    let written = 0;
    for (const shard of manifest.shards) {
        const archivePath = path.join(archiveDirectory, shard.file);
        requireValid(fs.lstatSync(archivePath).isFile() && !fs.lstatSync(archivePath).isSymbolicLink(), 'pacote precisa ser um arquivo real.');
        const archive = fs.readFileSync(archivePath);
        requireValid(archive.length === shard.bytes && digest(archive) === shard.sha256, `pacote corrompido: ${shard.file}.`);
        const expected = new Map(shard.files.map(entry => [entry.name, entry]));
        const found = new Set();
        const images = unzipSync(archive, { filter: file => {
            requireValid(expected.has(file.name) && !found.has(file.name), 'ZIP contém caminho, imagem extra ou repetida.');
            requireValid(file.originalSize === expected.get(file.name).bytes, 'tamanho da imagem no ZIP divergente.');
            found.add(file.name); return true;
        } });
        requireValid(found.size === expected.size, 'ZIP incompleto.');
        // Validate the entire shard before any image from it is written.
        for (const entry of shard.files) {
            const image = images[entry.name];
            requireValid(image?.length === entry.bytes && digest(image) === entry.sha256, `imagem corrompida: ${entry.name}.`);
        }
        for (const entry of shard.files) {
            const target = path.join(destination, entry.name);
            let correct = false;
            let stat;
            try { stat = fs.lstatSync(target); } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
            if (stat) {
                requireValid(stat.isFile() && !stat.isSymbolicLink(), 'imagem de destino precisa ser um arquivo real.');
                correct = stat.size === entry.bytes && digest(fs.readFileSync(target)) === entry.sha256;
            }
            if (correct) continue;
            requireValid(!checkOnly, `imagem ausente ou corrompida: ${entry.name}.`);
            const temporary = `${target}.${process.pid}.tmp`;
            let descriptor;
            let ownsTemporary = false;
            try {
                descriptor = fs.openSync(temporary, 'wx', 0o644);
                ownsTemporary = true;
                fs.writeFileSync(descriptor, images[entry.name]);
                fs.closeSync(descriptor);
                descriptor = undefined;
                fs.renameSync(temporary, target);
            } finally {
                if (descriptor !== undefined) fs.closeSync(descriptor);
                if (ownsTemporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
            }
            written++;
        }
    }
    return { images: names.size, bytes: totalBytes, written };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const result = materializeSprites({ checkOnly: process.argv.includes('--check') });
    console.log(`Sprites 2D: ${result.images} imagens verificadas; ${result.written} materializadas.`);
}
