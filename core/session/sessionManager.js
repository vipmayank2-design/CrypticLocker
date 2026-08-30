'use strict';

/**
 * ============================================================
 * CrypticLocker Session Manager
 * ============================================================
 * Handles ONLY runtime vault state.
 *
 * Responsibilities:
 * - Runtime session state
 * - Vault Master Key (VMK)
 * - Metadata
 * - File Index
 * - Vault information
 *
 * NOT RESPONSIBLE FOR:
 * - Encryption
 * - File I/O
 * - IPC
 * - UI
 * ============================================================
 */

const CRYPTO = require('../constants/cryptoConstants');

let session = null;

/**
 * Creates a new empty runtime session.
 */
function createSession() {

    session = {

        unlocked: false,

        vaultPath: null,

        vaultHeader: null,

        vaultMasterKey: null,

        passwordPackage: null,

        recoveryPackage: null,

        metadata: null,

        fileIndex: null,

        openedAt: null,

        version: null

    };

}

/**
 * Returns true if a vault is unlocked.
 */
function isUnlocked() {

    return !!session && session.unlocked === true;

}

/**
 * Stores Vault Master Key.
 */
function setVaultMasterKey(masterKey) {

    if (!session) {
        throw new Error('SESSION_NOT_CREATED');
    }

    if (!Buffer.isBuffer(masterKey)) {
        throw new Error('INVALID_MASTER_KEY');
    }

    if (masterKey.length !== CRYPTO.MASTER_KEY.LENGTH) {
        throw new Error('INVALID_MASTER_KEY_LENGTH');
    }

    session.vaultMasterKey = Buffer.from(masterKey);
    session.unlocked = true;

}

/**
 * Returns a COPY of the VMK.
 */
function getVaultMasterKey() {

    if (!session) {
        return null;
    }

    if (!session.vaultMasterKey) {
        return null;
    }

    return Buffer.from(session.vaultMasterKey);

}

/**
 * Destroys runtime session.
 */
function destroySession() {

    if (!session) {
        return;
    }

    if (Buffer.isBuffer(session.vaultMasterKey)) {

        session.vaultMasterKey.fill(0);

    }

    session.unlocked = false;

    session = null;

}

module.exports = Object.freeze({

    createSession,

    destroySession,

    isUnlocked,

    setVaultMasterKey,

    getVaultMasterKey

});