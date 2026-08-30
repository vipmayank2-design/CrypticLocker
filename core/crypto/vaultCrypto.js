'use strict';

const crypto = require('crypto');
const CONSTANTS = require('../constants/cryptoConstants');

/**
 * ============================================================
 * CrypticLocker Crypto Engine
 * ============================================================
 *
 * Responsibilities:
 * - Generate cryptographic keys
 * - Derive keys using scrypt
 * - Encrypt / Decrypt Vault Master Key
 * - Encrypt / Decrypt file data
 * - Provide secure crypto utilities
 *
 * NOTE:
 * This file is the ONLY place where Node's crypto APIs
 * should be used directly.
 * ============================================================
 */

// ============================================================
// Private Helpers
// ============================================================

/**
 * Internal key derivation helper.
 */
function deriveKey(secret, salt) {

    return crypto.scryptSync(
        secret,
        salt,
        CONSTANTS.MASTER_KEY.LENGTH,
        {
            N: CONSTANTS.SCRYPT.N,
            r: CONSTANTS.SCRYPT.R,
            p: CONSTANTS.SCRYPT.P,
            maxmem: CONSTANTS.SCRYPT.MAX_MEMORY
        }
    );

}

/**
 * Encodes a buffer into CrypticLocker recovery key format.
 */
function encodeRecoveryKey(buffer) {

    const alphabet = CONSTANTS.RECOVERY.ALPHABET;
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {

        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {

            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;

        }

    }

    if (bits > 0) {

        output += alphabet[(value << (5 - bits)) & 31];

    }

    return output;

}

// ============================================================
// Key Generation
// ============================================================

function generateVaultMasterKey() {

    return crypto.randomBytes(
        CONSTANTS.MASTER_KEY.LENGTH
    );

}

/**
 * Derives Password Unlock Key (PUK).
 */
function derivePasswordKey(password, salt) {

    if (typeof password !== 'string' || password.length === 0) {
        throw new Error('INVALID_PASSWORD');
    }

    if (!Buffer.isBuffer(salt)) {
        throw new Error('INVALID_SALT');
    }

    return deriveKey(password, salt);

}

/**
 * Derives Recovery Unlock Key (RUK).
 */
function deriveRecoveryKey(recoveryKey, salt) {

    if (typeof recoveryKey !== 'string' || recoveryKey.length === 0) {
        throw new Error('INVALID_RECOVERY_KEY');
    }

    if (!Buffer.isBuffer(salt)) {
        throw new Error('INVALID_SALT');
    }

    return deriveKey(recoveryKey, salt);

}

/**
 * Normalizes a recovery key.
 */
function normalizeRecoveryKey(recoveryKey) {

    if (typeof recoveryKey !== 'string') {
        throw new Error('INVALID_RECOVERY_KEY');
    }

    return recoveryKey
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/-+/g, '-');

}

/**
 * Validates recovery key format.
 */
function validateRecoveryKey(recoveryKey) {

    const normalized = normalizeRecoveryKey(recoveryKey);

    if (!normalized.startsWith(CONSTANTS.RECOVERY.PREFIX + '-')) {
        return false;
    }

    const body = normalized.substring(
        CONSTANTS.RECOVERY.PREFIX.length + 1
    );

    const regex = new RegExp(
        `^[${CONSTANTS.RECOVERY.ALPHABET.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}${CONSTANTS.RECOVERY.SEPARATOR}]+$`
    );

    return regex.test(body);

}

/**
 * Generates a permanent recovery key.
 */
function generateRecoveryKey() {

    const bytes = crypto.randomBytes(
        CONSTANTS.RECOVERY.BYTE_LENGTH
    );

    const encoded = encodeRecoveryKey(bytes);

    const groups = [];

    for (
        let i = 0;
        i < encoded.length;
        i += CONSTANTS.RECOVERY.GROUP_SIZE
    ) {

        groups.push(
            encoded.substring(
                i,
                i + CONSTANTS.RECOVERY.GROUP_SIZE
            )
        );

    }

    return (
        CONSTANTS.RECOVERY.PREFIX +
        CONSTANTS.RECOVERY.SEPARATOR +
        groups.join(CONSTANTS.RECOVERY.SEPARATOR)
    );

}

/**
 * Encrypts Vault Master Key using unlock key.
 */
function encryptVaultMasterKey(vaultMasterKey, unlockKey) {

    if (!Buffer.isBuffer(vaultMasterKey)) {
        throw new Error('INVALID_MASTER_KEY');
    }

    if (!Buffer.isBuffer(unlockKey)) {
        throw new Error('INVALID_UNLOCK_KEY');
    }

    if (
        vaultMasterKey.length !==
        CONSTANTS.MASTER_KEY.LENGTH
    ) {
        throw new Error(
            'INVALID_MASTER_KEY_LENGTH'
        );
    }

    if (
        unlockKey.length !==
        CONSTANTS.AES.KEY_LENGTH
    ) {
        throw new Error(
            'INVALID_UNLOCK_KEY_LENGTH'
        );
    }

    const iv = crypto.randomBytes(
        CONSTANTS.AES.IV_LENGTH
    );

    const cipher = crypto.createCipheriv(
        CONSTANTS.AES.ALGORITHM,
        unlockKey,
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(vaultMasterKey),
        cipher.final()
    ]);

    return {

        iv,

        authTag: cipher.getAuthTag(),

        encryptedVMK: encrypted

    };

}

/**
 * Decrypts Vault Master Key.
 */
function decryptVaultMasterKey(packageData, unlockKey) {

    if (
        !packageData ||
        !Buffer.isBuffer(packageData.iv) ||
        !Buffer.isBuffer(packageData.authTag) ||
        !Buffer.isBuffer(packageData.encryptedVMK)
    ) {
        throw new Error(
            'INVALID_VMK_PACKAGE'
        );
    }

    if (
        unlockKey.length !==
        CONSTANTS.AES.KEY_LENGTH
    ) {
        throw new Error(
            'INVALID_UNLOCK_KEY_LENGTH'
        );
    }

    if (!Buffer.isBuffer(unlockKey)) {
        throw new Error('INVALID_UNLOCK_KEY');
    }

    const decipher = crypto.createDecipheriv(

        CONSTANTS.AES.ALGORITHM,

        unlockKey,

        packageData.iv

    );

    decipher.setAuthTag(
        packageData.authTag
    );

    return Buffer.concat([

        decipher.update(
            packageData.encryptedVMK
        ),

        decipher.final()

    ]);

}

/**
 * Encrypts Recovery Key using Vault Master Key.
 */
function encryptRecoveryKey(
    recoveryKey,
    vaultMasterKey
) {

    if (typeof recoveryKey !== 'string') {
        throw new Error('INVALID_RECOVERY_KEY');
    }

    if (!Buffer.isBuffer(vaultMasterKey)) {
        throw new Error('INVALID_MASTER_KEY');
    }

    const iv =
        crypto.randomBytes(
            CONSTANTS.AES.IV_LENGTH
        );

    const cipher =
        crypto.createCipheriv(
            CONSTANTS.AES.ALGORITHM,
            vaultMasterKey,
            iv
        );

    const encrypted =
        Buffer.concat([
            cipher.update(
                recoveryKey,
                'utf8'
            ),
            cipher.final()
        ]);

    return {

        iv,

        authTag:
            cipher.getAuthTag(),

        encryptedRecoveryKey:
            encrypted

    };

}

/**
 * Decrypts Recovery Key using Vault Master Key.
 */
function decryptRecoveryKey(
    packageData,
    vaultMasterKey
) {

    if (!Buffer.isBuffer(vaultMasterKey)) {
        throw new Error('INVALID_MASTER_KEY');
    }

    const decipher =
        crypto.createDecipheriv(

            CONSTANTS.AES.ALGORITHM,

            vaultMasterKey,

            packageData.iv

        );

    decipher.setAuthTag(
        packageData.authTag
    );

    return Buffer.concat([

        decipher.update(
            packageData.encryptedRecoveryKey
        ),

        decipher.final()

    ]).toString('utf8');

}

module.exports = Object.freeze({

    generateVaultMasterKey,
    derivePasswordKey,
    deriveRecoveryKey,
    normalizeRecoveryKey,
    validateRecoveryKey,
    generateRecoveryKey,
    encryptVaultMasterKey,
    decryptVaultMasterKey,
    encryptRecoveryKey,
    decryptRecoveryKey

});