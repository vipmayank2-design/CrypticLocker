'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const MAGIC_HEADER = Buffer.from('CLVAULT1', 'utf8'); // 8 bytes: 0x43 0x4C 0x56 0x41 0x55 0x4C 0x54 0x31
const FORMAT_VERSION = 1;
const ZERO_HASH_BUF = Buffer.alloc(32, 0);
const ZERO_HASH_HEX = ZERO_HASH_BUF.toString('hex');
let STREAM_CHUNK_SIZE = 512 * 1024; // 512 KB default for high-throughput streaming

function getStreamChunkSize() {
    return STREAM_CHUNK_SIZE;
}

function setStreamChunkSize(sizeBytes) {
    if (typeof sizeBytes === 'number' && sizeBytes >= 64 * 1024 && sizeBytes <= 64 * 1024 * 1024) {
        STREAM_CHUNK_SIZE = sizeBytes;
    }
}

/**
 * Scan directory recursively and collect all relative file paths.
 */
async function collectFilesRecursively(dir, baseDir = dir) {
    let results = [];
    try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await collectFilesRecursively(fullPath, baseDir);
                results.push(...subFiles);
            } else if (entry.isFile()) {
                const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                results.push({ fullPath, relativePath });
            }
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
    return results;
}

/**
 * Move or copy directory safely, with retry and fallback for Windows file locking.
 */
async function moveDirectory(src, dest) {
    try {
        await fsp.rm(dest, { recursive: true, force: true });
    } catch { }

    try {
        await fsp.rename(src, dest);
        return;
    } catch (err) {
        if (err.code !== 'EPERM' && err.code !== 'EACCES' && err.code !== 'EXDEV') {
            throw err;
        }
    }

    // Windows retry delay
    await new Promise(resolve => setTimeout(resolve, 80));
    try {
        await fsp.rename(src, dest);
        return;
    } catch { }

    // Fallback to recursive copy + delete
    await fsp.cp(src, dest, { recursive: true });
    await fsp.rm(src, { recursive: true, force: true });
}

/**
 * Export a vault directory into a single .clvault package using pure streaming I/O.
 * Starts instantly (0ms delay) by avoiding duplicate disk-read passes on large files.
 * The overall package integrity is cryptographically sealed by the 32-byte SHA-256 footer checksum.
 *
 * @param {string} vaultDirectory - Path to local vault directory (<userData>/vault)
 * @param {string} outputFilePath - Target path for the .clvault file
 * @param {string|null} settingsFilePath - Optional path to settings.json
 * @param {Function|null} onProgress - Callback for progress events
 * @param {Function|null} isCancelled - Predicate checking if operation was cancelled
 * @returns {Promise<{success: boolean, fileCount: number, totalBytes: number, outputPath: string}>}
 */
async function exportVaultPackage(vaultDirectory, outputFilePath, settingsFilePath = null, onProgress = null) /* isCancelled = null */ {
    const isCancelled = typeof arguments[4] === 'function' ? arguments[4] : null;
    if (!vaultDirectory || typeof vaultDirectory !== 'string') {
        throw new Error('Vault directory path is required.');
    }
    if (!outputFilePath || typeof outputFilePath !== 'string') {
        throw new Error('Output file path is required.');
    }

    if (isCancelled && isCancelled()) {
        const err = new Error('Operation cancelled');
        err.code = 'OPERATION_CANCELLED';
        throw err;
    }

    // Verify vault.json exists
    const vaultConfigPath = path.join(vaultDirectory, 'vault.json');
    try {
        await fsp.access(vaultConfigPath);
    } catch {
        throw new Error('Vault configuration (vault.json) not found in vault directory.');
    }

    // Collect all files in vault directory
    const files = await collectFilesRecursively(vaultDirectory);
    if (files.length === 0) {
        throw new Error('Vault directory is empty.');
    }

    // Pre-calculate total bytes instantly via fsp.stat (milliseconds only)
    const entries = [];
    let totalPayloadBytes = 0;

    for (const file of files) {
        if (isCancelled && isCancelled()) {
            const err = new Error('Operation cancelled');
            err.code = 'OPERATION_CANCELLED';
            throw err;
        }

        const stats = await fsp.stat(file.fullPath);
        let hash = ZERO_HASH_HEX;
        let buffer = null;

        // For small metadata files (< 1MB, e.g. vault.json, index.clm), hash in memory instantly
        if (stats.size < 1024 * 1024) {
            buffer = await fsp.readFile(file.fullPath);
            hash = crypto.createHash('sha256').update(buffer).digest('hex');
        }

        entries.push({
            path: file.relativePath,
            size: stats.size,
            sha256: hash,
            fullPath: file.fullPath,
            buffer
        });
        totalPayloadBytes += stats.size;
    }

    // Include settings.json if provided and present
    let exportedSettings = null;
    if (settingsFilePath && typeof settingsFilePath === 'string') {
        try {
            const settingsStats = await fsp.stat(settingsFilePath);
            const settingsData = await fsp.readFile(settingsFilePath);
            const settingsHash = crypto.createHash('sha256').update(settingsData).digest('hex');
            exportedSettings = JSON.parse(settingsData.toString('utf8'));
            entries.push({
                path: 'settings.json',
                size: settingsStats.size,
                sha256: settingsHash,
                buffer: settingsData,
                fullPath: null
            });
            totalPayloadBytes += settingsStats.size;
        } catch {
            // Optional file, ignore if missing
        }
    }

    // Sort entries deterministically: vault.json first, then index.clm, then others alphabetically
    entries.sort((a, b) => {
        if (a.path === 'vault.json') return -1;
        if (b.path === 'vault.json') return 1;
        if (a.path === 'index.clm') return -1;
        if (b.path === 'index.clm') return 1;
        if (a.path === 'settings.json') return -1;
        if (b.path === 'settings.json') return 1;
        return a.path.localeCompare(b.path);
    });

    // Build manifest
    const manifestObj = {
        format: 'CLVAULT1',
        version: FORMAT_VERSION,
        appVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        fileCount: entries.length,
        totalBytes: totalPayloadBytes,
        settings: exportedSettings,
        entries: entries.map(e => ({
            path: e.path,
            size: e.size,
            sha256: e.sha256
        }))
    };

    const manifestJson = JSON.stringify(manifestObj);
    const manifestBuffer = Buffer.from(manifestJson, 'utf8');

    // Create temp output file and streaming writer
    const tempPath = outputFilePath + '.tmp_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    await fsp.mkdir(path.dirname(tempPath), { recursive: true });
    const writeStream = fs.createWriteStream(tempPath, { highWaterMark: STREAM_CHUNK_SIZE });
    const archiveHash = crypto.createHash('sha256');
    let totalArchiveBytes = 0;

    function writeChunk(chunk) {
        if (isCancelled && isCancelled()) {
            const err = new Error('Operation cancelled');
            err.code = 'OPERATION_CANCELLED';
            return Promise.reject(err);
        }
        archiveHash.update(chunk);
        totalArchiveBytes += chunk.length;
        if (!writeStream.write(chunk)) {
            return new Promise(resolve => writeStream.once('drain', resolve));
        }
        return Promise.resolve();
    }

    let processedBytes = 0;
    let completedFiles = 0;
    const startTime = Date.now();
    let lastEmitTime = 0;

    function emitExportProgress(currentFile, isFileCompleted = false) {
        if (typeof onProgress !== 'function') return;
        const now = Date.now();
        if (!isFileCompleted && now - lastEmitTime < 80) return;
        lastEmitTime = now;

        const elapsedSeconds = Math.max(0.1, (now - startTime) / 1000);
        const speed = Math.round(processedBytes / elapsedSeconds);
        const remainingBytes = Math.max(0, totalPayloadBytes - processedBytes);
        const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;

        onProgress({
            operation: 'export',
            status: isFileCompleted ? 'file-completed' : 'progress',
            name: path.basename(outputFilePath),
            currentFile,
            processedBytes,
            totalBytes: totalPayloadBytes,
            completedFiles,
            totalFiles: entries.length,
            speedBytesPerSecond: speed,
            etaSeconds: eta
        });
    }

    // Emit started event with actual total payload size known immediately!
    if (typeof onProgress === 'function') {
        onProgress({
            operation: 'export',
            status: 'started',
            name: path.basename(outputFilePath),
            currentFile: entries[0]?.path || 'Packaging vault...',
            processedBytes: 0,
            totalBytes: totalPayloadBytes,
            completedFiles: 0,
            totalFiles: entries.length,
            speedBytesPerSecond: 0,
            etaSeconds: 0
        });
    }

    try {
        // 1. Header: Magic (8 bytes)
        await writeChunk(MAGIC_HEADER);

        // 2. Version (4 bytes)
        const versionBuf = Buffer.alloc(4);
        versionBuf.writeUInt32BE(FORMAT_VERSION, 0);
        await writeChunk(versionBuf);

        // 3. Manifest Length (4 bytes)
        const manifestLenBuf = Buffer.alloc(4);
        manifestLenBuf.writeUInt32BE(manifestBuffer.length, 0);
        await writeChunk(manifestLenBuf);

        // 4. Manifest JSON (N bytes)
        await writeChunk(manifestBuffer);

        // 5. Stream Entries
        for (const entry of entries) {
            if (isCancelled && isCancelled()) {
                const err = new Error('Operation cancelled');
                err.code = 'OPERATION_CANCELLED';
                throw err;
            }

            emitExportProgress(entry.path, false);

            const pathBuf = Buffer.from(entry.path, 'utf8');
            const pathLenBuf = Buffer.alloc(2);
            pathLenBuf.writeUInt16BE(pathBuf.length, 0);
            await writeChunk(pathLenBuf);
            await writeChunk(pathBuf);

            const sizeBuf = Buffer.alloc(8);
            sizeBuf.writeBigUInt64BE(BigInt(entry.size), 0);
            await writeChunk(sizeBuf);

            const hashBuf = Buffer.from(entry.sha256, 'hex');
            await writeChunk(hashBuf);

            if (entry.buffer) {
                await writeChunk(entry.buffer);
                processedBytes += entry.buffer.length;
            } else if (entry.fullPath && entry.size > 0) {
                await new Promise((resolve, reject) => {
                    const readStream = fs.createReadStream(entry.fullPath, { highWaterMark: STREAM_CHUNK_SIZE });
                    readStream.on('data', chunk => {
                        if (isCancelled && isCancelled()) {
                            readStream.destroy();
                            const err = new Error('Operation cancelled');
                            err.code = 'OPERATION_CANCELLED';
                            return reject(err);
                        }
                        archiveHash.update(chunk);
                        totalArchiveBytes += chunk.length;
                        processedBytes += chunk.length;
                        emitExportProgress(entry.path, false);
                        if (!writeStream.write(chunk)) {
                            readStream.pause();
                            writeStream.once('drain', () => readStream.resume());
                        }
                    });
                    readStream.on('end', resolve);
                    readStream.on('error', reject);
                });
            }

            completedFiles++;
            emitExportProgress(entry.path, true);
        }

        // 6. Footer: SHA256 of all preceding bytes (32 bytes)
        const archiveChecksum = archiveHash.digest();
        totalArchiveBytes += 32;

        await new Promise((resolve, reject) => {
            writeStream.end(archiveChecksum, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Atomic replace
        await fsp.rename(tempPath, outputFilePath);

        if (typeof onProgress === 'function') {
            onProgress({
                operation: 'export',
                status: 'completed',
                name: path.basename(outputFilePath),
                currentFile: 'Vault exported successfully.',
                processedBytes: totalPayloadBytes,
                totalBytes: totalPayloadBytes,
                completedFiles: entries.length,
                totalFiles: entries.length,
                speedBytesPerSecond: 0,
                etaSeconds: 0
            });
        }

        return {
            success: true,
            fileCount: entries.length,
            totalBytes: totalArchiveBytes,
            outputPath: outputFilePath
        };
    } catch (err) {
        writeStream.destroy();
        // All-or-Nothing Rollback: delete temp file immediately
        try {
            await fsp.unlink(tempPath);
        } catch { }
        try {
            await fsp.unlink(outputFilePath);
        } catch { }
        throw err;
    }
}

/**
 * Validate and safely unpack a .clvault package into the target vault directory using pure streaming.
 * Supports cancellation with all-or-nothing rollback (immediate deletion of temporary staging directory).
 *
 * @param {string} packagePath - Path to the .clvault file
 * @param {string} targetVaultDirectory - Destination vault directory (<userData>/vault)
 * @param {string|null} targetSettingsFilePath - Destination for settings.json (<userData>/settings.json)
 * @param {Function|null} onProgress - Callback for progress events
 * @param {Function|null} isCancelled - Predicate checking if operation was cancelled
 * @returns {Promise<{success: boolean, fileCount: number, totalBytes: number, theme: string}>}
 */
async function validateAndExtractVaultPackage(packagePath, targetVaultDirectory, targetSettingsFilePath = null, onProgress = null) {
    const isCancelled = typeof arguments[4] === 'function' ? arguments[4] : null;
    if (!packagePath || typeof packagePath !== 'string') {
        throw new Error('Package path is required.');
    }
    if (!targetVaultDirectory || typeof targetVaultDirectory !== 'string') {
        throw new Error('Target vault directory path is required.');
    }

    if (isCancelled && isCancelled()) {
        const err = new Error('Operation cancelled');
        err.code = 'OPERATION_CANCELLED';
        throw err;
    }

    // Shield: Ensure target vault does NOT already exist and contain files
    let existsAndHasFiles = false;
    try {
        const existingEntries = await fsp.readdir(targetVaultDirectory);
        if (existingEntries.length > 0) {
            const hasVaultJson = existingEntries.includes('vault.json');
            const hasFilesDir = existingEntries.includes('files');
            if (hasVaultJson || hasFilesDir) {
                existsAndHasFiles = true;
            }
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }

    if (existsAndHasFiles) {
        throw new Error('A vault already exists. Delete your current vault before importing.');
    }

    let packageStats;
    try {
        packageStats = await fsp.stat(packagePath);
    } catch (err) {
        throw new Error(`Unable to read vault package file: ${err.message}`);
    }

    if (packageStats.size < 50) {
        throw new Error('Invalid vault package: file is too small or corrupted.');
    }

    const totalPackageSize = packageStats.size;
    const bodyLength = totalPackageSize - 32;

    if (typeof onProgress === 'function') {
        onProgress({
            operation: 'import',
            status: 'started',
            name: path.basename(packagePath),
            currentFile: 'Verifying package integrity...',
            processedBytes: 0,
            totalBytes: totalPackageSize,
            completedFiles: 0,
            totalFiles: 1,
            speedBytesPerSecond: 0,
            etaSeconds: 0
        });
    }

    const fileHandle = await fsp.open(packagePath, 'r');

    try {
        // 1. Check Magic Header (8 bytes)
        const headerBuf = Buffer.alloc(16);
        await fileHandle.read(headerBuf, 0, 16, 0);

        const fileMagic = headerBuf.subarray(0, 8);
        if (!fileMagic.equals(MAGIC_HEADER)) {
            throw new Error('Invalid vault package: unrecognized file signature. Only .clvault files created by CrypticLocker are supported.');
        }

        // 2. Check Format Version (4 bytes)
        const version = headerBuf.readUInt32BE(8);
        if (version !== FORMAT_VERSION) {
            throw new Error(`Unsupported vault package version (${version}). Please update CrypticLocker.`);
        }

        // 3. Read Manifest Length (4 bytes)
        const manifestLength = headerBuf.readUInt32BE(12);
        if (manifestLength <= 0 || manifestLength > bodyLength - 16) {
            throw new Error('Invalid vault package: corrupted manifest header.');
        }

        // 4. Read Manifest JSON
        const manifestBuf = Buffer.alloc(manifestLength);
        await fileHandle.read(manifestBuf, 0, manifestLength, 16);

        let manifest;
        try {
            const manifestJson = manifestBuf.toString('utf8');
            manifest = JSON.parse(manifestJson);
        } catch {
            throw new Error('Invalid vault package: corrupted manifest metadata.');
        }

        if (manifest.format !== 'CLVAULT1' || manifest.version !== FORMAT_VERSION || !Array.isArray(manifest.entries)) {
            throw new Error('Invalid vault package: incompatible manifest structure.');
        }

        const hasVaultConfig = manifest.entries.some(e => e.path === 'vault.json');
        if (!hasVaultConfig) {
            throw new Error('Invalid vault package: missing critical security file (vault.json).');
        }

        for (const entry of manifest.entries) {
            if (!entry.path || typeof entry.path !== 'string') {
                throw new Error('Security violation: invalid entry path in vault package.');
            }

            const normalized = path.posix.normalize(entry.path);
            if (
                normalized.startsWith('..') ||
                path.isAbsolute(entry.path) ||
                entry.path.includes('\\') ||
                entry.path.includes(':') ||
                entry.path.includes('\0')
            ) {
                throw new Error(`Security violation: illegal path detected in vault package ("${entry.path}").`);
            }
        }

        if (isCancelled && isCancelled()) {
            const err = new Error('Operation cancelled');
            err.code = 'OPERATION_CANCELLED';
            throw err;
        }

        // 5. Verify Archive Footer Checksum via 512 KB Streaming Read
        const expectedChecksum = Buffer.alloc(32);
        await fileHandle.read(expectedChecksum, 0, 32, bodyLength);

        let verifiedBytes = 0;
        const verifyStart = Date.now();
        let lastVerifyEmit = 0;

        const archiveHash = crypto.createHash('sha256');
        await new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(packagePath, {
                start: 0,
                end: bodyLength - 1,
                highWaterMark: STREAM_CHUNK_SIZE
            });
            readStream.on('data', chunk => {
                if (isCancelled && isCancelled()) {
                    readStream.destroy();
                    const err = new Error('Operation cancelled');
                    err.code = 'OPERATION_CANCELLED';
                    return reject(err);
                }
                archiveHash.update(chunk);
                verifiedBytes += chunk.length;
                const now = Date.now();
                if (now - lastVerifyEmit >= 80 && typeof onProgress === 'function') {
                    lastVerifyEmit = now;
                    const elapsed = Math.max(0.1, (now - verifyStart) / 1000);
                    const speed = Math.round(verifiedBytes / elapsed);
                    onProgress({
                        operation: 'import',
                        status: 'progress',
                        name: path.basename(packagePath),
                        currentFile: 'Verifying package integrity...',
                        processedBytes: verifiedBytes,
                        totalBytes: totalPackageSize,
                        completedFiles: 0,
                        totalFiles: manifest.entries.length,
                        speedBytesPerSecond: speed,
                        etaSeconds: speed > 0 ? Math.round((totalPackageSize - verifiedBytes) / speed) : 0
                    });
                }
            });
            readStream.on('end', resolve);
            readStream.on('error', reject);
        });

        const calculatedChecksum = archiveHash.digest();
        if (!crypto.timingSafeEqual(expectedChecksum, calculatedChecksum)) {
            throw new Error('Vault package integrity check failed: file is corrupted or has been tampered with.');
        }

        // 6. Create temporary staging directory to unpack
        const stagingDir = path.join(
            path.dirname(targetVaultDirectory),
            '.clvault_import_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex')
        );
        await fsp.mkdir(stagingDir, { recursive: true });

        try {
            let cursor = 16 + manifestLength;
            let unpackedBytes = 0;
            let completedFiles = 0;
            const unpackStart = Date.now();
            let lastUnpackEmit = 0;
            const totalPayloadBytes = manifest.totalBytes || totalPackageSize;

            for (const entry of manifest.entries) {
                if (isCancelled && isCancelled()) {
                    const err = new Error('Operation cancelled');
                    err.code = 'OPERATION_CANCELLED';
                    throw err;
                }

                if (cursor + 2 > bodyLength) {
                    throw new Error('Unexpected end of vault package reading path header.');
                }

                const pathLenBuf = Buffer.alloc(2);
                await fileHandle.read(pathLenBuf, 0, 2, cursor);
                const pathLen = pathLenBuf.readUInt16BE(0);
                cursor += 2;

                if (cursor + pathLen > bodyLength) {
                    throw new Error('Unexpected end of vault package reading path string.');
                }

                const pathBuf = Buffer.alloc(pathLen);
                await fileHandle.read(pathBuf, 0, pathLen, cursor);
                const entryPath = pathBuf.toString('utf8');
                cursor += pathLen;

                if (entryPath !== entry.path) {
                    throw new Error(`Package structure mismatch: expected "${entry.path}", found "${entryPath}".`);
                }

                if (cursor + 8 > bodyLength) {
                    throw new Error('Unexpected end of vault package reading file size.');
                }

                const sizeBuf = Buffer.alloc(8);
                await fileHandle.read(sizeBuf, 0, 8, cursor);
                const entrySize = Number(sizeBuf.readBigUInt64BE(0));
                cursor += 8;

                if (entrySize !== entry.size) {
                    throw new Error(`Package size mismatch for "${entry.path}".`);
                }

                if (cursor + 32 > bodyLength) {
                    throw new Error('Unexpected end of vault package reading checksum.');
                }

                const entryHashBuf = Buffer.alloc(32);
                await fileHandle.read(entryHashBuf, 0, 32, cursor);
                const expectedHashHex = entryHashBuf.toString('hex');
                cursor += 32;

                if (cursor + entrySize > bodyLength) {
                    throw new Error(`Unexpected end of vault package reading payload for "${entry.path}".`);
                }

                const destinationPath = path.join(stagingDir, entry.path);
                await fsp.mkdir(path.dirname(destinationPath), { recursive: true });

                if (entrySize > 0) {
                    const entryHasher = crypto.createHash('sha256');
                    await new Promise((resolve, reject) => {
                        const entryReadStream = fs.createReadStream(packagePath, {
                            start: cursor,
                            end: cursor + entrySize - 1,
                            highWaterMark: STREAM_CHUNK_SIZE
                        });
                        const entryWriteStream = fs.createWriteStream(destinationPath, { highWaterMark: STREAM_CHUNK_SIZE });
                        entryReadStream.on('data', chunk => {
                            if (isCancelled && isCancelled()) {
                                entryReadStream.destroy();
                                entryWriteStream.destroy();
                                const err = new Error('Operation cancelled');
                                err.code = 'OPERATION_CANCELLED';
                                return reject(err);
                            }
                            entryHasher.update(chunk);
                            unpackedBytes += chunk.length;
                            const now = Date.now();
                            if (now - lastUnpackEmit >= 80 && typeof onProgress === 'function') {
                                lastUnpackEmit = now;
                                const elapsed = Math.max(0.1, (now - unpackStart) / 1000);
                                const speed = Math.round(unpackedBytes / elapsed);
                                onProgress({
                                    operation: 'import',
                                    status: 'progress',
                                    name: path.basename(packagePath),
                                    currentFile: entry.path,
                                    processedBytes: unpackedBytes,
                                    totalBytes: totalPayloadBytes,
                                    completedFiles,
                                    totalFiles: manifest.entries.length,
                                    speedBytesPerSecond: speed,
                                    etaSeconds: speed > 0 ? Math.round((totalPayloadBytes - unpackedBytes) / speed) : 0
                                });
                            }
                        });
                        entryReadStream.pipe(entryWriteStream);
                        entryWriteStream.on('close', () => {
                            // If package has a non-zero hash, verify it; otherwise overall archive checksum has verified it
                            if (!entryHashBuf.equals(ZERO_HASH_BUF)) {
                                const calculatedHashHex = entryHasher.digest('hex');
                                if (calculatedHashHex !== expectedHashHex) {
                                    return reject(new Error(`Integrity check failed for file "${entry.path}": checksum mismatch.`));
                                }
                            }
                            resolve();
                        });
                        entryReadStream.on('error', reject);
                        entryWriteStream.on('error', reject);
                    });
                } else {
                    await fsp.writeFile(destinationPath, Buffer.alloc(0));
                }

                completedFiles++;
                cursor += entrySize;
            }

            await fileHandle.close();

            if (isCancelled && isCancelled()) {
                const err = new Error('Operation cancelled');
                err.code = 'OPERATION_CANCELLED';
                throw err;
            }

            // 7. Deep Structural & Cryptographic Validation
            const extractedConfigPath = path.join(stagingDir, 'vault.json');
            const rawConfig = await fsp.readFile(extractedConfigPath, 'utf8');
            let config;
            try {
                config = JSON.parse(rawConfig);
            } catch {
                throw new Error('Corrupted vault configuration: vault.json is not valid JSON.');
            }

            if (config.version !== 1 || config.format !== 'CLV2') {
                throw new Error('Unsupported vault specification or format in vault.json.');
            }

            if (
                !config.password ||
                typeof config.password.salt !== 'string' ||
                !config.password.vmk ||
                typeof config.password.vmk.iv !== 'string' ||
                typeof config.password.vmk.authTag !== 'string' ||
                typeof config.password.vmk.encrypted !== 'string'
            ) {
                throw new Error('Corrupted vault configuration: password authentication section is missing or malformed.');
            }

            if (
                !config.recovery ||
                typeof config.recovery.salt !== 'string' ||
                !config.recovery.vmk ||
                typeof config.recovery.vmk.iv !== 'string' ||
                typeof config.recovery.vmk.authTag !== 'string' ||
                typeof config.recovery.vmk.encrypted !== 'string' ||
                !config.recovery.key
            ) {
                throw new Error('Corrupted vault configuration: recovery key section is missing or malformed.');
            }

            const passwordSaltBuf = Buffer.from(config.password.salt, 'base64');
            const passwordIvBuf = Buffer.from(config.password.vmk.iv, 'base64');
            const passwordTagBuf = Buffer.from(config.password.vmk.authTag, 'base64');
            const passwordEncBuf = Buffer.from(config.password.vmk.encrypted, 'base64');

            if (
                passwordSaltBuf.length !== 32 ||
                passwordIvBuf.length !== 12 ||
                passwordTagBuf.length !== 16 ||
                passwordEncBuf.length !== 32
            ) {
                throw new Error('Corrupted vault configuration: cryptographic key parameters are invalid.');
            }

            const extractedIndexPath = path.join(stagingDir, 'index.clm');
            try {
                const indexHeader = Buffer.alloc(4);
                const fd = await fsp.open(extractedIndexPath, 'r');
                await fd.read(indexHeader, 0, 4, 0);
                await fd.close();

                if (indexHeader.toString('utf8') !== 'CLM1') {
                    throw new Error('Corrupted vault index: index.clm does not have a valid CLM1 header.');
                }
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
            }

            const extractedFilesDir = path.join(stagingDir, 'files');
            try {
                const fileEntries = await fsp.readdir(extractedFilesDir);
                for (const clvFile of fileEntries) {
                    if (clvFile.endsWith('.clv')) {
                        const clvPath = path.join(extractedFilesDir, clvFile);
                        const clvHeader = Buffer.alloc(4);
                        const fd = await fsp.open(clvPath, 'r');
                        await fd.read(clvHeader, 0, 4, 0);
                        await fd.close();

                        const magic = clvHeader.toString('utf8');
                        if (magic !== 'CLV1' && magic !== 'CLV2') {
                            throw new Error(`Corrupted container: "${clvFile}" does not have a valid CLV signature.`);
                        }
                    }
                }
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
            }

            let importedTheme = 'dark';
            let settingsToRestore = null;
            const stagedSettingsPath = path.join(stagingDir, 'settings.json');
            try {
                const rawSettings = await fsp.readFile(stagedSettingsPath, 'utf8');
                settingsToRestore = JSON.parse(rawSettings);
                await fsp.unlink(stagedSettingsPath);
            } catch {
                if (manifest.settings && typeof manifest.settings === 'object') {
                    settingsToRestore = manifest.settings;
                }
            }

            if (settingsToRestore && typeof settingsToRestore === 'object') {
                if (typeof settingsToRestore.theme === 'string') {
                    importedTheme = settingsToRestore.theme;
                }
                if (targetSettingsFilePath && typeof targetSettingsFilePath === 'string') {
                    await fsp.mkdir(path.dirname(targetSettingsFilePath), { recursive: true });
                    await fsp.writeFile(
                        targetSettingsFilePath,
                        JSON.stringify(settingsToRestore, null, 2),
                        'utf8'
                    );
                }
            }

            await fsp.mkdir(path.join(stagingDir, 'files'), { recursive: true });
            await fsp.mkdir(path.join(stagingDir, 'orphans'), { recursive: true });

            if (isCancelled && isCancelled()) {
                const err = new Error('Operation cancelled');
                err.code = 'OPERATION_CANCELLED';
                throw err;
            }

            // Atomic Commit: Move stagingDir to targetVaultDirectory
            await moveDirectory(stagingDir, targetVaultDirectory);

            if (typeof onProgress === 'function') {
                onProgress({
                    operation: 'import',
                    status: 'completed',
                    name: path.basename(packagePath),
                    currentFile: 'Vault imported successfully.',
                    processedBytes: totalPayloadBytes,
                    totalBytes: totalPayloadBytes,
                    completedFiles: manifest.entries.length,
                    totalFiles: manifest.entries.length,
                    speedBytesPerSecond: 0,
                    etaSeconds: 0
                });
            }

            return {
                success: true,
                fileCount: manifest.entries.length,
                totalBytes: manifest.totalBytes,
                theme: importedTheme
            };
        } catch (innerErr) {
            // All-or-Nothing Rollback: remove stagingDir completely
            try {
                await fsp.rm(stagingDir, { recursive: true, force: true });
            } catch { }
            throw innerErr;
        }
    } catch (err) {
        try {
            await fileHandle.close();
        } catch { }
        throw err;
    }
}

/**
 * Calculate adaptive hardware boost tiers based on system memory and CPU core count.
 * Scales dynamically from 1 GB lightweight devices up to multi-terabyte enterprise workstations.
 */
function calculateHardwareBoostTiers(totalRamBytes, cpuCores, activeId = 'tier1') {
    const totalRamGB = Math.max(1, Math.round(totalRamBytes / (1024 ** 3)));
    
    let baseSpeed = 25;
    let maxBadgeName = "Max Safe";
    let defaultBufferBytes = 512 * 1024;

    if (totalRamGB <= 6) {
        baseSpeed = 25;
        maxBadgeName = "Max Safe";
        defaultBufferBytes = 512 * 1024;
    } else if (totalRamGB <= 12) {
        baseSpeed = 50;
        maxBadgeName = "Turbo Boost";
        defaultBufferBytes = 1024 * 1024;
    } else if (totalRamGB <= 24) {
        baseSpeed = 100;
        maxBadgeName = "Ultra Engine";
        defaultBufferBytes = 2 * 1024 * 1024;
    } else if (totalRamGB <= 48) {
        baseSpeed = 150;
        maxBadgeName = "HyperDrive";
        defaultBufferBytes = 4 * 1024 * 1024;
    } else if (totalRamGB <= 96) {
        baseSpeed = 250;
        maxBadgeName = "Uncapped Ultra";
        defaultBufferBytes = 8 * 1024 * 1024;
    } else {
        baseSpeed = Math.min(1000, Math.max(250, Math.floor((totalRamGB / 64) * 250)));
        maxBadgeName = "Unrestricted Max";
        defaultBufferBytes = 16 * 1024 * 1024;
    }

    const tier1Speed = baseSpeed;
    const tier2Speed = Math.round(baseSpeed * 1.6);
    const tier3Speed = Math.round(baseSpeed * 2.3);

    const tierBuffers = {
        tier1: Math.max(512 * 1024, Math.min(defaultBufferBytes, 1 * 1024 * 1024)),
        tier2: Math.max(1024 * 1024, Math.min(defaultBufferBytes * 2, 4 * 1024 * 1024)),
        tier3: Math.max(2 * 1024 * 1024, Math.min(defaultBufferBytes * 3, 8 * 1024 * 1024)),
        tier4: Math.max(4 * 1024 * 1024, defaultBufferBytes * 4)
    };

    return {
        totalRamGB,
        cpuCores: cpuCores || 4,
        tiers: [
            { id: 'tier1', label: `${tier1Speed}+ MB/s`, bufferBytes: tierBuffers.tier1 },
            { id: 'tier2', label: `${tier2Speed}+ MB/s`, bufferBytes: tierBuffers.tier2 },
            { id: 'tier3', label: `${tier3Speed}+ MB/s`, bufferBytes: tierBuffers.tier3 },
            { id: 'tier4', label: maxBadgeName, bufferBytes: tierBuffers.tier4 }
        ],
        activeId: activeId || 'tier1'
    };
}

module.exports = {
    MAGIC_HEADER,
    FORMAT_VERSION,
    collectFilesRecursively,
    exportVaultPackage,
    validateAndExtractVaultPackage,
    getStreamChunkSize,
    setStreamChunkSize,
    calculateHardwareBoostTiers
};

