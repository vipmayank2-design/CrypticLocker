'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { getStreamChunkSize } = require('../vault/vaultPackage');

const CAPSULE_MAGIC = Buffer.from('CLCAP1.0', 'utf8'); // 8 bytes: 0x43 0x4C 0x43 0x41 0x50 0x31 0x2E 0x30
const VAULT_MAGIC = Buffer.from('CLVAULT1', 'utf8');
const CAPSULE_VERSION = 1;
const FILE_ENTRY_MAGIC = Buffer.from('CFIL', 'utf8'); // 4 bytes

/**
 * Derive a 32-byte AES-256 key from transfer password using Scrypt.
 */
function deriveTransferKey(password, salt) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Transfer password is required.');
    }
    return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
}

/**
 * Inspects a capsule package header and decrypts the manifest.
 * Validates format, rejects full vault packages, and returns item metadata.
 */
async function inspectCapsulePackage(packagePath, transferPassword = null) {
    let fileHandle = null;
    try {
        fileHandle = await fsp.open(packagePath, 'r');
        const headerBuf = Buffer.alloc(8);
        const { bytesRead } = await fileHandle.read(headerBuf, 0, 8, 0);
        if (bytesRead < 8) {
            return { valid: false, error: 'File is too small to be a valid CrypticLocker package.' };
        }

        // Format Isolation Check
        if (headerBuf.equals(VAULT_MAGIC)) {
            return {
                valid: false,
                isFullVault: true,
                error: 'This file is a Full Vault Backup (.clvault), not a Secure Capsule (.clpack). Full vault backups can only be restored on fresh setup.'
            };
        }

        if (!headerBuf.equals(CAPSULE_MAGIC)) {
            return {
                valid: false,
                error: 'Unrecognized file format. This is not a CrypticLocker Secure Capsule.'
            };
        }

        // Read version (1 byte) + Salt (32 bytes) + Manifest IV (12 bytes) + Manifest Len (4 bytes) = 49 bytes
        const metaBuf = Buffer.alloc(49);
        const { bytesRead: metaBytesRead } = await fileHandle.read(metaBuf, 0, 49, 8);
        if (metaBytesRead < 49) {
            return { valid: false, error: 'Corrupted capsule package header.' };
        }

        const version = metaBuf.readUInt8(0);
        if (version !== CAPSULE_VERSION) {
            return { valid: false, error: `Unsupported capsule version: ${version}` };
        }

        const salt = metaBuf.subarray(1, 33);
        const manifestIv = metaBuf.subarray(33, 45);
        const manifestCiphertextLen = metaBuf.readUInt32BE(45);

        if (manifestCiphertextLen <= 0 || manifestCiphertextLen > 10 * 1024 * 1024) {
            return { valid: false, error: 'Invalid manifest payload size.' };
        }

        // Read Manifest Ciphertext + Auth Tag (16 bytes)
        const manifestBuf = Buffer.alloc(manifestCiphertextLen);
        await fileHandle.read(manifestBuf, 0, manifestCiphertextLen, 8 + 49);

        const authTagBuf = Buffer.alloc(16);
        await fileHandle.read(authTagBuf, 0, 16, 8 + 49 + manifestCiphertextLen);

        if (!transferPassword) {
            // Password not yet provided, but format is valid
            return {
                valid: true,
                requiresPassword: true,
                format: 'CLCAP1.0',
                version
            };
        }

        // Attempt decryption with transfer password
        const transferKey = deriveTransferKey(transferPassword, salt);
        const decipher = crypto.createDecipheriv('aes-256-gcm', transferKey, manifestIv);
        decipher.setAAD(Buffer.from('CrypticLocker|Capsule|Manifest|1', 'utf8'));
        decipher.setAuthTag(authTagBuf);

        let decryptedJson;
        try {
            const decryptedBuf = Buffer.concat([
                decipher.update(manifestBuf),
                decipher.final()
            ]);
            decryptedJson = JSON.parse(decryptedBuf.toString('utf8'));
        } catch {
            return {
                valid: false,
                incorrectPassword: true,
                error: 'Incorrect transfer password or tampered capsule package.'
            };
        }

        return {
            valid: true,
            format: 'CLCAP1.0',
            version,
            fileCount: decryptedJson.totalFiles || (Array.isArray(decryptedJson.items) ? decryptedJson.items.length : 0),
            totalBytes: decryptedJson.totalBytes || 0,
            manifest: decryptedJson
        };
    } catch (err) {
        return { valid: false, error: err.message };
    } finally {
        if (fileHandle) {
            try { await fileHandle.close(); } catch { }
        }
    }
}

/**
 * Creates a `.clpack` Secure Capsule containing files/folders, encrypted with transferPassword.
 */
async function createCapsulePackage({
    sourceFiles,        // Array of { diskPath, name, size, relativePath, parentFolderName }
    transferPassword,
    destinationPath,
    onProgress = null,
    operationId = null,
    checkCancelled = null
}) {
    if (!sourceFiles || sourceFiles.length === 0) {
        throw new Error('No files provided to export.');
    }
    if (typeof transferPassword !== 'string' || transferPassword.length === 0) {
        throw new Error('Transfer password is required.');
    }

    const salt = crypto.randomBytes(32);
    const transferKey = deriveTransferKey(transferPassword, salt);

    const totalPayloadBytes = sourceFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const manifest = {
        version: CAPSULE_VERSION,
        createdAt: new Date().toISOString(),
        totalFiles: sourceFiles.length,
        totalBytes: totalPayloadBytes,
        items: sourceFiles.map(f => ({
            name: f.name,
            size: f.size,
            relativePath: f.relativePath || '',
            parentFolderName: f.parentFolderName || ''
        }))
    };

    const manifestPlaintext = Buffer.from(JSON.stringify(manifest), 'utf8');
    const manifestIv = crypto.randomBytes(12);
    const manifestCipher = crypto.createCipheriv('aes-256-gcm', transferKey, manifestIv);
    manifestCipher.setAAD(Buffer.from('CrypticLocker|Capsule|Manifest|1', 'utf8'));

    const manifestCiphertext = Buffer.concat([
        manifestCipher.update(manifestPlaintext),
        manifestCipher.final()
    ]);
    const manifestAuthTag = manifestCipher.getAuthTag();

    // Prepare temp write file
    const tempPackagePath = `${destinationPath}.tmp_${Date.now()}`;
    const outHandle = await fsp.open(tempPackagePath, 'w');

    let processedBytes = 0;
    const startTime = Date.now();

    try {
        // 1. Write MAGIC (8 bytes)
        await outHandle.write(CAPSULE_MAGIC);

        // 2. Write Version (1 byte)
        const verBuf = Buffer.alloc(1);
        verBuf.writeUInt8(CAPSULE_VERSION, 0);
        await outHandle.write(verBuf);

        // 3. Write Salt (32 bytes)
        await outHandle.write(salt);

        // 4. Write Manifest IV (12 bytes)
        await outHandle.write(manifestIv);

        // 5. Write Manifest Length (4 bytes uint32BE)
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(manifestCiphertext.length, 0);
        await outHandle.write(lenBuf);

        // 6. Write Manifest Ciphertext + Auth Tag (16 bytes)
        await outHandle.write(manifestCiphertext);
        await outHandle.write(manifestAuthTag);

        const chunkSize = getStreamChunkSize ? getStreamChunkSize() : 512 * 1024;

        // 7. Write Sequential File Payloads
        for (let i = 0; i < sourceFiles.length; i++) {
            if (checkCancelled && checkCancelled(operationId)) {
                throw new Error('OPERATION_CANCELLED');
            }

            const file = sourceFiles[i];
            const fileHeaderData = Buffer.from(JSON.stringify({
                name: file.name,
                size: file.size,
                relativePath: file.relativePath || '',
                parentFolderName: file.parentFolderName || ''
            }), 'utf8');

            const fileHeaderIv = crypto.randomBytes(12);
            const fileHeaderCipher = crypto.createCipheriv('aes-256-gcm', transferKey, fileHeaderIv);
            fileHeaderCipher.setAAD(Buffer.from(`CrypticLocker|Capsule|FileHeader|${i}`, 'utf8'));

            const fileHeaderCiphertext = Buffer.concat([
                fileHeaderCipher.update(fileHeaderData),
                fileHeaderCipher.final()
            ]);
            const fileHeaderAuthTag = fileHeaderCipher.getAuthTag();

            // Write File Magic (4 bytes)
            await outHandle.write(FILE_ENTRY_MAGIC);

            // Write File Header IV (12 bytes) + Length (4 bytes)
            await outHandle.write(fileHeaderIv);
            const fhLenBuf = Buffer.alloc(4);
            fhLenBuf.writeUInt32BE(fileHeaderCiphertext.length, 0);
            await outHandle.write(fhLenBuf);
            await outHandle.write(fileHeaderCiphertext);
            await outHandle.write(fileHeaderAuthTag);

            // Payload Cipher
            const payloadIv = crypto.randomBytes(12);
            const payloadCipher = crypto.createCipheriv('aes-256-gcm', transferKey, payloadIv);
            payloadCipher.setAAD(Buffer.from(`CrypticLocker|Capsule|Payload|${i}`, 'utf8'));

            await outHandle.write(payloadIv);

            // Payload Length placeholder (8 bytes BigUInt64BE)
            const payloadLenOffset = (await outHandle.stat()).size;
            const pLenBuf = Buffer.alloc(8);
            await outHandle.write(pLenBuf); // Will overwrite with real length

            const readHandle = await fsp.open(file.diskPath, 'r');
            let fileEncryptedBytes = 0;
            const readBuffer = Buffer.alloc(chunkSize);

            try {
                let position = 0;
                while (true) {
                    if (checkCancelled && checkCancelled(operationId)) {
                        throw new Error('OPERATION_CANCELLED');
                    }

                    const { bytesRead } = await readHandle.read(readBuffer, 0, chunkSize, position);
                    if (bytesRead === 0) break;

                    position += bytesRead;
                    processedBytes += bytesRead;

                    const chunk = readBuffer.subarray(0, bytesRead);
                    const encChunk = payloadCipher.update(chunk);
                    if (encChunk.length > 0) {
                        await outHandle.write(encChunk);
                        fileEncryptedBytes += encChunk.length;
                    }

                    if (typeof onProgress === 'function') {
                        const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
                        const speed = Math.round(processedBytes / elapsed);
                        const remainingBytes = Math.max(0, totalPayloadBytes - processedBytes);
                        const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;

                        onProgress({
                            operation: 'export_capsule',
                            status: 'progress',
                            name: file.name,
                            currentFile: file.name,
                            processedBytes,
                            totalBytes: totalPayloadBytes,
                            completedFiles: i,
                            totalFiles: sourceFiles.length,
                            speedBytesPerSecond: speed,
                            etaSeconds: eta
                        });
                    }
                }

                const finalChunk = payloadCipher.final();
                if (finalChunk.length > 0) {
                    await outHandle.write(finalChunk);
                    fileEncryptedBytes += finalChunk.length;
                }

                const payloadAuthTag = payloadCipher.getAuthTag();
                await outHandle.write(payloadAuthTag);

                // Rewind and write real payload length
                const currentPos = (await outHandle.stat()).size;
                pLenBuf.writeBigUInt64BE(BigInt(fileEncryptedBytes), 0);
                await outHandle.write(pLenBuf, 0, 8, payloadLenOffset);

            } finally {
                await readHandle.close();
            }
        }

        await outHandle.close();

        // Atomically replace destination
        try { await fsp.unlink(destinationPath); } catch { }
        await fsp.rename(tempPackagePath, destinationPath);

        if (typeof onProgress === 'function') {
            onProgress({
                operation: 'export_capsule',
                status: 'completed',
                name: path.basename(destinationPath),
                currentFile: 'Capsule exported successfully.',
                processedBytes: totalPayloadBytes,
                totalBytes: totalPayloadBytes,
                completedFiles: sourceFiles.length,
                totalFiles: sourceFiles.length,
                speedBytesPerSecond: 0,
                etaSeconds: 0
            });
        }

        return {
            success: true,
            filePath: destinationPath,
            fileCount: sourceFiles.length,
            totalBytes: totalPayloadBytes
        };

    } catch (err) {
        try { await outHandle.close(); } catch { }
        try { await fsp.unlink(tempPackagePath); } catch { }
        throw err;
    }
}

/**
 * Extracts raw decrypted files from a `.clpack` Capsule into a scratch staging directory.
 */
async function unpackCapsuleToStaging({
    packagePath,
    transferPassword,
    stagingDirectory,
    onProgress = null,
    operationId = null,
    checkCancelled = null
}) {
    const inspection = await inspectCapsulePackage(packagePath, transferPassword);
    if (!inspection.valid) {
        throw new Error(inspection.error || 'Invalid capsule package.');
    }

    const { manifest } = inspection;
    const fileHandle = await fsp.open(packagePath, 'r');

    try {
        // Calculate offset to first file entry
        // 8 (Magic) + 1 (Ver) + 32 (Salt) + 12 (Iv) + 4 (Len) = 57 bytes
        const manifestCiphertextLenBuf = Buffer.alloc(4);
        await fileHandle.read(manifestCiphertextLenBuf, 0, 4, 53);
        const manifestLen = manifestCiphertextLenBuf.readUInt32BE(0);

        let currentOffset = 57 + manifestLen + 16; // after manifest auth tag

        const saltBuf = Buffer.alloc(32);
        await fileHandle.read(saltBuf, 0, 32, 9);
        const transferKey = deriveTransferKey(transferPassword, saltBuf);

        const extractedFiles = [];
        let processedBytes = 0;
        const startTime = Date.now();
        const chunkSize = getStreamChunkSize ? getStreamChunkSize() : 512 * 1024;

        for (let i = 0; i < manifest.totalFiles; i++) {
            if (checkCancelled && checkCancelled(operationId)) {
                throw new Error('OPERATION_CANCELLED');
            }

            // Read File Magic (4 bytes)
            const fMagic = Buffer.alloc(4);
            await fileHandle.read(fMagic, 0, 4, currentOffset);
            currentOffset += 4;
            if (!fMagic.equals(FILE_ENTRY_MAGIC)) {
                throw new Error(`Corrupted capsule entry at index ${i}`);
            }

            // Read File Header IV (12 bytes) + Header Length (4 bytes)
            const fIv = Buffer.alloc(12);
            await fileHandle.read(fIv, 0, 12, currentOffset);
            currentOffset += 12;

            const fhLenBuf = Buffer.alloc(4);
            await fileHandle.read(fhLenBuf, 0, 4, currentOffset);
            currentOffset += 4;
            const fHeaderLen = fhLenBuf.readUInt32BE(0);

            const fHeaderCiphertext = Buffer.alloc(fHeaderLen);
            await fileHandle.read(fHeaderCiphertext, 0, fHeaderLen, currentOffset);
            currentOffset += fHeaderLen;

            const fHeaderAuthTag = Buffer.alloc(16);
            await fileHandle.read(fHeaderAuthTag, 0, 16, currentOffset);
            currentOffset += 16;

            const fhDecipher = crypto.createDecipheriv('aes-256-gcm', transferKey, fIv);
            fhDecipher.setAAD(Buffer.from(`CrypticLocker|Capsule|FileHeader|${i}`, 'utf8'));
            fhDecipher.setAuthTag(fHeaderAuthTag);

            const fhPlaintext = Buffer.concat([
                fhDecipher.update(fHeaderCiphertext),
                fhDecipher.final()
            ]);
            const fileHeader = JSON.parse(fhPlaintext.toString('utf8'));

            // Read Payload IV (12 bytes) + Payload Len (8 bytes BigUInt64BE)
            const pIv = Buffer.alloc(12);
            await fileHandle.read(pIv, 0, 12, currentOffset);
            currentOffset += 12;

            const pLenBuf = Buffer.alloc(8);
            await fileHandle.read(pLenBuf, 0, 8, currentOffset);
            currentOffset += 8;
            const payloadLen = Number(pLenBuf.readBigUInt64BE(0));

            // Staging file path
            const targetStagingPath = path.join(stagingDirectory, `extracted_${i}_${fileHeader.name}`);
            await fsp.mkdir(path.dirname(targetStagingPath), { recursive: true });
            const writeHandle = await fsp.open(targetStagingPath, 'w');

            const pDecipher = crypto.createDecipheriv('aes-256-gcm', transferKey, pIv);
            pDecipher.setAAD(Buffer.from(`CrypticLocker|Capsule|Payload|${i}`, 'utf8'));

            try {
                let bytesRemaining = payloadLen;
                const buffer = Buffer.alloc(chunkSize);

                while (bytesRemaining > 0) {
                    if (checkCancelled && checkCancelled(operationId)) {
                        throw new Error('OPERATION_CANCELLED');
                    }

                    const toRead = Math.min(chunkSize, bytesRemaining);
                    const { bytesRead } = await fileHandle.read(buffer, 0, toRead, currentOffset);
                    if (bytesRead === 0) break;

                    currentOffset += bytesRead;
                    bytesRemaining -= bytesRead;
                    processedBytes += bytesRead;

                    const chunk = buffer.subarray(0, bytesRead);
                    const decChunk = pDecipher.update(chunk);
                    if (decChunk.length > 0) {
                        await writeHandle.write(decChunk);
                    }

                    if (typeof onProgress === 'function') {
                        const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
                        const speed = Math.round(processedBytes / elapsed);
                        const remainingBytes = Math.max(0, manifest.totalBytes - processedBytes);
                        const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;

                        onProgress({
                            operation: 'import_capsule',
                            status: 'progress',
                            name: fileHeader.name,
                            currentFile: fileHeader.name,
                            processedBytes,
                            totalBytes: manifest.totalBytes,
                            completedFiles: i,
                            totalFiles: manifest.totalFiles,
                            speedBytesPerSecond: speed,
                            etaSeconds: eta
                        });
                    }
                }

                // Read Payload Auth Tag (16 bytes)
                const pAuthTag = Buffer.alloc(16);
                await fileHandle.read(pAuthTag, 0, 16, currentOffset);
                currentOffset += 16;

                pDecipher.setAuthTag(pAuthTag);
                const finalDec = pDecipher.final();
                if (finalDec.length > 0) {
                    await writeHandle.write(finalDec);
                }

            } finally {
                await writeHandle.close();
            }

            extractedFiles.push({
                diskPath: targetStagingPath,
                stagedPath: targetStagingPath,
                name: fileHeader.name,
                size: fileHeader.size,
                relativePath: fileHeader.relativePath,
                parentFolderName: fileHeader.parentFolderName
            });
        }

        return {
            success: true,
            manifest,
            fileCount: extractedFiles.length,
            extractedFiles,
            files: extractedFiles
        };

    } finally {
        await fileHandle.close();
    }
}

module.exports = {
    CAPSULE_MAGIC,
    VAULT_MAGIC,
    CAPSULE_VERSION,
    deriveTransferKey,
    inspectCapsulePackage,
    createCapsulePackage,
    unpackCapsuleToStaging
};
