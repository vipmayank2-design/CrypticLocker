const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    powerMonitor,
    nativeTheme,
    shell
} = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { pipeline } = require('stream/promises');
const vaultCrypto =
    require('./core/crypto/vaultCrypto');
const CONSTANTS =
    require('./core/constants/cryptoConstants');
const sessionManager =
    require('./core/session/sessionManager');
const vaultPackage =
    require('./core/vault/vaultPackage');
const {
    Transform,
    Writable
} = require('stream');
const crypto = require('crypto');

/* =========================================
   CLV CONTAINER FORMAT
========================================= */

const CLV1_MAGIC =
    Buffer.from(
        'CLV1',
        'utf8'
    );


const CLV2_MAGIC =
    Buffer.from(
        'CLV2',
        'utf8'
    );


const CLV2_VERSION =
    2;


const CLV_GCM_IV_LENGTH =
    12;


const CLV_GCM_TAG_LENGTH =
    16;


const CLV2_HEADER_LENGTH =
    4 +
    1 +
    CLV_GCM_IV_LENGTH +
    4 +
    CLV_GCM_TAG_LENGTH;

let mainWindow;

const cancelledVaultOperations =
    new Set();

/*
    Temporary success message.

    Used after password change/reset.
*/

let pendingLoginSuccessMessage = null;


/* =========================================
   APP PATHS
========================================= */

function getVaultDirectory() {
    return path.join(app.getPath('userData'), 'vault');
}

function getVaultConfigPath() {
    return path.join(getVaultDirectory(), 'vault.json');
}

function getVaultFilesDirectory() {
    return path.join(
        getVaultDirectory(),
        'files'
    );
}

function getVaultEncryptedFilePath(
    encryptedFileName
) {

    return path.join(

        getVaultFilesDirectory(),

        encryptedFileName

    );

}

function getVaultIndexBackupPath() {

    return path.join(

        getVaultDirectory(),

        'index.clm.bak'

    );

}

async function pathExists(filePath) {

    try {

        await fs.access(filePath);

        return true;

    } catch {

        return false;

    }

}

function getQuarantineDirectory() {

    return path.join(

        getVaultDirectory(),

        'quarantine'

    );

}

async function getDirectorySize(
    directoryPath
) {

    let totalBytes = 0;


    try {

        const entries =
            await fs.readdir(
                directoryPath,
                {
                    withFileTypes: true
                }
            );


        for (const entry of entries) {

            const entryPath =
                path.join(
                    directoryPath,
                    entry.name
                );


            if (entry.isDirectory()) {

                totalBytes +=
                    await getDirectorySize(
                        entryPath
                    );


            } else if (entry.isFile()) {

                const stat =
                    await fs.stat(
                        entryPath
                    );


                totalBytes +=
                    stat.size;

            }

        }


        return totalBytes;


    } catch (error) {

        if (
            error.code === 'ENOENT'
        ) {

            return 0;

        }


        throw error;

    }

}

function getVaultOrphansDirectory() {

    return path.join(
        getVaultDirectory(),
        'orphans'
    );

}

function getRecoveryJournalPath() {

    return path.join(
        getVaultDirectory(),
        'recovery-journal.json'
    );

}

/* =========================================
   APPLICATION SETTINGS
========================================= */

const DEFAULT_APPLICATION_SETTINGS = {

    autoLockMinutes: 1,

    lockOnSleep: true,

    theme: 'dark',

    launchAtStartup: false

};


function getApplicationSettingsPath() {

    return path.join(
        app.getPath('userData'),
        'settings.json'
    );

}


/* =========================================
   FAILED ATTEMPTS & LOCKOUT MANAGEMENT
========================================= */

function getLockoutFilePath() {
    return path.join(
        app.getPath('userData'),
        '.lockout.json'
    );
}

function calculateCooldownSeconds(attempts) {
    if (attempts < 4) return 0;
    if (attempts === 4) return 5;
    if (attempts === 5) return 15;
    if (attempts === 6) return 30;
    if (attempts === 7) return 60;
    if (attempts === 8) return 120;
    if (attempts === 9) return 300;
    return 900; // 15 minutes for 10+ attempts
}

async function readLockoutState() {
    try {
        const data = await fs.readFile(getLockoutFilePath(), 'utf8');
        const parsed = JSON.parse(data);
        const attempts = Number(parsed.attempts) || 0;
        const lockedUntil = Number(parsed.lockedUntil) || 0;
        const now = Date.now();
        const remainingSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
        return {
            attempts,
            lockedUntil,
            isLocked: remainingSeconds > 0,
            remainingSeconds
        };
    } catch {
        return {
            attempts: 0,
            lockedUntil: 0,
            isLocked: false,
            remainingSeconds: 0
        };
    }
}

async function recordFailedAttempt() {
    const state = await readLockoutState();
    const newAttempts = state.attempts + 1;
    const cooldownSecs = calculateCooldownSeconds(newAttempts);
    const lockedUntil = cooldownSecs > 0 ? Date.now() + (cooldownSecs * 1000) : 0;
    const newState = {
        attempts: newAttempts,
        lockedUntil,
        lastFailedAt: new Date().toISOString()
    };
    try {
        await fs.writeFile(getLockoutFilePath(), JSON.stringify(newState, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to save lockout state:', err);
    }
    return {
        attempts: newAttempts,
        isLocked: cooldownSecs > 0,
        remainingSeconds: cooldownSecs
    };
}

async function resetLockoutState() {
    try {
        await fs.unlink(getLockoutFilePath());
    } catch {
        // Ignore if file doesn't exist
    }
}


function setLaunchAtStartup(enabled) {

    app.setLoginItemSettings({

        openAtLogin: enabled,

        openAsHidden: false

    });

}

function isLaunchAtStartupEnabled() {

    return app.getLoginItemSettings().openAtLogin;

}

function normalizeApplicationSettings(
    settings
) {

    const source =
        settings &&
        typeof settings === 'object' &&
        !Array.isArray(settings)
            ? settings
            : {};


    const parsedAutoLock =
        Number(source.autoLockMinutes);

    const allowedAutoLockMinutes =
        [
            0,
            1,
            5,
            15,
            30
        ];


    return {

        autoLockMinutes:
            allowedAutoLockMinutes.includes(
                parsedAutoLock
            )
                ? parsedAutoLock
                : DEFAULT_APPLICATION_SETTINGS
                    .autoLockMinutes,

        lockOnSleep:
            typeof source.lockOnSleep ===
                'boolean'
                ? source.lockOnSleep
                : DEFAULT_APPLICATION_SETTINGS
                    .lockOnSleep,

        theme:
            source.theme === 'light' ||
            source.theme === 'dark' ||
            source.theme === 'system'
                ? source.theme
                : DEFAULT_APPLICATION_SETTINGS
                    .theme,

        launchAtStartup:
            typeof source.launchAtStartup ===
                'boolean'
                ? source.launchAtStartup
                : DEFAULT_APPLICATION_SETTINGS
                    .launchAtStartup

    };

}


async function readApplicationSettings() {

    try {

        const raw =
            await fs.readFile(
                getApplicationSettingsPath(),
                'utf8'
            );


        const parsed =
            JSON.parse(raw);


        return normalizeApplicationSettings(
            parsed
        );


    } catch (error) {

        if (
            error.code === 'ENOENT'
        ) {

            return {
                ...DEFAULT_APPLICATION_SETTINGS
            };

        }


        console.error(
            'Unable to read application settings:',
            error
        );


        /*
            Invalid/corrupted settings must never
            prevent CrypticLocker from starting.

            Fall back to secure defaults.
        */

        return {
            ...DEFAULT_APPLICATION_SETTINGS
        };

    }

}


async function writeApplicationSettings(
    settings
) {

    const normalized =
        normalizeApplicationSettings(
            settings
        );


    const settingsPath =
        getApplicationSettingsPath();


    const temporaryPath =
        `${settingsPath}.tmp`;


    const handle =
        await fs.open(
            temporaryPath,
            'w'
        );


    try {

        await handle.writeFile(
            JSON.stringify(
                normalized,
                null,
                2
            ),
            'utf8'
        );


        await handle.sync();


    } finally {

        await handle.close();

    }


    await fs.rename(
        temporaryPath,
        settingsPath
    );

    setLaunchAtStartup(
        normalized.launchAtStartup
    );

    return normalized;

}

async function synchronizeApplicationSettings() {

    const settings =
        await readApplicationSettings();

    const actualStartupState =
        isLaunchAtStartupEnabled();

    if (
        settings.launchAtStartup !==
        actualStartupState
    ) {

        settings.launchAtStartup =
            actualStartupState;

        await writeApplicationSettings(
            settings
        );

    }

    if (nativeTheme && settings.theme) {
        nativeTheme.themeSource = settings.theme;
    }

    return settings;

}

/* =========================================
   GET QUARANTINED ORPHANS
========================================= */

ipcMain.handle(
    'vault:get-quarantined-orphans',
    async () => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                message: 'Vault is locked.'
            };
        }

        try {

            const index =
                await readVaultIndex();

            const orphanFiles =
                await detectOrphanVaultFiles(
                    index
                );

            if (
                Array.isArray(orphanFiles) &&
                orphanFiles.length > 0
            ) {
                await quarantineOrphanVaultFiles(
                    orphanFiles
                );
            }

            const orphans =
                await scanQuarantinedOrphans();

            return {
                success: true,
                orphans:
                    Array.isArray(orphans)
                        ? orphans
                        : []
            };

        } catch (error) {

            console.error(
                'Unable to load quarantined orphans:',
                error
            );

            return {
                success: false,
                message:
                    'Unable to load quarantined items.'
            };

        }

    }
);

/* =========================================
   CHECK IF VAULT EXISTS
========================================= */

async function vaultExists() {

    try {

        await fs.access(getVaultConfigPath());

        return true;

    } catch {

        return false;

    }

}

/* =========================================
   CREATE VAULT
========================================= */

async function createVault(password) {

    let vaultMasterKey = null;
    let passwordUnlockKey = null;
    let recoveryUnlockKey = null;

    try {

        if (typeof password !== 'string' || password.length < 8) {
            throw new Error('Invalid master password.');
        }

        if (await vaultExists()) {
            throw new Error('A vault already exists.');
        }

        const vaultDirectory = getVaultDirectory();

    await fs.mkdir(vaultDirectory, {
        recursive: true
    });


    /*
    Generate Vault Master Key.
*/

vaultMasterKey =
    vaultCrypto.generateVaultMasterKey();

/*
    Password protection.
*/

const passwordSalt =
    crypto.randomBytes(
        CONSTANTS.SCRYPT.SALT_LENGTH
    );

passwordUnlockKey =
    vaultCrypto.derivePasswordKey(
        password,
        passwordSalt
    );

/*
    Encrypt VMK using password.
*/

const passwordPackage =
    vaultCrypto.encryptVaultMasterKey(
        vaultMasterKey,
        passwordUnlockKey
    );

/*
    Generate permanent recovery key.
*/

const recoveryKey =
    vaultCrypto.generateRecoveryKey();

/*
    Protect SAME VMK using recovery key.
*/

const recoverySalt =
    crypto.randomBytes(
        CONSTANTS.SCRYPT.SALT_LENGTH
    );

recoveryUnlockKey =
    vaultCrypto.deriveRecoveryKey(
        recoveryKey,
        recoverySalt
    );

const recoveryPackage =
    vaultCrypto.encryptVaultMasterKey(
        vaultMasterKey,
        recoveryUnlockKey
    );

    /*
    Encrypt the permanent recovery key
    using the Vault Master Key.

    The plaintext recovery key is never
    stored inside vault.json.
*/

const encryptedRecoveryKey =
    vaultCrypto.encryptRecoveryKey(
        recoveryKey,
        vaultMasterKey
    );


    const vaultConfig = {

    version:
    CONSTANTS.VAULT_VERSION,

    format:
    CONSTANTS.VAULT_FORMAT,

    password: {

        algorithm: "scrypt",

        salt:
            passwordSalt.toString("base64"),

        N: CONSTANTS.SCRYPT.N,

r: CONSTANTS.SCRYPT.R,

p: CONSTANTS.SCRYPT.P,

        vmk: {

            iv:
                passwordPackage.iv.toString("base64"),

            authTag:
                passwordPackage.authTag.toString("base64"),

            encrypted:
                passwordPackage.encryptedVMK.toString("base64")

        }

    },

    recovery: {

    algorithm: "scrypt",

    salt:
        recoverySalt.toString("base64"),

    N: CONSTANTS.SCRYPT.N,

    r: CONSTANTS.SCRYPT.R,

    p: CONSTANTS.SCRYPT.P,

    vmk: {

        iv:
            recoveryPackage.iv.toString("base64"),

        authTag:
            recoveryPackage.authTag.toString("base64"),

        encrypted:
            recoveryPackage.encryptedVMK.toString("base64")

    },

    key: {

        iv:
            encryptedRecoveryKey.iv.toString("base64"),

        authTag:
            encryptedRecoveryKey.authTag.toString("base64"),

        encrypted:
            encryptedRecoveryKey
                .encryptedRecoveryKey
                .toString("base64")

    }

},

    createdAt:
        new Date().toISOString()

};

    /*
        Atomic-ish config creation:
        first write temporary file,
        then rename it.
    */

    const temporaryPath =
        path.join(vaultDirectory, 'vault.tmp');


    await fs.writeFile(
        temporaryPath,
        JSON.stringify(vaultConfig, null, 2),
        {
            encoding: 'utf8',
            flag: 'wx'
        }
    );


    await fs.rename(
        temporaryPath,
        getVaultConfigPath()
    );

    sessionManager.createSession();

sessionManager.setVaultMasterKey(
    vaultMasterKey
);


    /*
        Best effort:
        remove password reference from this function.
        JavaScript strings cannot be reliably wiped
        from memory, so we never persist it.
    */

    return {

    success: true,

    recoveryKey

};

}
finally {

    if (passwordUnlockKey) {
        passwordUnlockKey.fill(0);
    }

    if (recoveryUnlockKey) { recoveryUnlockKey.fill(0); }

    if (vaultMasterKey) {
        vaultMasterKey.fill(0);
    }

}

}


/* =========================================
   FILE HELPERS
========================================= */

async function scanFolder(
    folderPath,
    rootPath = folderPath
) {

    const entries =
        await fs.readdir(
            folderPath,
            {
                withFileTypes: true
            }
        );


    const result = {
        files: [],
        folders: []
    };


    for (const entry of entries) {

        const fullPath =
            path.join(
                folderPath,
                entry.name
            );


        const relativePath =
            path.relative(
                rootPath,
                fullPath
            );


        if (entry.isDirectory()) {

            result.folders.push({
                name: entry.name,
                relativePath
            });


            const children =
                await scanFolder(
                    fullPath,
                    rootPath
                );


            result.files.push(
                ...children.files
            );

            result.folders.push(
                ...children.folders
            );


        } else if (entry.isFile()) {

            const stat =
                await fs.stat(
                    fullPath
                );


            result.files.push({

                sourcePath:
                    fullPath,

                name:
                    entry.name,

                relativePath,

                size:
                    stat.size

            });

        }

    }


    return result;
}

function formatFileSize(bytes) {

    if (bytes === 0) {
        return '0 B';
    }

    const units = [
        'B',
        'KB',
        'MB',
        'GB',
        'TB'
    ];

    const index = Math.floor(
        Math.log(bytes) / Math.log(1024)
    );

    const value =
        bytes / Math.pow(1024, index);

    return `${value.toFixed(
        index === 0 ? 0 : 1
    )} ${units[index]}`;
}


function getFileType(fileName) {

    const extension =
        path.extname(fileName)
            .replace('.', '')
            .toUpperCase();

    return extension || 'FILE';
}

/* =========================================
   CLV2 RECOVERY METADATA
========================================= */

function createCLV2Metadata({
    fileId,
    originalName,
    stat,
    parentFolderId = null,
    relativePath = null
}) {

    if (
        typeof fileId !== 'string' ||
        !fileId
    ) {
        throw new Error(
            'Invalid CLV2 file ID.'
        );
    }


    if (
        typeof originalName !== 'string' ||
        !originalName
    ) {
        throw new Error(
            'Invalid CLV2 filename.'
        );
    }


    if (
        !stat ||
        typeof stat.size !== 'number'
    ) {
        throw new Error(
            'Invalid CLV2 file information.'
        );
    }


    return {

        version:
            CLV2_VERSION,

        id:
            fileId,

        name:
            originalName,

        extension:
            path.extname(
                originalName
            ),

        type:
            getFileType(
                originalName
            ),

        size:
            stat.size,

        modifiedAt:
            stat.mtime.toISOString(),

        parentFolderId:
            parentFolderId,

        relativePath:
            relativePath

    };

}

/* =========================================
   CLV2 METADATA SERIALIZATION
========================================= */

function serializeCLV2Metadata(
    metadata
) {

    if (
        !metadata ||
        metadata.version !==
            CLV2_VERSION
    ) {

        throw new Error(
            'Invalid CLV2 metadata.'
        );

    }


    const json =
        JSON.stringify(
            metadata
        );


    const metadataBuffer =
        Buffer.from(
            json,
            'utf8'
        );


    /*
        Protect against accidentally creating
        an unreasonable metadata block.

        1 MB is far more than we should ever
        need for a single file's metadata.
    */

    const MAX_METADATA_SIZE =
        1024 * 1024;


    if (
        metadataBuffer.length === 0 ||
        metadataBuffer.length >
            MAX_METADATA_SIZE
    ) {

        throw new Error(
            'Invalid CLV2 metadata size.'
        );

    }


    /*
        Prefix metadata with its length.

        Layout inside encrypted plaintext:

        4 bytes
            metadata length

        N bytes
            metadata JSON

        remaining bytes
            original file contents
    */

    const lengthBuffer =
        Buffer.alloc(4);


    lengthBuffer.writeUInt32BE(
        metadataBuffer.length,
        0
    );


    return Buffer.concat([
        lengthBuffer,
        metadataBuffer
    ]);

}

/* =========================================
   ENCRYPTED METADATA INDEX
========================================= */

function getVaultIndexPath() {
    return path.join(
        getVaultDirectory(),
        'index.clm'
    );
}


function decodeVaultIndexContainer(
    container
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    /*
        CLM1 container:

        4 bytes   magic
        12 bytes  AES-GCM IV
        16 bytes  authentication tag
        remaining ciphertext
    */

    if (
        !Buffer.isBuffer(container) ||
        container.length < 32
    ) {

        throw new Error(
            'Invalid metadata index.'
        );

    }


    const magic =
        container
            .subarray(0, 4)
            .toString('utf8');


    if (magic !== 'CLM1') {

        throw new Error(
            'Invalid metadata index.'
        );

    }


    const iv =
        container.subarray(
            4,
            16
        );


    const authTag =
        container.subarray(
            16,
            32
        );


    const ciphertext =
        container.subarray(32);


    const decipher =
        crypto.createDecipheriv(
            'aes-256-gcm',
            vaultMasterKey,
            iv
        );


    decipher.setAAD(
        Buffer.from(
            'CrypticLocker|Metadata|1',
            'utf8'
        )
    );


    decipher.setAuthTag(
        authTag
    );


    const plaintext =
        Buffer.concat([
            decipher.update(
                ciphertext
            ),
            decipher.final()
        ]);


    try {

        const data =
            JSON.parse(
                plaintext.toString(
                    'utf8'
                )
            );


        if (
            !data ||
            data.version !== 1 ||
            !Array.isArray(
                data.files
            )
        ) {

            throw new Error(
                'Invalid metadata structure.'
            );

        }


        /*
            Backward compatibility for vaults
            created before folder support.
        */

        if (
            !Array.isArray(
                data.folders
            )
        ) {

            data.folders = [];

        }


        return data;


    } finally {

        /*
            Do not leave decrypted metadata
            plaintext in this Buffer longer
            than necessary.
        */

        plaintext.fill(0);

    }

}

async function readVaultIndex() {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}


    try {

        const container =
            await fs.readFile(
                getVaultIndexPath()
            );


        return decodeVaultIndexContainer(
            container
        );


    } catch (error) {

        /*
            No index yet is valid only for
            a brand-new vault.

            Corruption/authentication/JSON
            failures MUST continue throwing.
        */

        if (
            error.code === 'ENOENT'
        ) {

            return {
                version: 1,
                files: [],
                folders: []
            };

        }


        throw error;

    }

}

async function readVaultIndexBackup() {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}


    const backupPath =
        `${getVaultIndexPath()}.bak`;


    try {

        /*
            Read the previous committed
            encrypted metadata index.
        */

        const container =
            await fs.readFile(
                backupPath
            );


        /*
            IMPORTANT:

            Do not trust index.clm.bak merely
            because the file exists.

            It must pass exactly the same:

            - CLM1 header validation
            - AES-256-GCM authentication
            - JSON parsing
            - metadata structure validation

            as the active index.
        */

        const index =
            decodeVaultIndexContainer(
                container
            );


        return {

            exists: true,

            valid: true,

            index

        };


    } catch (error) {

        /*
            No backup is completely normal for:

            - a brand-new vault
            - a vault before its first index
              replacement
        */

        if (
            error.code === 'ENOENT'
        ) {

            return {

                exists: false,

                valid: false,

                index: null,

                reason:
                    'Backup metadata index does not exist.'

            };

        }


        /*
            The backup exists but failed
            cryptographic or structural
            validation.

            Do NOT throw here.

            Later recovery logic needs to know
            the difference between:

                backup missing
                backup invalid
                backup valid
        */

        return {

            exists: true,

            valid: false,

            index: null,

            reason:
                error.message ||
                'Backup metadata index is invalid.'

        };

    }

}

async function vaultHasEncryptedContainers() {

    const filesDirectory =
        getVaultFilesDirectory();


    try {

        const entries =
            await fs.readdir(
                filesDirectory,
                {
                    withFileTypes: true
                }
            );


        return entries.some(
            entry =>
                entry.isFile() &&
                entry.name
                    .toLowerCase()
                    .endsWith('.clv')
        );


    } catch (error) {

        /*
            No files directory means there are
            no encrypted vault containers yet.
        */

        if (
            error.code === 'ENOENT'
        ) {

            return false;

        }


        throw error;

    }

}

async function readActiveVaultIndexStatus() {

    try {

        const container =
            await fs.readFile(
                getVaultIndexPath()
            );


        const index =
            decodeVaultIndexContainer(
                container
            );


        return {

            exists: true,
            valid: true,
            index,
            reason: null

        };


    } catch (error) {

        /*
            Active index does not exist.
        */

        if (
            error.code === 'ENOENT'
        ) {

            return {

                exists: false,
                valid: false,
                index: null,
                reason:
                    'Active metadata index does not exist.'

            };

        }


        /*
            Active index exists, but failed
            cryptographic or structural
            validation.
        */

        return {

            exists: true,
            valid: false,
            index: null,
            reason:
                error.message ||
                'Active metadata index is invalid.'

        };

    }

}

/* =========================================
   DAMAGED INDEX RETENTION
========================================= */

async function cleanupOldDamagedVaultIndexes(
    keepCount = 3
) {

    const vaultDirectory =
        getVaultDirectory();


    try {

        const entries =
            await fs.readdir(
                vaultDirectory,
                {
                    withFileTypes: true
                }
            );


        /*
            Only accept filenames generated by:

            index.clm.damaged-<timestamp>

            Nothing else is eligible for deletion.
        */

        const damagedIndexes =
            entries
                .filter(entry => {

                    return (
                        entry.isFile() &&
                        /^index\.clm\.damaged-\d+$/
                            .test(entry.name)
                    );

                })
                .map(entry => {

                    const match =
                        entry.name.match(
                            /^index\.clm\.damaged-(\d+)$/
                        );


                    return {

                        name:
                            entry.name,

                        timestamp:
                            Number(match[1])

                    };

                })
                .filter(item => {

                    return Number.isSafeInteger(
                        item.timestamp
                    );

                })
                .sort(
                    (a, b) =>
                        b.timestamp -
                        a.timestamp
                );


        /*
            Newest files are at the beginning.

            Example with keepCount = 3:

            [0] newest       KEEP
            [1]              KEEP
            [2]              KEEP
            [3]              DELETE
            [4] oldest       DELETE
        */

        const oldIndexes =
            damagedIndexes.slice(
                keepCount
            );


        let removedCount = 0;


        for (const item of oldIndexes) {

            const damagedPath =
                path.join(
                    vaultDirectory,
                    item.name
                );


            try {

                await fs.unlink(
                    damagedPath
                );


                removedCount++;


            } catch (error) {

                /*
                    Diagnostic cleanup failure must
                    NOT prevent the vault from
                    unlocking.

                    The file can be retried during
                    a later successful recovery.
                */

                console.error(
                    'Unable to remove old damaged metadata index:',
                    item.name,
                    error
                );

            }

        }


        if (removedCount > 0) {

            console.log(
                `CrypticLocker removed ${removedCount} old damaged metadata index file(s).`
            );

        }


        return {

            found:
                damagedIndexes.length,

            removed:
                removedCount,

            kept:
                Math.min(
                    damagedIndexes.length,
                    keepCount
                )

        };


    } catch (error) {

        if (
            error.code === 'ENOENT'
        ) {

            return {
                found: 0,
                removed: 0,
                kept: 0
            };

        }


        console.error(
            'Damaged metadata index cleanup failed:',
            error
        );


        return {
            found: 0,
            removed: 0,
            kept: 0
        };

    }

}

async function recoverVaultIndexIfNeeded() {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}


    /*
        STEP 1:
        Validate the active metadata index.
    */

    const activeStatus =
        await readActiveVaultIndexStatus();


    if (
        activeStatus.exists &&
        activeStatus.valid
    ) {

        return {

            recovered: false,

            index:
                activeStatus.index,

            source:
                'active'

        };

    }


    /*
        STEP 2:
        The active index is missing or invalid.

        Before treating this as a new/empty vault,
        check whether encrypted containers already
        exist on disk.
    */

    const hasEncryptedContainers =
        await vaultHasEncryptedContainers();


    if (!hasEncryptedContainers) {

        /*
            No active index and no encrypted data.

            This can legitimately represent an
            empty/new vault.

            However, if an active index exists but
            is corrupt, do NOT silently hide that
            corruption.
        */

        if (activeStatus.exists) {

            const error =
                new Error(
                    'The active vault metadata index is damaged.'
                );


            error.code =
                'VAULT_INDEX_CORRUPT';


            throw error;

        }


        return {

            recovered: false,

            index: {
                version: 1,
                files: [],
                folders: []
            },

            source:
                'empty'

        };

    }


    /*
        STEP 3:
        Encrypted vault data exists, therefore a
        missing/invalid active index must NEVER be
        interpreted as an empty vault.

        Validate the backup.
    */

    const backupStatus =
        await readVaultIndexBackup();


    if (
        !backupStatus.exists ||
        !backupStatus.valid ||
        !backupStatus.index
    ) {

        const error =
            new Error(
                'Vault metadata is damaged and no valid recovery backup is available.'
            );


        error.code =
            'VAULT_INDEX_RECOVERY_UNAVAILABLE';


        throw error;

    }


    /*
        STEP 4:
        Preserve the damaged active index for
        diagnostics before replacing anything.

        Never overwrite an existing diagnostic
        copy.
    */

    const indexPath =
        getVaultIndexPath();


    if (activeStatus.exists) {

        const damagedPath =
            `${indexPath}.damaged-${Date.now()}`;


        try {

            await fs.rename(
                indexPath,
                damagedPath
            );


        } catch (error) {

            const preserveError =
                new Error(
                    'Unable to preserve the damaged vault metadata index.'
                );


            preserveError.code =
                'VAULT_INDEX_PRESERVE_FAILED';


            preserveError.cause =
                error;


            throw preserveError;

        }

    }


    /*
        STEP 5:
        Do NOT call writeVaultIndex() here.

        writeVaultIndex() would rotate the current
        active index into .bak, which is exactly
        what we do not want during disaster
        recovery.

        Instead copy the already-authenticated
        backup into a temporary recovery file.
    */

    const backupPath =
        `${indexPath}.bak`;


    const recoveryPath =
        `${indexPath}.recovery.tmp`;


    try {

        const backupContainer =
            await fs.readFile(
                backupPath
            );


        const recoveryHandle =
            await fs.open(
                recoveryPath,
                'w'
            );


        try {

            await recoveryHandle.writeFile(
                backupContainer
            );


            await recoveryHandle.sync();


        } finally {

            await recoveryHandle.close();

        }


        /*
            Verify the physical recovery copy
            AGAIN before making it active.
        */

        const verifyContainer =
            await fs.readFile(
                recoveryPath
            );


        const verifiedIndex =
            decodeVaultIndexContainer(
                verifyContainer
            );


        /*
            Activate only the verified recovery
            copy.
        */

        await fs.rename(
            recoveryPath,
            indexPath
        );


        /*
            Final verification from the actual
            active path.

            Recovery is not considered successful
            merely because rename() succeeded.
        */

        const finalStatus =
            await readActiveVaultIndexStatus();


        if (
            !finalStatus.exists ||
            !finalStatus.valid ||
            !finalStatus.index
        ) {

            const error =
                new Error(
                    'Recovered vault metadata failed final verification.'
                );


            error.code =
                'VAULT_INDEX_RECOVERY_VERIFY_FAILED';


            throw error;

        }


        console.warn(
            'CrypticLocker recovered the active metadata index from the verified backup.'
        );


        await cleanupOldDamagedVaultIndexes(
    3
);

return {

            recovered: true,

            index:
                finalStatus.index,

            source:
                'backup',

            recoveredFiles:
                finalStatus.index.files.length,

            recoveredFolders:
                finalStatus.index.folders.length

        };


    } catch (error) {

        /*
            Never leave our recovery temporary
            file behind after a failed attempt.
        */

        try {

            await fs.unlink(
                recoveryPath
            );

        } catch (cleanupError) {

            if (
                cleanupError.code !==
                'ENOENT'
            ) {

                console.error(
                    'Unable to remove metadata recovery temp file:',
                    cleanupError
                );

            }

        }


        throw error;

    }

}

async function writeVaultIndex(indexData) {

    if (
    !sessionManager.isUnlocked()
) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const plaintext =
        Buffer.from(
            JSON.stringify(indexData),
            'utf8'
        );


    const iv =
        crypto.randomBytes(12);


    const cipher =
    crypto.createCipheriv(
        'aes-256-gcm',
        vaultMasterKey,
        iv
    );


    cipher.setAAD(
        Buffer.from(
            'CrypticLocker|Metadata|1',
            'utf8'
        )
    );


    try {

        const ciphertext =
            Buffer.concat([
                cipher.update(plaintext),
                cipher.final()
            ]);


        const authTag =
            cipher.getAuthTag();


        const container =
            Buffer.concat([
                Buffer.from('CLM1'),
                iv,
                authTag,
                ciphertext
            ]);


        const indexPath =
            getVaultIndexPath();


        const temporaryPath =
            `${indexPath}.tmp`;

            const backupPath =
    `${indexPath}.bak`;

            /*
    Write the new encrypted index to a
    temporary file first.

    Do not consider the temporary index
    durable until its contents have been
    explicitly flushed to storage.
*/

const temporaryHandle =
    await fs.open(
        temporaryPath,
        'w'
    );


try {

    await temporaryHandle.writeFile(
        container
    );


    /*
        Force pending index data to the
        storage device before verification
        and before replacing index.clm.
    */

    await temporaryHandle.sync();


} finally {

    await temporaryHandle.close();

}


        /*
            Verify temporary file can actually
            be decrypted before replacing
            current index.
        */

        const verifyContainer =
            await fs.readFile(
                temporaryPath
            );


        const verifyIv =
            verifyContainer.subarray(
                4,
                16
            );

        const verifyTag =
            verifyContainer.subarray(
                16,
                32
            );

        const verifyCiphertext =
            verifyContainer.subarray(32);


        const decipher =
            crypto.createDecipheriv(
                'aes-256-gcm',
                vaultMasterKey,
                verifyIv
            );


        decipher.setAAD(
            Buffer.from(
                'CrypticLocker|Metadata|1',
                'utf8'
            )
        );


        decipher.setAuthTag(
            verifyTag
        );


        const verified =
            Buffer.concat([
                decipher.update(
                    verifyCiphertext
                ),
                decipher.final()
            ]);


        verified.fill(0);


        /*
            Replace old index only after
            successful verification.
        */

        /*
    =============================
    SAFE INDEX REPLACEMENT
    =============================

    Keep the previous committed index as a
    recovery backup before activating the
    newly verified temporary index.
*/

try {

    /*
        Read the currently committed index.
    */

    const currentIndex =
        await fs.readFile(
            indexPath
        );


    /*
        Write the known-good previous index
        into the backup using a writable handle.
    */

    const backupHandle =
        await fs.open(
            backupPath,
            'w'
        );


    try {

        await backupHandle.writeFile(
            currentIndex
        );


        /*
            Flush backup contents before the
            active index is replaced.
        */

        await backupHandle.sync();


    } finally {

        await backupHandle.close();

    }


} catch (error) {

    /*
        No existing index is normal during
        first-time vault creation.
    */

    if (
        error.code !==
        'ENOENT'
    ) {

        throw error;

    }

}


/*
    The new index.clm.tmp has already passed
    cryptographic verification and fsync.

    It can now become the active index.
*/

await fs.rename(
    temporaryPath,
    indexPath
);


    } finally {

        plaintext.fill(0);

    }

}

/* =========================================
   OPERATION PROGRESS
========================================= */

function markVaultOperationCancelled(
    operationId
) {

    if (
        typeof operationId !==
        'string' ||
        !operationId
    ) {

        return false;

    }


    cancelledVaultOperations.add(
        operationId
    );


    return true;

}


function isVaultOperationCancelled(
    operationId
) {

    return (
        typeof operationId ===
            'string' &&
        cancelledVaultOperations.has(
            operationId
        )
    );

}


function createVaultOperationCancelledError() {

    const error =
        new Error(
            'Operation cancelled by user.'
        );

    error.code =
        'OPERATION_CANCELLED';

    return error;

}

function clearVaultOperationCancellation(
    operationId
) {

    if (
        typeof operationId !==
        'string' ||
        !operationId
    ) {

        return;

    }


    cancelledVaultOperations.delete(
        operationId
    );

}

function sendVaultProgress(
    event,
    data
) {

    if (
        !event ||
        !event.sender ||
        event.sender.isDestroyed()
    ) {
        return;
    }


    event.sender.send(
        'vault:operation-progress',
        data
    );

}

const sendOperationProgress = sendVaultProgress;


/*
    Send one standardized terminal failure
    event for ANY vault operation.

    Renderer only needs to understand
    status: 'failed'.

    Individual operations do not need their
    own error-panel implementation.
*/

function formatUserFriendlyError(
    error,
    fallbackMessage = 'The operation could not be completed.'
) {

    if (!error) {
        return fallbackMessage;
    }

    const rawMessage =
        typeof error === 'string'
            ? error
            : typeof error.message === 'string'
                ? error.message
                : '';

    const code =
        error && typeof error.code === 'string'
            ? error.code
            : '';

    if (
        code === 'ENOENT' ||
        rawMessage.includes('ENOENT') ||
        rawMessage.toLowerCase().includes('no such file or directory')
    ) {
        return 'The encrypted container file could not be found in vault storage. It may have been moved, renamed, or deleted.';
    }

    if (
        code === 'EACCES' ||
        code === 'EPERM' ||
        rawMessage.toLowerCase().includes('permission denied') ||
        rawMessage.toLowerCase().includes('operation not permitted')
    ) {
        return 'Access was denied. Please check your system permissions.';
    }

    if (
        code === 'ENOSPC' ||
        rawMessage.toLowerCase().includes('no space left')
    ) {
        return 'Not enough disk space available to complete the operation.';
    }

    return rawMessage.trim() || fallbackMessage;

}

function sendVaultOperationFailure(
    event,
    {
        operationId = null,
        operation = 'unknown',
        itemType = 'unknown',
        name = null,
        error = null,
        fallbackMessage =
            'The operation could not be completed.'
    } = {}
) {

    const message =
        formatUserFriendlyError(
            error,
            fallbackMessage
        );


    const errorCode =
        error &&
        typeof error.code === 'string'
            ? error.code
            : 'OPERATION_FAILED';


    const cancelled =
    errorCode ===
    'OPERATION_CANCELLED';


sendVaultProgress(
    event,
    {
        operationId,

        operation,

        itemType,

        status:
            cancelled
                ? 'cancelled'
                : 'failed',

        name,

        currentFile:
            null,

        errorCode,

        message:
            cancelled
                ? 'Operation cancelled by user.'
                : message,

        speedBytesPerSecond:
            0,

        etaSeconds:
            null

    }
);


if (cancelled) {

    clearVaultOperationCancellation(
        operationId
    );

}

}

function createProgressTransform(
    onProgress,
    operationId = null
) {

    let processedBytes = 0;


    return new Transform({

        transform(
            chunk,
            encoding,
            callback
        ) {

            processedBytes +=
                chunk.length;


            if (
                typeof onProgress ===
                'function'
            ) {

                onProgress(
                    processedBytes,
                    chunk.length
                );

            }


            callback(
                null,
                chunk
            );

        }

    });

}

/* =========================================
   STALE VAULT TEMP CLEANUP
========================================= */

async function cleanupStaleVaultTempFiles() {

    const filesDirectory =
        getVaultFilesDirectory();


    try {

        const entries =
            await fs.readdir(
                filesDirectory,
                {
                    withFileTypes: true
                }
            );


        let removedCount = 0;


        for (const entry of entries) {

            /*
                Only CrypticLocker encrypted-file
                temporary files are allowed here.

                Valid encrypted files:
                    <uuid>.clv

                Temporary encrypted files:
                    <uuid>.clv.tmp
            */

            if (
                !entry.isFile() ||
                !entry.name.endsWith(
                    '.clv.tmp'
                )
            ) {
                continue;
            }


            const temporaryPath =
                path.join(
                    filesDirectory,
                    entry.name
                );


            try {

                await fs.unlink(
                    temporaryPath
                );


                removedCount++;


            } catch (error) {

                console.error(
                    'Unable to remove stale vault temp file:',
                    temporaryPath,
                    error
                );

            }

        }


        if (removedCount > 0) {

            console.log(
                `CrypticLocker cleaned ${removedCount} stale vault temporary file(s).`
            );

        }


        return removedCount;


    } catch (error) {

        /*
            A new vault may not have a
            files directory yet.
        */

        if (error.code === 'ENOENT') {
            return 0;
        }


        console.error(
            'Vault temporary cleanup failed:',
            error
        );


        return 0;

    }

}

/* =========================================
   RECOVERY JOURNAL
========================================= */

async function writeRecoveryJournal(
    destinationPath
) {

    const journalPath =
        getRecoveryJournalPath();


    await fs.mkdir(
        getVaultDirectory(),
        {
            recursive: true
        }
    );


    const data = {

        version: 1,

        destinationPath,

        createdAt:
            new Date().toISOString()

    };


    const temporaryPath =
        `${journalPath}.tmp`;


    await fs.writeFile(
        temporaryPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    );


    await fs.rename(
        temporaryPath,
        journalPath
    );

}


async function clearRecoveryJournal() {

    try {

        await fs.unlink(
            getRecoveryJournalPath()
        );

    } catch (error) {

        if (
            error.code !== 'ENOENT'
        ) {
            throw error;
        }

    }

}

async function cleanupRecoveryJournalOnStartup() {

    const journalPath =
        getRecoveryJournalPath();


    let journal;


    /*
        No journal means the previous session
        did not leave an interrupted recovery.
    */

    try {

        const raw =
            await fs.readFile(
                journalPath,
                'utf8'
            );


        journal =
            JSON.parse(raw);


    } catch (error) {

        if (error.code === 'ENOENT') {
            return false;
        }


        /*
            A malformed/unreadable journal must
            not cause CrypticLocker to guess a
            destination path and delete something.
        */

        console.error(
            'Unable to read recovery journal:',
            error
        );


        return false;

    }


    /*
        Validate the journal strictly before
        using its stored path.
    */

    if (
        !journal ||
        journal.version !== 1 ||
        typeof journal.destinationPath !==
            'string' ||
        !journal.destinationPath.trim() ||
        !path.isAbsolute(
            journal.destinationPath
        )
    ) {

        console.error(
            'Invalid CrypticLocker recovery journal.'
        );


        return false;

    }


    /*
        Remove ONLY CrypticLocker's known
        temporary recovery filenames.

        cleanupStaleRecoveryTempFile() never
        deletes the user's final destination.
    */

    await cleanupStaleRecoveryTempFile(
        journal.destinationPath
    );


    /*
        Cleanup succeeded.

        The interrupted recovery has now been
        resolved, so the journal can safely go.
    */

    await clearRecoveryJournal();


    console.warn(
        'CrypticLocker cleaned an interrupted recovery from the previous session.'
    );


    return true;

}

/* =========================================
   STALE RECOVERY TEMP CLEANUP
========================================= */

async function cleanupStaleRecoveryTempFile(
    destinationPath
) {

    const temporaryPaths = [

        `${destinationPath}.crypticlocker-part`,

        `${destinationPath}.crypticlocker-recovery-part`

    ];


    for (const temporaryPath of temporaryPaths) {

        try {

            const stat =
                await fs.stat(
                    temporaryPath
                );


            /*
                Never delete anything except
                a regular file using CrypticLocker's
                exact recovery-temp filename.
            */

            if (!stat.isFile()) {

                throw new Error(
                    'Recovery temporary path is not a file.'
                );

            }


            await fs.unlink(
                temporaryPath
            );


            console.warn(
                'Removed stale recovery temporary file:',
                temporaryPath
            );


        } catch (error) {

            /*
                File does not exist = normal.
            */

            if (
                error.code === 'ENOENT'
            ) {

                continue;

            }


            /*
                Do NOT silently continue if an
                existing temporary file cannot
                be inspected or removed.

                Otherwise the next recovery could
                behave unpredictably.
            */

            const cleanupError =
                new Error(
                    'Unable to remove an incomplete recovery file from a previous session.'
                );


            cleanupError.code =
                'STALE_RECOVERY_FILE';


            cleanupError.cause =
                error;


            throw cleanupError;

        }

    }

}

/* =========================================
   ORPHAN VAULT FILE DETECTION
========================================= */

async function detectOrphanVaultFiles(
    index
) {

    const filesDirectory =
        getVaultFilesDirectory();


    try {

        const entries =
            await fs.readdir(
                filesDirectory,
                {
                    withFileTypes: true
                }
            );


        /*
            Build a set containing every encrypted
            file that index.clm currently references.
        */

        const referencedFiles =
            new Set();


        for (const file of index.files) {

            if (
                typeof file.encryptedFile ===
                    'string' &&
                file.encryptedFile.length > 0
            ) {

                referencedFiles.add(
                    file.encryptedFile
                );

            }

        }


        const orphanFiles = [];


        for (const entry of entries) {

            /*
                Ignore folders, temporary files and
                anything that is not a final .clv file.
            */

            if (
                !entry.isFile() ||
                !entry.name.endsWith('.clv')
            ) {
                continue;
            }


            if (
                !referencedFiles.has(
                    entry.name
                )
            ) {

                const orphanPath =
                    path.join(
                        filesDirectory,
                        entry.name
                    );


                const stat =
                    await fs.stat(
                        orphanPath
                    );


                orphanFiles.push({

                    name:
                        entry.name,

                    path:
                        orphanPath,

                    size:
                        stat.size,

                    modifiedAt:
                        stat.mtime.toISOString()

                });

            }

        }


        return orphanFiles;


    } catch (error) {

        if (error.code === 'ENOENT') {
            return [];
        }


        console.error(
            'Orphan vault detection failed:',
            error
        );


        return [];

    }

}

/* =========================================
   ORPHAN QUARANTINE
========================================= */

async function quarantineOrphanVaultFiles(
    orphanFiles
) {

    if (
        !Array.isArray(orphanFiles) ||
        orphanFiles.length === 0
    ) {

        return [];

    }


    const orphanDirectory =
        getVaultOrphansDirectory();


    await fs.mkdir(
        orphanDirectory,
        {
            recursive: true
        }
    );


    const quarantined = [];


    for (const orphan of orphanFiles) {

        /*
            Never trust an arbitrary path here.

            Detection supplied the filename,
            but we reconstruct the source path
            ourselves inside vault/files.
        */

        const fileName =
            path.basename(
                orphan.name
            );


        if (
            !fileName.endsWith('.clv')
        ) {

            continue;

        }


        const sourcePath =
            path.join(
                getVaultFilesDirectory(),
                fileName
            );


        let destinationPath =
            path.join(
                orphanDirectory,
                fileName
            );


        /*
            Never overwrite an existing
            quarantined file.

            In the unlikely event that the
            same filename already exists,
            generate a unique quarantine name.
        */

        try {

            await fs.access(
                destinationPath
            );


            destinationPath =
                path.join(
                    orphanDirectory,
                    `${crypto.randomUUID()}-${fileName}`
                );


        } catch (error) {

            if (
                error.code !== 'ENOENT'
            ) {

                console.error(
                    'Unable to check orphan destination:',
                    error
                );

                continue;

            }

        }


        try {

            /*
                files/ and orphans/ are inside
                the same vault directory.

                fs.rename() therefore moves the
                file without copying its contents
                under the normal same-filesystem case.
            */

            await fs.rename(
                sourcePath,
                destinationPath
            );


            quarantined.push({

                originalName:
                    fileName,

                quarantinedName:
                    path.basename(
                        destinationPath
                    ),

                size:
                    orphan.size,

                quarantinedAt:
                    new Date()
                        .toISOString()

            });


            console.warn(
                'Quarantined orphan:',
                fileName
            );


        } catch (error) {

            console.error(
                'Unable to quarantine orphan:',
                fileName,
                error
            );

        }

    }


    return quarantined;

}

/* =========================================
   ORPHAN CONTAINER STRUCTURAL VALIDATION
========================================= */

async function validateOrphanStructure(
    orphanFileName
) {

    const safeName =
        path.basename(
            orphanFileName
        );


    if (
        !safeName.endsWith('.clv')
    ) {

        return {
            valid: false,
            reason:
                'Not a CrypticLocker container.'
        };

    }


    const orphanPath =
        path.join(
            getVaultOrphansDirectory(),
            safeName
        );


    try {

        const stat =
            await fs.stat(
                orphanPath
            );


        if (!stat.isFile()) {

            return {
                valid: false,
                reason:
                    'Container is not a file.',
                size:
                    stat.size
            };

        }


        /*
            Every supported CrypticLocker
            container starts with a 4-byte
            magic identifier.

            CLV1 = legacy container
            CLV2 = recovery-aware container
        */

        if (stat.size < 4) {

            return {
                valid: false,
                reason:
                    'Container is too small.',
                size:
                    stat.size
            };

        }


        const handle =
            await fs.open(
                orphanPath,
                'r'
            );


        const magicBuffer =
            Buffer.alloc(4);


        try {

            const { bytesRead } =
                await handle.read(
                    magicBuffer,
                    0,
                    4,
                    0
                );


            if (bytesRead !== 4) {

                return {
                    valid: false,
                    reason:
                        'Unable to read container header.',
                    size:
                        stat.size
                };

            }

        } finally {

            await handle.close();

        }


        const magic =
            magicBuffer.toString(
                'utf8'
            );


        /*
            CLV1 minimum layout:

            4  bytes magic
            12 bytes IV
            16 bytes authentication tag
        */

        if (magic === 'CLV1') {

            const minimumCLV1Size =
                4 +
                CLV_GCM_IV_LENGTH +
                CLV_GCM_TAG_LENGTH;


            if (
                stat.size <
                minimumCLV1Size
            ) {

                return {
                    valid: false,
                    reason:
                        'CLV1 container is incomplete.',
                    size:
                        stat.size,
                    containerVersion: 1
                };

            }

            const idMatch =
                safeName.match(
                    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
                );

            if (!idMatch) {

                return {
                    valid: false,
                    reason:
                        'Unable to recover CLV1 container ID.',
                    size:
                        stat.size,
                    containerVersion: 1
                };

            }

            return {
                valid: true,
                reason:
                    'CLV1 container structure is possible.',
                size:
                    stat.size,
                originalName:
                    `Recovered-${idMatch[1]}.bin`,
                containerVersion: 1
            };

        }


        /*
            CLV2 fixed header is 37 bytes.

            A valid CLV2 also requires:

            4-byte metadata length prefix
            at least 1 metadata byte
            32-byte SHA-256 digest
        */

        if (magic === 'CLV2') {

            const minimumCLV2Size =
                CLV2_HEADER_LENGTH +
                4 +
                1 +
                32;


            if (
                stat.size <
                minimumCLV2Size
            ) {

                return {
                    valid: false,
                    reason:
                        'CLV2 container is incomplete.',
                    size:
                        stat.size,
                    containerVersion:
                        CLV2_VERSION
                };

            }

            const idMatch =
                safeName.match(
                    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
                );

            if (!idMatch) {

                return {
                    valid: false,
                    reason:
                        'Unable to recover CLV2 container ID.',
                    size:
                        stat.size,
                    containerVersion:
                        CLV2_VERSION
                };

            }

            if (sessionManager.isUnlocked()) {

                try {

                    const metadataInfo =
                        await inspectCLV2OrphanMetadata(safeName);

                    if (
                        metadataInfo &&
                        metadataInfo.success === true &&
                        metadataInfo.originalName
                    ) {

                        return {
                            valid: true,
                            reason:
                                'CLV2 container structure is possible.',
                            size:
                                stat.size,
                            originalName:
                                metadataInfo.originalName,
                            containerVersion:
                                CLV2_VERSION
                        };

                    }

                } catch (metaErr) {

                    return {
                        valid: false,
                        reason:
                            metaErr.message ||
                            'CLV2 container validation failed.',
                        size:
                            stat.size,
                        containerVersion:
                            CLV2_VERSION
                    };

                }

            }

            return {
                valid: true,
                reason:
                    'CLV2 container structure is possible.',
                size:
                    stat.size,
                containerVersion:
                    CLV2_VERSION
            };

        }


        return {
            valid: false,
            reason:
                'Invalid CrypticLocker header.',
            size:
                stat.size,
            containerVersion:
                null
        };


    } catch (error) {

        return {
            valid: false,
            reason:
                `Unable to inspect container: ${error.message}`
        };

    }

}

/* =========================================
   SCAN QUARANTINED ORPHANS
========================================= */

async function scanQuarantinedOrphans() {

    const orphanDirectory =
        getVaultOrphansDirectory();


    try {

        const entries =
            await fs.readdir(
                orphanDirectory,
                {
                    withFileTypes: true
                }
            );


        const results = [];


        for (const entry of entries) {

            if (
                !entry.isFile() ||
                !entry.name.endsWith('.clv')
            ) {
                continue;
            }


            const validation =
                await validateOrphanStructure(
                    entry.name
                );


            results.push({

                name:
                    entry.name,

                ...validation

            });

        }


        return results;


    } catch (error) {

        /*
            No orphans directory yet is
            perfectly normal.
        */

        if (error.code === 'ENOENT') {
            return [];
        }


        console.error(
            'Unable to scan quarantined orphans:',
            error
        );


        return [];

    }

}

/* =========================================
   DELETE QUARANTINED ORPHAN
========================================= */

async function deleteQuarantinedOrphan(
    orphanFileName
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}


    if (
        typeof orphanFileName !== 'string' ||
        !orphanFileName.trim()
    ) {
        throw new Error(
            'Invalid quarantined container name.'
        );
    }


    /*
        Never trust a path supplied by
        the renderer.

        Only accept a plain filename.
    */

    const safeName =
        path.basename(
            orphanFileName
        );


    if (
        safeName !== orphanFileName ||
        !safeName.endsWith('.clv')
    ) {
        throw new Error(
            'Invalid quarantined container name.'
        );
    }


    const orphanPath =
        path.join(
            getVaultOrphansDirectory(),
            safeName
        );


    /*
        Verify that the target exists and is
        a regular file before deleting it.
    */

    const stat =
        await fs.stat(
            orphanPath
        );


    if (!stat.isFile()) {

        throw new Error(
            'Quarantined container is not a file.'
        );

    }


    await fs.unlink(
        orphanPath
    );


    return {
        success: true,
        name: safeName
    };

}

/* =========================================
   DELETE ALL INVALID QUARANTINED ORPHANS
========================================= */

async function deleteAllInvalidQuarantinedOrphans() {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}


    /*
        IMPORTANT:

        Never trust the renderer to tell us
        which containers are invalid.

        Perform a fresh backend scan immediately
        before deletion.
    */

    const orphans =
        await scanQuarantinedOrphans();


    const invalidOrphans =
        orphans.filter(
            orphan =>
                orphan &&
                orphan.valid === false
        );


    /*
        Nothing invalid currently exists.

        This is still a successful operation.
    */

    if (invalidOrphans.length === 0) {

        return {

            success: true,

            deletedCount: 0,

            failedCount: 0,

            deleted: [],

            failed: []

        };

    }


    const deleted = [];

    const failed = [];


    /*
        Delete each invalid container through
        the same secure single-file deletion
        function already used elsewhere.

        This preserves:

        - filename validation
        - quarantine-directory restriction
        - regular-file validation
    */

    for (const orphan of invalidOrphans) {

        try {

            const result =
                await deleteQuarantinedOrphan(
                    orphan.name
                );


            if (
                result &&
                result.success === true
            ) {

                deleted.push(
                    orphan.name
                );

            } else {

                failed.push({

                    name:
                        orphan.name,

                    message:
                        'Deletion did not complete.'

                });

            }


        } catch (error) {

            /*
                One failed deletion must not stop
                deletion of the remaining invalid
                containers.
            */

            console.error(
                'Unable to delete invalid quarantined container:',
                orphan.name,
                error
            );


            failed.push({

                name:
                    orphan.name,

                message:
                    error.message ||
                    'Unable to delete container.'

            });

        }

    }


    return {

        success:
            failed.length === 0,

        partial:
            deleted.length > 0 &&
            failed.length > 0,

        deletedCount:
            deleted.length,

        failedCount:
            failed.length,

        deleted,

        failed

    };

}

/* =========================================
   INSPECT CLV2 ORPHAN METADATA
========================================= */

async function inspectCLV2OrphanMetadata(
    orphanFileName
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const safeName =
        path.basename(
            orphanFileName
        );


    const idMatch =
        safeName.match(
            /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
        );


    if (!idMatch) {
        throw new Error(
            'Unable to recover CLV2 container ID.'
        );
    }


    const fileId =
        idMatch[1];


    const orphanPath =
        path.join(
            getVaultOrphansDirectory(),
            safeName
        );


    const stat =
        await fs.stat(
            orphanPath
        );


    if (
        !stat.isFile() ||
        stat.size <
            CLV2_HEADER_LENGTH + 5 + 32
    ) {
        throw new Error(
            'Invalid or incomplete CLV2 container.'
        );
    }


    /*
        Read fixed CLV2 header first.
    */

    const handle =
        await fs.open(
            orphanPath,
            'r'
        );


    const header =
        Buffer.alloc(
            CLV2_HEADER_LENGTH
        );


    try {

        const { bytesRead } =
            await handle.read(
                header,
                0,
                CLV2_HEADER_LENGTH,
                0
            );


        if (
            bytesRead !==
            CLV2_HEADER_LENGTH
        ) {
            throw new Error(
                'Unable to read CLV2 header.'
            );
        }

    } finally {

        await handle.close();

    }


    const magic =
        header
            .subarray(0, 4)
            .toString('utf8');


    if (magic !== 'CLV2') {
        throw new Error(
            'Not a CLV2 container.'
        );
    }


    const version =
        header.readUInt8(4);


    if (
        version !==
        CLV2_VERSION
    ) {
        throw new Error(
            `Unsupported CLV2 version: ${version}`
        );
    }


    const iv =
        header.subarray(
            5,
            5 + CLV_GCM_IV_LENGTH
        );


    const serializedMetadataLength =
        header.readUInt32BE(17);


    const authTag =
        header.subarray(
            21,
            21 + CLV_GCM_TAG_LENGTH
        );


    const MAX_METADATA_SIZE =
        1024 * 1024;


    if (
        serializedMetadataLength < 5 ||
        serializedMetadataLength >
            MAX_METADATA_SIZE + 4
    ) {
        throw new Error(
            'Invalid CLV2 metadata length.'
        );
    }


    /*
        IMPORTANT:

        AES-GCM authentication is for the WHOLE
        encrypted payload.

        Therefore we cannot authenticate only
        the metadata bytes.

        We stream the complete encrypted payload
        through AES-GCM, but retain only the
        small metadata prefix in RAM.

        Original file contents are discarded.
    */

    const decipher =
        crypto.createDecipheriv(
            'aes-256-gcm',
            vaultMasterKey,
            iv
        );


    decipher.setAAD(
        Buffer.from(
            `CrypticLocker|2|${fileId}`,
            'utf8'
        )
    );


    decipher.setAuthTag(
        authTag
    );


    let metadataBuffer =
        Buffer.alloc(0);


    let plaintextOffset =
        0;


    const metadataCollector =
        new Transform({

            transform(
                chunk,
                encoding,
                callback
            ) {

                try {

                    if (
                        plaintextOffset <
                        serializedMetadataLength
                    ) {

                        const remaining =
                            serializedMetadataLength -
                            plaintextOffset;


                        const take =
                            Math.min(
                                remaining,
                                chunk.length
                            );


                        metadataBuffer =
                            Buffer.concat([
                                metadataBuffer,
                                chunk.subarray(
                                    0,
                                    take
                                )
                            ]);

                    }


                    plaintextOffset +=
                        chunk.length;


                    /*
                        Do not forward plaintext.

                        File contents and SHA-256
                        are intentionally discarded.
                    */

                    callback();

                } catch (error) {

                    callback(
                        error
                    );

                }

            }

        });


    const encryptedStream =
        fsSync.createReadStream(
            orphanPath,
            {
                start:
                    CLV2_HEADER_LENGTH
            }
        );


    try {

        /*
            pipeline resolves only when
            AES-GCM authentication succeeds.
        */

        await pipeline(
            encryptedStream,
            decipher,
            metadataCollector
        );


        if (
            metadataBuffer.length !==
            serializedMetadataLength
        ) {
            throw new Error(
                'CLV2 metadata is incomplete.'
            );
        }


        const jsonLength =
            metadataBuffer
                .readUInt32BE(0);


        if (
            jsonLength + 4 !==
            serializedMetadataLength
        ) {
            throw new Error(
                'CLV2 metadata length mismatch.'
            );
        }


        let metadata;


        try {

            metadata =
                JSON.parse(
                    metadataBuffer
                        .subarray(4)
                        .toString('utf8')
                );

        } catch {

            throw new Error(
                'Invalid CLV2 metadata JSON.'
            );

        }


        if (
            !metadata ||
            metadata.version !==
                CLV2_VERSION ||
            metadata.id !==
                fileId ||
            typeof metadata.name !==
                'string' ||
            !metadata.name.trim() ||
            !Number.isSafeInteger(
                metadata.size
            ) ||
            metadata.size < 0
        ) {
            throw new Error(
                'Invalid CLV2 recovery metadata.'
            );
        }


        /*
            Prevent metadata from supplying
            directory traversal as a filename.
        */

        const originalName =
            path.basename(
                metadata.name
            );


        if (
            !originalName ||
            originalName === '.' ||
            originalName === '..'
        ) {
            throw new Error(
                'Invalid recovered filename.'
            );
        }


        return {

            success: true,

            fileId,

            originalName,

            size:
                metadata.size,

            metadata,

            containerVersion:
                CLV2_VERSION

        };


    } finally {

        if (
            metadataBuffer.length > 0
        ) {
            metadataBuffer.fill(0);
        }

    }

}

/* =========================================
   AUTO RECOVER QUARANTINED ORPHAN
========================================= */

async function recoverQuarantinedOrphanAuto(
    orphanFileName,
    destinationDirectory,
    progressCallback = null
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault must be unlocked before recovery.');
}

    const safeName =
        path.basename(
            orphanFileName
        );


    if (!safeName.endsWith('.clv')) {

        throw new Error(
            'Invalid CrypticLocker container.'
        );

    }


    const orphanPath =
        path.join(
            getVaultOrphansDirectory(),
            safeName
        );


    /*
        Detect container version before
        choosing the recovery engine.
    */

    const handle =
        await fs.open(
            orphanPath,
            'r'
        );


    const magicBuffer =
        Buffer.alloc(4);


    try {

        const { bytesRead } =
            await handle.read(
                magicBuffer,
                0,
                4,
                0
            );


        if (bytesRead !== 4) {

            throw new Error(
                'Unable to read container header.'
            );

        }

    } finally {

        await handle.close();

    }


    const magic =
        magicBuffer.toString(
            'utf8'
        );


    /*
        Legacy CLV1 recovery.
    */

    if (magic === 'CLV1') {

        return await recoverOrphanFile(
            safeName,
            destinationDirectory,
            progressCallback
        );

    }


    /*
        Recovery-aware CLV2 container.
    */

    if (magic === 'CLV2') {

        return await recoverCLV2OrphanFile(
            safeName,
            destinationDirectory,
            progressCallback
        );

    }

    throw new Error(
        'Unsupported or damaged CrypticLocker container.'
    );

}

/* =========================================
   CLV2 ORPHAN FILE RECOVERY
========================================= */

async function recoverCLV2OrphanFile(
    orphanFileName,
    destinationPath,
    onProgress = null
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const safeName =
        path.basename(
            orphanFileName
        );


    if (!safeName.endsWith('.clv')) {

        throw new Error(
            'Invalid CrypticLocker container.'
        );

    }


    /*
        CLV2 AES-GCM AAD contains the file ID.

        Normal quarantine names may be:

        <UUID>.clv

        or, if a quarantine filename collision
        occurred:

        <quarantine-UUID>-<original-UUID>.clv

        Therefore recover the ORIGINAL UUID
        immediately before ".clv".
    */

    const idMatch =
        safeName.match(
            /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
        );


    if (!idMatch) {

        throw new Error(
            'Unable to recover CLV2 container ID.'
        );

    }


    const fileId =
        idMatch[1];


    const sourcePath =
        path.join(
            getVaultOrphansDirectory(),
            safeName
        );


    /*
        restoreCLV2FileStream() already performs:

        - CLV2 header validation
        - version validation
        - AES-256-GCM authentication
        - encrypted metadata recovery
        - metadata/file-ID validation
        - original-size validation
        - SHA-256 verification
        - storage-space validation
        - temporary-output cleanup
        - safe final rename

        The quarantined encrypted container
        remains untouched.
    */

    const result =
        await restoreCLV2FileStream(
            sourcePath,
            destinationPath,
            fileId,
            onProgress
        );


    if (
        !result ||
        result.success !== true ||
        !result.metadata
    ) {

        throw new Error(
            'CLV2 recovery did not complete successfully.'
        );

    }


    /*
        Extra defensive checks before reporting
        the recovery as successful.
    */

    if (
        result.metadata.id !==
        fileId
    ) {

        throw new Error(
            'Recovered CLV2 file ID does not match the container.'
        );

    }


    if (
        typeof result.metadata.name !==
            'string' ||
        !result.metadata.name.trim()
    ) {

        throw new Error(
            'Recovered CLV2 filename is invalid.'
        );

    }


    return {

        ...result,

        originalName:
            result.metadata.name,

        orphanFileName:
            safeName,

        containerVersion:
            CLV2_VERSION

    };

}

/* =========================================
   ORPHAN FILE RECOVERY
========================================= */

async function recoverOrphanFile(
    orphanFileName,
    destinationPath,
    onProgress = null
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const safeName =
        path.basename(
            orphanFileName
        );


    /*
        Recover file ID from:

        <UUID>.clv
    */

    const idMatch =
        safeName.match(
            /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
        );


    if (!idMatch) {

        throw new Error(
            'Unable to recover container ID.'
        );

    }


    const fileId =
        idMatch[1];


    const sourcePath =
        path.join(
            getVaultOrphansDirectory(),
            safeName
        );


    /*
        Never write directly to final output.

        If recovery fails halfway through,
        only this temporary file is removed.
    */

    const temporaryPath =
        `${destinationPath}.crypticlocker-recovery-part`;


    let sourceHandle = null;


    try {

        const stat =
            await fs.stat(
                sourcePath
            );


        if (stat.size < 32) {

            throw new Error(
                'Encrypted container is incomplete.'
            );

        }

        const totalBytes =
    Math.max(
        0,
        stat.size - 32
    );


let processedBytes = 0;


        /*
            Check destination storage before
            reading/decrypting several GB.
        */

        const storageCheck =
            await ensureStorageAvailable(
                path.dirname(
                    destinationPath
                ),
                stat.size - 32
            );


        if (!storageCheck.enough) {

            const error =
                new Error(
                    'Not enough storage space.'
                );


            error.code =
                'INSUFFICIENT_STORAGE';


            error.requiredBytes =
                storageCheck.requiredWithBuffer;


            error.availableBytes =
                storageCheck.availableBytes;


            throw error;

        }


        sourceHandle =
            await fs.open(
                sourcePath,
                'r'
            );


        const header =
            Buffer.alloc(32);


        const { bytesRead } =
            await sourceHandle.read(
                header,
                0,
                32,
                0
            );


        if (bytesRead !== 32) {

            throw new Error(
                'Unable to read encrypted container header.'
            );

        }


        const magic =
            header
                .subarray(0, 4)
                .toString('utf8');


        if (magic !== 'CLV1') {

            throw new Error(
                'Invalid CrypticLocker container.'
            );

        }


        const iv =
            header.subarray(
                4,
                16
            );


        const authTag =
            header.subarray(
                16,
                32
            );


        await sourceHandle.close();

        sourceHandle = null;


        const decipher =
            crypto.createDecipheriv(
                'aes-256-gcm',
                vaultMasterKey,
                iv
            );


        decipher.setAAD(
            Buffer.from(
                `CrypticLocker|1|${fileId}`,
                'utf8'
            )
        );


        decipher.setAuthTag(
            authTag
        );


        const readStream =
            fsSync.createReadStream(
                sourcePath,
                {
                    start: 32
                }
            );


        const writeStream =
            fsSync.createWriteStream(
                temporaryPath,
                {
                    flags: 'wx'
                }
            );

            const progressTransform =
    new Transform({

        transform(
            chunk,
            encoding,
            callback
        ) {

            processedBytes +=
                chunk.length;


            if (
                typeof onProgress ===
                'function'
            ) {

                onProgress({

                    processedBytes,

                    totalBytes

                });

            }


            callback(
                null,
                chunk
            );

        }

    });


        /*
            AES-GCM authentication is checked
            when the decipher finishes.

            If authentication fails, pipeline()
            throws and temporary output is removed.
        */

        await pipeline(
            readStream,
            decipher,
            progressTransform,
            writeStream
        );

        await fs.rename(
            temporaryPath,
            destinationPath
        );


        return {

            success: true,

            fileId,

            destinationPath

        };


    } catch (error) {

        /*
            Recovery failed:
            remove only our partial output.

            The quarantined .clv is NEVER
            deleted here.
        */

        try {

            await fs.unlink(
                temporaryPath
            );

        } catch (cleanupError) {

            if (
                cleanupError.code !==
                'ENOENT'
            ) {

                console.error(
                    'Unable to clean orphan recovery temp file:',
                    cleanupError
                );

            }

        }


        throw error;


    } finally {

        if (sourceHandle) {

            try {

                await sourceHandle.close();

            } catch {
                // Ignore close failure.
            }

        }

    }

}

/* =========================================
   STORAGE SPACE CHECK
========================================= */

const STORAGE_SAFETY_BUFFER =
    512 * 1024 * 1024; // 512 MB


async function getAvailableStorage(
    targetPath
) {

    const stats =
        await fs.statfs(
            targetPath
        );


    return (
        Number(stats.bavail) *
        Number(stats.bsize)
    );

}


async function ensureVaultStorageAvailable(
    requiredBytes
) {

    const availableBytes =
        await getAvailableStorage(
            getVaultDirectory()
        );


    const requiredWithBuffer =
        requiredBytes +
        STORAGE_SAFETY_BUFFER;


    return {

        enough:
            availableBytes >=
            requiredWithBuffer,

        availableBytes,

        requiredBytes,

        requiredWithBuffer,

        safetyBuffer:
            STORAGE_SAFETY_BUFFER

    };

}

async function ensureStorageAvailable(
    targetPath,
    requiredBytes
) {

    const availableBytes =
        await getAvailableStorage(
            targetPath
        );


    const requiredWithBuffer =
        requiredBytes +
        STORAGE_SAFETY_BUFFER;


    return {

        enough:
            availableBytes >=
            requiredWithBuffer,

        availableBytes,

        requiredBytes,

        requiredWithBuffer,

        safetyBuffer:
            STORAGE_SAFETY_BUFFER

    };

}

/* =========================================
   ENCRYPT FILE
========================================= */

async function calculateEncryptedFileHash(
    fileMetadata
) {

    if (
    !sessionManager.isUnlocked()
) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const encryptedPath =
        path.join(
            getVaultFilesDirectory(),
            fileMetadata.encryptedFile
        );


    const handle =
        await fs.open(
            encryptedPath,
            'r'
        );


    const header =
        Buffer.alloc(32);


    try {

        const { bytesRead } =
            await handle.read(
                header,
                0,
                32,
                0
            );


        if (bytesRead !== 32) {
            throw new Error(
                'Encrypted file is corrupted.'
            );
        }

    } finally {

        await handle.close();

    }


    if (
        header
            .subarray(0, 4)
            .toString('utf8') !==
        'CLV1'
    ) {

        throw new Error(
            'Invalid CrypticLocker file.'
        );

    }


    const iv =
        header.subarray(4, 16);

    const authTag =
        header.subarray(16, 32);


    const decipher =
        crypto.createDecipheriv(
            'aes-256-gcm',
            vaultMasterKey,
            iv
        );


    decipher.setAAD(
        Buffer.from(
            `CrypticLocker|1|${fileMetadata.id}`,
            'utf8'
        )
    );


    decipher.setAuthTag(
        authTag
    );


    const hash =
        crypto.createHash(
            'sha256'
        );


    const readStream =
        fsSync.createReadStream(
            encryptedPath,
            {
                start: 32
            }
        );


    return new Promise(
        (resolve, reject) => {

            readStream
                .pipe(decipher);


            decipher.on(
                'data',
                chunk => {

                    hash.update(chunk);

                }
            );


            decipher.on(
                'end',
                () => {

                    resolve(
                        hash.digest('hex')
                    );

                }
            );


            decipher.on(
                'error',
                reject
            );


            readStream.on(
                'error',
                reject
            );

        }
    );
}

async function encryptFile(
    sourcePath,
    removeOriginal = false,
    saveToIndex = true,
    onProgress = null
) {

    if (
    !sessionManager.isUnlocked()
) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const stat =
        await fs.stat(sourcePath);


    if (!stat.isFile()) {
        throw new Error(
            'Selected item is not a file.'
        );
    }


    const originalName =
        path.basename(sourcePath);

    const extension =
        path.extname(originalName);

    const fileId =
        crypto.randomUUID();

    const encryptedFileName =
        `${fileId}.clv`;

    const filesDirectory =
        getVaultFilesDirectory();

    await fs.mkdir(
        filesDirectory,
        { recursive: true }
    );


    const iv =
        crypto.randomBytes(12);


    const cipher =
    crypto.createCipheriv(
        'aes-256-gcm',
        vaultMasterKey,
        iv
    );


    const aad =
        Buffer.from(
            `CrypticLocker|1|${fileId}`,
            'utf8'
        );


    cipher.setAAD(aad);


    const destinationPath =
        path.join(
            filesDirectory,
            encryptedFileName
        );

    const temporaryPath =
        `${destinationPath}.tmp`;

        /*
    Calculate SHA-256 during the SAME
    streaming pass used for encryption.

    This avoids reading large files once
    for hashing and then again for encryption.
*/

const hash =
    crypto.createHash(
        'sha256'
    );

    let originalHash = null;


    /*
        Container header:

        CLV1 = 4 bytes
        IV   = 12 bytes
        TAG  = 16 bytes

        GCM tag is only available after
        encryption finishes.

        Therefore reserve 16 bytes for it
        and write the real tag afterward.
    */

    const header =
        Buffer.concat([
            Buffer.from('CLV1'),
            iv,
            Buffer.alloc(16)
        ]);


    try {

        /*
            Create file exclusively so an
            existing temporary file is never
            silently overwritten.
        */

        const handle =
            await fs.open(
                temporaryPath,
                'wx'
            );


        try {

            await handle.write(
                header,
                0,
                header.length,
                0
            );

        } finally {

            await handle.close();

        }


        const readStream =
            fsSync.createReadStream(
                sourcePath
            );


        /*
            Start ciphertext immediately
            after the 32-byte header.
        */

        const writeStream =
    fsSync.createWriteStream(
        temporaryPath,
        {
            flags: 'r+',
            start: 32
        }
    );


/*
    Every plaintext chunk passes through
    this transform before encryption.

    The chunk is added to SHA-256 and then
    immediately forwarded to AES-GCM.
*/

const hashTransform =
    new Transform({

        transform(
            chunk,
            encoding,
            callback
        ) {

            hash.update(
                chunk
            );


            callback(
                null,
                chunk
            );

        }

    });
    
    const progressTransform =
    createProgressTransform(
        processedBytes => {

            if (
                typeof onProgress ===
                'function'
            ) {

                onProgress({

                    fileId,

                    name:
                        originalName,

                    processedBytes,

                    totalBytes:
                        stat.size

                });

            }

        }
    );


await pipeline(
    readStream,
    progressTransform,
    hashTransform,
    cipher,
    writeStream
);


        /*
    pipeline() has finished, therefore every
    plaintext byte has now been hashed.
*/

originalHash =
    hash.digest(
        'hex'
    );
    
    const authTag =
            cipher.getAuthTag();


        /*
            Insert authentication tag into
            reserved header bytes.
        */

        const tagHandle =
            await fs.open(
                temporaryPath,
                'r+'
            );


        try {

            await tagHandle.write(
                authTag,
                0,
                authTag.length,
                16
            );

        } finally {

            await tagHandle.close();

        }


        const encryptedStat =
            await fs.stat(
                temporaryPath
            );


        const expectedSize =
            32 + stat.size;


        if (
            encryptedStat.size !==
            expectedSize
        ) {

            throw new Error(
                'Encrypted file size verification failed.'
            );

        }


        await fs.rename(
            temporaryPath,
            destinationPath
        );


    } catch (error) {

        try {
            await fs.unlink(
                temporaryPath
            );
        } catch {
            // Best-effort cleanup
        }


        throw error;

    }


    const fileMetadata = {

        id: fileId,

        name: originalName,

        extension,

        type:
            getFileType(originalName),

        size: stat.size,

        sha256: originalHash,

        formattedSize:
            formatFileSize(stat.size),

        modifiedAt:
            stat.mtime.toISOString(),

        addedAt:
            new Date().toISOString(),

        encryptedFile:
            encryptedFileName

    };


    /*
    Persist encrypted metadata only when
    this is a standalone file operation.

    Folder transactions commit all files
    together after every file succeeds.
*/

if (saveToIndex) {

    try {

        const index =
            await readVaultIndex();


        index.files.push(
            fileMetadata
        );


        await writeVaultIndex(
            index
        );


    } catch (error) {

        try {

            await fs.unlink(
                destinationPath
            );

        } catch {
            // Best-effort cleanup
        }


        throw error;

    }

}


    /*
        MOVE mode:

        Before deleting the source we verify
        the encrypted file by decrypting it
        as a stream and comparing its hash.
    */

    if (removeOriginal) {

        const verificationHash =
            await calculateEncryptedFileHash(
                fileMetadata
            );


        if (
            verificationHash !==
            fileMetadata.sha256
        ) {

            throw new Error(
                'Vault verification failed. Original file was not removed.'
            );

        }


        try {

            await fs.unlink(
                sourcePath
            );


            fileMetadata.sourceRemoved =
                true;


        } catch {

            fileMetadata.sourceRemoved =
                false;

            fileMetadata.sourceRemoveError =
                'The file was encrypted successfully, but the original could not be removed.';

        }


    } else {

        fileMetadata.sourceRemoved =
            false;

    }


    return fileMetadata;
}

/* =========================================
   ENCRYPT FILE - CLV2
========================================= */

async function encryptFileV2(
    sourcePath,
    options = {}
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const {
    parentFolderId = null,
    relativePath = null,
    operationId = null,
    onProgress = null,
    mode = 'copy'
} = options;


    const stat =
        await fs.stat(
            sourcePath
        );


    if (!stat.isFile()) {
        throw new Error(
            'Source is not a file.'
        );
    }


    const originalName =
        path.basename(
            sourcePath
        );


    const fileId =
        crypto.randomUUID();


    const encryptedFileName =
        `${fileId}.clv`;


    const filesDirectory =
        getVaultFilesDirectory();


    await fs.mkdir(
        filesDirectory,
        {
            recursive: true
        }
    );


    const finalPath =
        path.join(
            filesDirectory,
            encryptedFileName
        );


    const temporaryPath =
        `${finalPath}.tmp`;


    const iv =
        crypto.randomBytes(
            CLV_GCM_IV_LENGTH
        );


    /*
        Recovery metadata intentionally does
        NOT contain SHA-256.

        The final SHA-256 digest is generated
        while the file is streamed and is
        appended to the encrypted payload.
    */

    const metadata =
        createCLV2Metadata({

            fileId,

            originalName,

            stat,

            parentFolderId,

            relativePath

        });


    const serializedMetadata =
        serializeCLV2Metadata(
            metadata
        );


    /*
        Plaintext payload:

        [4-byte metadata length]
        [metadata JSON]
        [original file bytes]
        [32-byte SHA-256 digest]
    */

    const sha256DigestLength =
        32;


    const aad =
        Buffer.from(
            `CrypticLocker|2|${fileId}`,
            'utf8'
        );


    const cipher =
    crypto.createCipheriv(
        'aes-256-gcm',
        vaultMasterKey,
        iv
    );


    cipher.setAAD(
        aad
    );


    const hash =
        crypto.createHash(
            'sha256'
        );


    let temporaryCreated =
        false;


    try {

        /*
            Create fixed-size placeholder header.

            Real authentication tag is written
            after encryption finishes.
        */

        const handle =
            await fs.open(
                temporaryPath,
                'wx'
            );


        temporaryCreated =
            true;


        try {

            await handle.write(
                Buffer.alloc(
                    CLV2_HEADER_LENGTH
                ),
                0,
                CLV2_HEADER_LENGTH,
                0
            );

        } finally {

            await handle.close();

        }


        /*
            Ciphertext starts immediately after
            the 37-byte CLV2 header.
        */

        const outputStream =
            fsSync.createWriteStream(
                temporaryPath,
                {
                    flags: 'r+',
                    start:
                        CLV2_HEADER_LENGTH
                }
            );


        /*
    CLV2 plaintext layout:

    [ encrypted metadata ]
    [ original file bytes ]
    [ SHA-256 digest ]

    The cipher MUST already be connected to
    outputStream before plaintext is written.
    Otherwise cipher backpressure can deadlock
    while processing larger files.
*/


/*
    Start consuming encrypted output
    immediately.

    Do not await yet because plaintext still
    needs to be written into the cipher.
*/

const cipherPipeline =
    pipeline(
        cipher,
        outputStream
    );


/*
    Metadata is the first authenticated and
    encrypted part of the CLV2 payload.
*/

if (
    !cipher.write(
        serializedMetadata
    )
) {

    await new Promise(
        resolve =>
            cipher.once(
                'drain',
                resolve
            )
    );

}


const inputStream =
    fsSync.createReadStream(
        sourcePath
    );


let processedBytes =
    0;


const hashTransform =
    new Transform({

        transform(
            chunk,
            encoding,
            callback
        ) {

            try {

                if (
    isVaultOperationCancelled(
        operationId
    )
) {

    callback(
        createVaultOperationCancelledError()
    );

    return;

}

hash.update(
                    chunk
                );

                if (
    operationId &&
    isVaultOperationCancelled(
        operationId
    )
) {

    callback(
        createVaultOperationCancelledError()
    );

    return;

}

                processedBytes +=
                    chunk.length;


                if (
                    typeof onProgress ===
                    'function'
                ) {

                    onProgress({

                        fileId,

                        name:
                            originalName,

                        processedBytes,

                        totalBytes:
                            stat.size

                    });

                }


                callback(
                    null,
                    chunk
                );

            } catch (error) {

                callback(
                    error
                );

            }

        }

    });


/*
    Writable bridge.

    It forwards plaintext file bytes into the
    already-running AES-GCM cipher without
    ending the cipher when the source file
    finishes.

    We still need to append SHA-256 afterward.
*/

const cipherInput =
    new Writable({

        write(
            chunk,
            encoding,
            callback
        ) {

            try {

                if (
                    cipher.write(
                        chunk
                    )
                ) {

                    callback();
                    return;

                }


                cipher.once(
                    'drain',
                    callback
                );

            } catch (error) {

                callback(
                    error
                );

            }

        }

    });


await pipeline(
    inputStream,
    hashTransform,
    cipherInput
);


/*
    Every original file byte has now passed
    through SHA-256 exactly once.
*/

const sha256Digest =
    hash.digest();


if (
    sha256Digest.length !==
    sha256DigestLength
) {

    throw new Error(
        'Invalid SHA-256 digest.'
    );

}


/*
    Digest is the final encrypted part of the
    CLV2 plaintext payload.

    cipher.end() appends it and then finalizes
    AES-GCM.
*/

cipher.end(
    sha256Digest
);


/*
    Now wait until every encrypted byte has
    actually reached the temporary file.
*/

await cipherPipeline;


        const authTag =
            cipher.getAuthTag();


        if (
            authTag.length !==
            CLV_GCM_TAG_LENGTH
        ) {

            throw new Error(
                'Invalid CLV2 authentication tag.'
            );

        }


        /*
            Final CLV2 fixed header:

            0..3   = CLV2
            4      = version
            5..16  = IV
            17..20 = serialized metadata size
            21..36 = AES-GCM authentication tag
        */

        const header =
            Buffer.alloc(
                CLV2_HEADER_LENGTH
            );


        CLV2_MAGIC.copy(
            header,
            0
        );


        header.writeUInt8(
            CLV2_VERSION,
            4
        );


        iv.copy(
            header,
            5
        );


        header.writeUInt32BE(
            serializedMetadata.length,
            17
        );


        authTag.copy(
            header,
            21
        );


        const headerHandle =
            await fs.open(
                temporaryPath,
                'r+'
            );


        try {

            await headerHandle.write(
                header,
                0,
                header.length,
                0
            );


            await headerHandle.sync();

        } finally {

            await headerHandle.close();

        }


        /*
            Verify final physical container size.

            AES-GCM does not change plaintext
            length.

            Container =
                37-byte header
                + serialized metadata
                + original file
                + 32-byte SHA-256
        */

        const encryptedStat =
            await fs.stat(
                temporaryPath
            );


        const expectedSize =
            CLV2_HEADER_LENGTH +
            serializedMetadata.length +
            stat.size +
            sha256DigestLength;


        if (
            encryptedStat.size !==
            expectedSize
        ) {

            throw new Error(
                'CLV2 encrypted file size verification failed.'
            );

        }


        await fs.rename(
            temporaryPath,
            finalPath
        );


        temporaryCreated =
            false;


        return {

            id:
                fileId,

            name:
                originalName,

            encryptedFile:
                encryptedFileName,

            extension:
                path.extname(
                    originalName
                ),

            type:
                getFileType(
                    originalName
                ),

            size:
                stat.size,

            sha256:
                sha256Digest.toString(
                    'hex'
                ),

            formattedSize:
                formatFileSize(
                    stat.size
                ),

            modifiedAt:
                stat.mtime.toISOString(),

            addedAt:
                new Date().toISOString(),

            mode:
                mode === 'move' ? 'move' : 'copy',

            parentFolderId,

            relativePath,

            containerVersion:
                CLV2_VERSION

        };


    } catch (error) {

        if (temporaryCreated) {

            try {

                await fs.unlink(
                    temporaryPath
                );

            } catch (cleanupError) {

                if (
                    cleanupError.code !==
                    'ENOENT'
                ) {

                    console.error(
                        'Unable to remove incomplete CLV2 file:',
                        cleanupError
                    );

                }

            }

        }


        throw error;

    }

}

/* =========================================
   DETECT CLV CONTAINER VERSION
========================================= */

async function detectCLVContainerVersion(
    encryptedPath
) {

    let handle;

    try {
        handle =
            await fs.open(
                encryptedPath,
                'r'
            );
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(
                'The encrypted container file could not be found in vault storage. It may have been moved, renamed, or deleted.'
            );
        }
        throw error;
    }


    const magicBuffer =
        Buffer.alloc(4);


    try {

        const { bytesRead } =
            await handle.read(
                magicBuffer,
                0,
                4,
                0
            );


        if (bytesRead !== 4) {

            throw new Error(
                'Encrypted container header is incomplete.'
            );

        }

    } finally {

        await handle.close();

    }


    const magic =
        magicBuffer.toString(
            'utf8'
        );


    if (magic === 'CLV1') {

        return {
            version: 1,
            magic: 'CLV1'
        };

    }


    if (magic === 'CLV2') {

        return {
            version: 2,
            magic: 'CLV2'
        };

    }


    throw new Error(
        'Unknown CrypticLocker container format.'
    );

}

/* =========================================
   RESTORE CLV2 FILE - STREAMING
========================================= */

async function restoreCLV2FileStream(
    encryptedPath,
    destinationPath,
    expectedFileId = null,
    onProgress = null,
    operationId = null
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const containerStat =
        await fs.stat(
            encryptedPath
        );


    if (
        !containerStat.isFile() ||
        containerStat.size <
            CLV2_HEADER_LENGTH + 4 + 1 + 32
    ) {
        throw new Error(
            'Invalid or incomplete CLV2 container.'
        );
    }


    /* -------------------------
       READ FIXED HEADER
    ------------------------- */

    const headerHandle =
        await fs.open(
            encryptedPath,
            'r'
        );


    const header =
        Buffer.alloc(
            CLV2_HEADER_LENGTH
        );


    try {

        const { bytesRead } =
            await headerHandle.read(
                header,
                0,
                CLV2_HEADER_LENGTH,
                0
            );


        if (
            bytesRead !==
            CLV2_HEADER_LENGTH
        ) {
            throw new Error(
                'Unable to read CLV2 header.'
            );
        }

    } finally {

        await headerHandle.close();

    }


    const magic =
        header
            .subarray(0, 4)
            .toString('utf8');


    if (
        magic !==
        CLV2_MAGIC.toString('utf8')
    ) {
        throw new Error(
            'Invalid CLV2 magic header.'
        );
    }


    const version =
        header.readUInt8(4);


    if (
        version !==
        CLV2_VERSION
    ) {
        throw new Error(
            `Unsupported CLV2 version: ${version}`
        );
    }


    const iv =
        header.subarray(
            5,
            5 + CLV_GCM_IV_LENGTH
        );


    const serializedMetadataLength =
        header.readUInt32BE(17);


    const authTag =
        header.subarray(
            21,
            21 + CLV_GCM_TAG_LENGTH
        );


    const MAX_METADATA_SIZE =
        1024 * 1024;


    if (
        serializedMetadataLength < 5 ||
        serializedMetadataLength >
            MAX_METADATA_SIZE + 4
    ) {
        throw new Error(
            'Invalid CLV2 metadata length.'
        );
    }


    /* -------------------------
       DETERMINE FILE ID
    ------------------------- */

    let fileId =
        expectedFileId;


    if (!fileId) {

        const encryptedName =
            path.basename(
                encryptedPath
            );


        const match =
            encryptedName.match(
                /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
            );


        if (!match) {
            throw new Error(
                'Unable to determine CLV2 file ID.'
            );
        }


        fileId =
            match[1];

    }


    /* -------------------------
       CONTAINER SIZE CHECK
    ------------------------- */

    const encryptedPayloadLength =
        containerStat.size -
        CLV2_HEADER_LENGTH;


    /*
        Payload plaintext is exactly:

        serialized metadata
        + original file
        + 32-byte SHA-256

        AES-GCM does not change payload length.
    */

    const originalFileSize =
        encryptedPayloadLength -
        serializedMetadataLength -
        32;


    if (
        !Number.isSafeInteger(
            originalFileSize
        ) ||
        originalFileSize < 0
    ) {
        throw new Error(
            'Invalid CLV2 payload size.'
        );
    }


    /* -------------------------
       DESTINATION SAFETY
    ------------------------- */

    const temporaryPath =
        `${destinationPath}.crypticlocker-part`;


    try {

        await fs.access(
            temporaryPath
        );


        throw new Error(
            'A temporary restore file already exists.'
        );

    } catch (error) {

        if (
            error.message ===
            'A temporary restore file already exists.'
        ) {
            throw error;
        }


        if (
            error.code !== 'ENOENT'
        ) {
            throw error;
        }

    }


    /* -------------------------
       STORAGE CHECK
    ------------------------- */

    const storageCheck =
        await ensureStorageAvailable(
            path.dirname(
                destinationPath
            ),
            originalFileSize
        );


    if (!storageCheck.enough) {

        const error =
            new Error(
                'Not enough storage space.'
            );


        error.code =
            'INSUFFICIENT_STORAGE';


        error.requiredBytes =
            storageCheck.requiredWithBuffer;


        error.availableBytes =
            storageCheck.availableBytes;


        throw error;

    }


    /* -------------------------
       STREAMING DECRYPTION
    ------------------------- */

    const decipher =
        crypto.createDecipheriv(
            'aes-256-gcm',
            vaultMasterKey,
            iv
        );


    decipher.setAAD(
        Buffer.from(
            `CrypticLocker|2|${fileId}`,
            'utf8'
        )
    );


    decipher.setAuthTag(
        authTag
    );


    const hash =
        crypto.createHash(
            'sha256'
        );


    let plaintextOffset = 0;

    let metadataBuffer =
        Buffer.alloc(0);

    let metadata = null;

    let processedFileBytes = 0;

    let storedDigest =
        Buffer.alloc(0);


    const parser =
        new Transform({

            transform(
                chunk,
                encoding,
                callback
            ) {

                try {

                    if (
                        operationId &&
                        isVaultOperationCancelled(operationId)
                    ) {
                        callback(
                            createVaultOperationCancelledError()
                        );
                        return;
                    }

                    let offset = 0;


                    while (
                        offset <
                        chunk.length
                    ) {

                        /*
                            REGION 1:
                            serialized metadata
                        */

                        if (
                            plaintextOffset <
                            serializedMetadataLength
                        ) {

                            const remainingMetadata =
                                serializedMetadataLength -
                                plaintextOffset;


                            const take =
                                Math.min(
                                    remainingMetadata,
                                    chunk.length - offset
                                );


                            metadataBuffer =
                                Buffer.concat([
                                    metadataBuffer,
                                    chunk.subarray(
                                        offset,
                                        offset + take
                                    )
                                ]);


                            plaintextOffset +=
                                take;


                            offset +=
                                take;


                            if (
                                plaintextOffset ===
                                serializedMetadataLength
                            ) {

                                const jsonLength =
                                    metadataBuffer
                                        .readUInt32BE(0);


                                if (
                                    jsonLength + 4 !==
                                    serializedMetadataLength
                                ) {
                                    throw new Error(
                                        'CLV2 metadata length mismatch.'
                                    );
                                }


                                const json =
                                    metadataBuffer
                                        .subarray(4)
                                        .toString('utf8');


                                try {

                                    metadata =
                                        JSON.parse(
                                            json
                                        );

                                } catch {

                                    throw new Error(
                                        'Invalid CLV2 metadata JSON.'
                                    );

                                }


                                if (
                                    !metadata ||
                                    metadata.version !==
                                        CLV2_VERSION ||
                                    metadata.id !==
                                        fileId ||
                                    typeof metadata.name !==
                                        'string' ||
                                    !Number.isSafeInteger(
                                        metadata.size
                                    ) ||
                                    metadata.size < 0
                                ) {
                                    throw new Error(
                                        'Invalid CLV2 recovery metadata.'
                                    );
                                }


                                if (
                                    metadata.size !==
                                    originalFileSize
                                ) {
                                    throw new Error(
                                        'CLV2 original file size mismatch.'
                                    );
                                }


                                /*
                                    Metadata is tiny and no
                                    longer needed as raw bytes.
                                */

                                metadataBuffer =
                                    Buffer.alloc(0);

                            }


                            continue;

                        }


                        /*
                            REGION 2:
                            original file bytes
                        */

                        if (
                            processedFileBytes <
                            originalFileSize
                        ) {

                            const remainingFile =
                                originalFileSize -
                                processedFileBytes;


                            const take =
                                Math.min(
                                    remainingFile,
                                    chunk.length - offset
                                );


                            const fileChunk =
                                chunk.subarray(
                                    offset,
                                    offset + take
                                );


                            hash.update(
                                fileChunk
                            );


                            processedFileBytes +=
                                take;


                            plaintextOffset +=
                                take;


                            offset +=
                                take;


                            if (
                                operationId &&
                                isVaultOperationCancelled(operationId)
                            ) {
                                callback(
                                    createVaultOperationCancelledError()
                                );
                                return;
                            }


                            if (
                                typeof onProgress ===
                                'function'
                            ) {

                                onProgress({

                                    fileId,

                                    name:
                                        metadata
                                            ? metadata.name
                                            : path.basename(
                                                encryptedPath
                                            ),

                                    processedBytes:
                                        processedFileBytes,

                                    totalBytes:
                                        originalFileSize

                                });

                            }


                            /*
                                Only original file bytes
                                are written to destination.
                            */

                            this.push(
                                fileChunk
                            );


                            continue;

                        }


                        /*
                            REGION 3:
                            final 32-byte SHA-256 digest
                        */

                        const remainingDigest =
                            32 -
                            storedDigest.length;


                        const take =
                            Math.min(
                                remainingDigest,
                                chunk.length - offset
                            );


                        storedDigest =
                            Buffer.concat([
                                storedDigest,
                                chunk.subarray(
                                    offset,
                                    offset + take
                                )
                            ]);


                        plaintextOffset +=
                            take;


                        offset +=
                            take;


                        if (
                            storedDigest.length > 32
                        ) {
                            throw new Error(
                                'Invalid CLV2 SHA-256 digest.'
                            );
                        }


                        /*
                            Digest is verification data,
                            not part of restored file.
                        */

                    }


                    callback();

                } catch (error) {

                    callback(
                        error
                    );

                }

            }

        });


    const encryptedStream =
        fsSync.createReadStream(
            encryptedPath,
            {
                start:
                    CLV2_HEADER_LENGTH
            }
        );


    const outputStream =
        fsSync.createWriteStream(
            temporaryPath,
            {
                flags: 'wx'
            }
        );


    let restoreSucceeded =
        false;


    try {

        /*
            pipeline completion also means
            AES-GCM final authentication passed.
        */

        await pipeline(
            encryptedStream,
            decipher,
            parser,
            outputStream
        );


        if (!metadata) {
            throw new Error(
                'CLV2 metadata was not recovered.'
            );
        }


        if (
            processedFileBytes !==
            originalFileSize
        ) {
            throw new Error(
                'CLV2 restored file size mismatch.'
            );
        }


        if (
            storedDigest.length !== 32
        ) {
            throw new Error(
                'CLV2 SHA-256 digest is incomplete.'
            );
        }


        const calculatedDigest =
            hash.digest();


        if (
            !crypto.timingSafeEqual(
                storedDigest,
                calculatedDigest
            )
        ) {
            throw new Error(
                'CLV2 SHA-256 verification failed.'
            );
        }


        /*
            Restore only becomes final after:

            AES-GCM authentication  PASS
            SHA-256 verification    PASS
            metadata validation     PASS
            file-size validation    PASS
        */

        await fs.rename(
            temporaryPath,
            destinationPath
        );


        restoreSucceeded =
            true;


        return {

            success: true,

            fileId,

            metadata,

            destinationPath,

            size:
                originalFileSize,

            sha256:
                calculatedDigest
                    .toString('hex'),

            containerVersion:
                CLV2_VERSION

        };


    } finally {

        /*
            Any failure leaves the original
            encrypted container untouched.

            Only partial plaintext output
            is removed.
        */

        if (!restoreSucceeded) {

            try {

                await fs.unlink(
                    temporaryPath
                );

            } catch (cleanupError) {

                if (
                    cleanupError.code !==
                    'ENOENT'
                ) {

                    console.error(
                        'Unable to remove incomplete CLV2 restore:',
                        cleanupError
                    );

                }

            }

        }


        if (
            metadataBuffer.length > 0
        ) {

            metadataBuffer.fill(0);

        }


        if (
            storedDigest.length > 0
        ) {

            storedDigest.fill(0);

        }

    }

}
    
/* =========================================
   VERIFY CLV2 FILE - STREAMING
========================================= */

async function verifyCLV2FileStream(
    fileMetadata
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    if (
        !fileMetadata ||
        typeof fileMetadata.id !==
            'string' ||
        typeof fileMetadata.encryptedFile !==
            'string'
    ) {
        throw new Error(
            'Invalid file metadata.'
        );
    }


    const encryptedPath =
        path.join(
            getVaultFilesDirectory(),
            fileMetadata.encryptedFile
        );


    const containerStat =
        await fs.stat(
            encryptedPath
        );


    if (
        !containerStat.isFile() ||
        containerStat.size <
            CLV2_HEADER_LENGTH +
            4 +
            1 +
            32
    ) {
        throw new Error(
            'Invalid or incomplete CLV2 container.'
        );
    }


    /* -------------------------
       READ FIXED HEADER
    ------------------------- */

    const handle =
        await fs.open(
            encryptedPath,
            'r'
        );


    const header =
        Buffer.alloc(
            CLV2_HEADER_LENGTH
        );


    try {

        const { bytesRead } =
            await handle.read(
                header,
                0,
                CLV2_HEADER_LENGTH,
                0
            );


        if (
            bytesRead !==
            CLV2_HEADER_LENGTH
        ) {
            throw new Error(
                'Unable to read CLV2 header.'
            );
        }

    } finally {

        await handle.close();

    }


    const magic =
        header
            .subarray(0, 4)
            .toString('utf8');


    if (
        magic !==
        CLV2_MAGIC.toString('utf8')
    ) {
        throw new Error(
            'Invalid CLV2 magic header.'
        );
    }


    const version =
        header.readUInt8(4);


    if (
        version !==
        CLV2_VERSION
    ) {
        throw new Error(
            `Unsupported CLV2 version: ${version}`
        );
    }


    const iv =
        header.subarray(
            5,
            5 + CLV_GCM_IV_LENGTH
        );


    const serializedMetadataLength =
        header.readUInt32BE(17);


    const authTag =
        header.subarray(
            21,
            21 + CLV_GCM_TAG_LENGTH
        );


    const MAX_METADATA_SIZE =
        1024 * 1024;


    if (
        serializedMetadataLength < 5 ||
        serializedMetadataLength >
            MAX_METADATA_SIZE + 4
    ) {
        throw new Error(
            'Invalid CLV2 metadata length.'
        );
    }


    /* -------------------------
       PHYSICAL SIZE CHECK
    ------------------------- */

    const encryptedPayloadLength =
        containerStat.size -
        CLV2_HEADER_LENGTH;


    const originalFileSize =
        encryptedPayloadLength -
        serializedMetadataLength -
        32;


    if (
        !Number.isSafeInteger(
            originalFileSize
        ) ||
        originalFileSize < 0
    ) {
        throw new Error(
            'Invalid CLV2 payload size.'
        );
    }


    /* -------------------------
       CREATE DECIPHER
    ------------------------- */

    const decipher =
        crypto.createDecipheriv(
            'aes-256-gcm',
            vaultMasterKey,
            iv
        );


    decipher.setAAD(
        Buffer.from(
            `CrypticLocker|2|${fileMetadata.id}`,
            'utf8'
        )
    );


    decipher.setAuthTag(
        authTag
    );


    const hash =
        crypto.createHash(
            'sha256'
        );


    let plaintextOffset = 0;

    let metadataBuffer =
        Buffer.alloc(0);

    let metadata = null;

    let processedFileBytes = 0;

    let storedDigest =
        Buffer.alloc(0);


    /*
        Plaintext is parsed while streaming.

        Nothing is written to disk and the
        complete plaintext is never stored
        in RAM.
    */

    const verifier =
        new Transform({

            transform(
                chunk,
                encoding,
                callback
            ) {

                try {

                    let offset = 0;


                    while (
                        offset <
                        chunk.length
                    ) {

                        /*
                            REGION 1:
                            RECOVERY METADATA
                        */

                        if (
                            plaintextOffset <
                            serializedMetadataLength
                        ) {

                            const remaining =
                                serializedMetadataLength -
                                plaintextOffset;


                            const take =
                                Math.min(
                                    remaining,
                                    chunk.length -
                                        offset
                                );


                            metadataBuffer =
                                Buffer.concat([
                                    metadataBuffer,
                                    chunk.subarray(
                                        offset,
                                        offset + take
                                    )
                                ]);


                            plaintextOffset +=
                                take;

                            offset +=
                                take;


                            if (
                                plaintextOffset ===
                                serializedMetadataLength
                            ) {

                                const jsonLength =
                                    metadataBuffer
                                        .readUInt32BE(
                                            0
                                        );


                                if (
                                    jsonLength + 4 !==
                                    serializedMetadataLength
                                ) {
                                    throw new Error(
                                        'CLV2 metadata length mismatch.'
                                    );
                                }


                                const json =
                                    metadataBuffer
                                        .subarray(4)
                                        .toString(
                                            'utf8'
                                        );


                                try {

                                    metadata =
                                        JSON.parse(
                                            json
                                        );

                                } catch {

                                    throw new Error(
                                        'Invalid CLV2 metadata JSON.'
                                    );

                                }


                                if (
                                    !metadata ||
                                    metadata.version !==
                                        CLV2_VERSION ||
                                    metadata.id !==
                                        fileMetadata.id ||
                                    typeof metadata.name !==
                                        'string' ||
                                    !Number.isSafeInteger(
                                        metadata.size
                                    ) ||
                                    metadata.size < 0
                                ) {
                                    throw new Error(
                                        'Invalid CLV2 recovery metadata.'
                                    );
                                }


                                if (
                                    metadata.size !==
                                    originalFileSize
                                ) {
                                    throw new Error(
                                        'CLV2 original file size mismatch.'
                                    );
                                }


                                metadataBuffer.fill(
                                    0
                                );


                                metadataBuffer =
                                    Buffer.alloc(0);

                            }


                            continue;

                        }


                        /*
                            REGION 2:
                            ORIGINAL FILE

                            Hash bytes but DO NOT
                            write them anywhere.
                        */

                        if (
                            processedFileBytes <
                            originalFileSize
                        ) {

                            const remaining =
                                originalFileSize -
                                processedFileBytes;


                            const take =
                                Math.min(
                                    remaining,
                                    chunk.length -
                                        offset
                                );


                            const fileChunk =
                                chunk.subarray(
                                    offset,
                                    offset + take
                                );


                            hash.update(
                                fileChunk
                            );


                            processedFileBytes +=
                                take;

                            plaintextOffset +=
                                take;

                            offset +=
                                take;


                            continue;

                        }


                        /*
                            REGION 3:
                            STORED SHA-256
                        */

                        const remainingDigest =
                            32 -
                            storedDigest.length;


                        if (
                            remainingDigest <= 0
                        ) {
                            throw new Error(
                                'Unexpected data after CLV2 SHA-256 digest.'
                            );
                        }


                        const take =
                            Math.min(
                                remainingDigest,
                                chunk.length -
                                    offset
                            );


                        storedDigest =
                            Buffer.concat([
                                storedDigest,
                                chunk.subarray(
                                    offset,
                                    offset + take
                                )
                            ]);


                        plaintextOffset +=
                            take;

                        offset +=
                            take;

                    }


                    callback();


                } catch (error) {

                    callback(
                        error
                    );

                }

            }

        });


    const encryptedStream =
        fsSync.createReadStream(
            encryptedPath,
            {
                start:
                    CLV2_HEADER_LENGTH
            }
        );


    try {

        /*
            Successful pipeline completion means
            AES-GCM authentication also passed.
        */

        await pipeline(
            encryptedStream,
            decipher,
            verifier
        );


        if (!metadata) {
            throw new Error(
                'CLV2 metadata was not recovered.'
            );
        }


        if (
            processedFileBytes !==
            originalFileSize
        ) {
            throw new Error(
                'CLV2 file size verification failed.'
            );
        }


        if (
            storedDigest.length !== 32
        ) {
            throw new Error(
                'CLV2 SHA-256 digest is incomplete.'
            );
        }


        const calculatedDigest =
            hash.digest();


        if (
            !crypto.timingSafeEqual(
                storedDigest,
                calculatedDigest
            )
        ) {
            throw new Error(
                'CLV2 SHA-256 verification failed.'
            );
        }


        /*
            Also verify CLV2 embedded metadata
            against index.clm metadata.
        */

        if (
            metadata.id !==
            fileMetadata.id
        ) {
            throw new Error(
                'CLV2 file ID does not match vault index.'
            );
        }


        if (
            metadata.name !==
            fileMetadata.name
        ) {
            throw new Error(
                'CLV2 filename does not match vault index.'
            );
        }


        if (
            typeof fileMetadata.size ===
                'number' &&
            metadata.size !==
                fileMetadata.size
        ) {
            throw new Error(
                'CLV2 file size does not match vault index.'
            );
        }


        const calculatedHash =
            calculatedDigest.toString(
                'hex'
            );


        if (
            typeof fileMetadata.sha256 ===
                'string' &&
            calculatedHash !==
                fileMetadata.sha256
        ) {
            throw new Error(
                'CLV2 SHA-256 does not match vault index.'
            );
        }


        return {

            success: true,

            fileId:
                fileMetadata.id,

            metadata,

            size:
                originalFileSize,

            sha256:
                calculatedHash,

            containerVersion:
                CLV2_VERSION

        };


    } finally {

        if (
            metadataBuffer.length > 0
        ) {
            metadataBuffer.fill(0);
        }


        if (
            storedDigest.length > 0
        ) {
            storedDigest.fill(0);
        }

    }

}

/* =========================================
   RESTORE VAULT FILE - AUTO ROUTER
========================================= */

async function restoreVaultFileAuto(
    fileMetadata,
    destinationPath,
    operationId = null,
    onProgress = null
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}


    if (
        !fileMetadata ||
        typeof fileMetadata.id !== 'string' ||
        typeof fileMetadata.encryptedFile !== 'string'
    ) {
        throw new Error(
            'Invalid file metadata.'
        );
    }


    const encryptedPath =
        path.join(
            getVaultFilesDirectory(),
            fileMetadata.encryptedFile
        );


    /*
        Inspect the physical container itself.

        We intentionally do NOT trust an index
        field to decide CLV1 vs CLV2.
    */

    const container =
        await detectCLVContainerVersion(
            encryptedPath
        );


    console.log(
        `Restoring ${fileMetadata.name} using ${container.magic}`
    );


    /*
        Legacy CLV1
    */

    if (container.version === 1) {

        if (
            typeof fileMetadata.sha256 !==
            'string'
        ) {
            throw new Error(
                'This CLV1 file does not contain integrity metadata.'
            );
        }


        await restoreVaultFileStream(
    fileMetadata,
    destinationPath,
    operationId,
    onProgress
);


        return {
            success: true,
            containerVersion: 1,
            name: fileMetadata.name
        };

    }


    /*
        Current CLV2
    */

    if (container.version === 2) {

        const restored =
            await restoreCLV2FileStream(
                encryptedPath,
                destinationPath,
                fileMetadata.id,
                onProgress,
                operationId
            );


        /*
            index.clm and embedded CLV2 metadata
            should describe the same file.

            This gives us another consistency
            check during normal restore.
        */

        if (
            restored.metadata.id !==
            fileMetadata.id
        ) {
            throw new Error(
                'CLV2 file ID does not match vault index.'
            );
        }


        if (
            restored.metadata.name !==
            fileMetadata.name
        ) {
            throw new Error(
                'CLV2 filename does not match vault index.'
            );
        }


        if (
            typeof fileMetadata.size ===
                'number' &&
            restored.metadata.size !==
                fileMetadata.size
        ) {
            throw new Error(
                'CLV2 file size does not match vault index.'
            );
        }


        if (
            typeof fileMetadata.sha256 ===
                'string' &&
            restored.sha256 !==
                fileMetadata.sha256
        ) {
            throw new Error(
                'CLV2 SHA-256 does not match vault index.'
            );
        }


        return {
            success: true,
            containerVersion: 2,
            name: restored.metadata.name,
            sha256: restored.sha256
        };

    }


    throw new Error(
        'Unsupported CrypticLocker container version.'
    );

}

async function encryptFolder(
    sourceFolder,
    removeOriginal = false,
    operationId = null,
    onProgress = null
) {
if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    const stat =
        await fs.stat(
            sourceFolder
        );


    if (!stat.isDirectory()) {

        throw new Error(
            'Selected item is not a folder.'
        );

    }


    const folderId =
        crypto.randomUUID();


    const folderName =
        path.basename(
            sourceFolder
        );


    /*
        Scan complete folder before changing
        anything in the vault.
    */

    const scan =
        await scanFolder(
            sourceFolder
        );


    const totalSize =
    scan.files.reduce(
        (sum, file) =>
            sum + file.size,
        0
    );


const storageCheck =
    await ensureVaultStorageAvailable(
        totalSize
    );


if (!storageCheck.enough) {

    const error =
        new Error(
            'Not enough storage space.'
        );


    error.code =
        'INSUFFICIENT_STORAGE';


    error.requiredBytes =
        storageCheck.requiredWithBuffer;


    error.folderSize =
        totalSize;


    error.availableBytes =
        storageCheck.availableBytes;


    throw error;

}

const totalFiles =
    scan.files.length;


let completedFiles = 0;

let completedBytes = 0;


const encryptedFiles = [];


/*
    Tracks whether index.clm has already
    been replaced with this transaction.

    This is intentionally separate from
    transactionCommitted.

    indexWritten:
        index.clm may already reference
        these encrypted files.

    transactionCommitted:
        the newly written index has also
        passed read-back verification.
*/

let indexWritten =
    false;

let transactionCommitted =
    false;
    
    /*
    Transaction state.

    Before index.clm is successfully written,
    encrypted files belong to an unfinished
    transaction and may be rolled back.

    After commit succeeds, they are permanent
    vault data and MUST NOT be deleted by the
    outer error handler.
*/


try {

        /*
            PHASE 1 — PREPARE

            Encrypt every file, but DO NOT
            modify index.clm yet.
        */

        for (
    const sourceFile
    of scan.files
) {

    const currentFileName =
        path.basename(
            sourceFile.sourcePath
        );


    /*
        Tell renderer which file is about
        to start processing.

        Example:
        file1.pdf
            ↓
        file2.jpg
            ↓
        file3.mp4
    */

    if (
        typeof onProgress ===
        'function'
    ) {

        onProgress({

            status:
                'file-started',

            name:
                folderName,

            currentFile:
                currentFileName,

            processedBytes:
                completedBytes,

            totalBytes:
                totalSize,

            completedFiles,

            totalFiles

        });

    }

const encrypted =
    await encryptFileV2(
        sourceFile.sourcePath,
        {

            /*
                Folder relationship is written
                INSIDE the authenticated CLV2
                recovery metadata itself.

                This means a CLV2 container can
                later tell us which folder it
                belonged to even if index.clm
                needs recovery.
            */

            parentFolderId:
                folderId,

            relativePath:
                sourceFile.relativePath,

            operationId:
                operationId,

            mode:
                removeOriginal ? 'move' : 'copy',

            onProgress:
                fileProgress => {

                    /*
                        encryptFileV2 reports
                        progress for CURRENT file.

                        Convert it into progress
                        for the COMPLETE folder.
                    */

                    const folderProcessedBytes =
                        completedBytes +
                        fileProgress.processedBytes;


                    if (
                        typeof onProgress ===
                        'function'
                    ) {

                        onProgress({

                            status:
                                'progress',

                            name:
                                folderName,

                            currentFile:
                                currentFileName,

                            processedBytes:
                                folderProcessedBytes,

                            totalBytes:
                                totalSize,

                            currentFileProcessedBytes:
                                fileProgress.processedBytes,

                            currentFileTotalBytes:
                                fileProgress.totalBytes,

                            completedFiles,

                            totalFiles

                        });

                    }

                }

        }
    );


    encryptedFiles.push(
        encrypted
    );


    /*
        This file is now fully encrypted.
    */

    completedFiles++;

    completedBytes +=
        sourceFile.size;


    if (
        typeof onProgress ===
        'function'
    ) {

        onProgress({

            status:
                'file-completed',

            name:
                folderName,

            currentFile:
                currentFileName,

            processedBytes:
                completedBytes,

            totalBytes:
                totalSize,

            completedFiles,

            totalFiles

        });

    }

}


        /*
    PHASE 2 — VERIFY

    Every CLV2 container must pass complete
    cryptographic verification BEFORE the
    folder transaction is committed to
    index.clm.

    This verifies:

    - CLV2 header / version
    - AES-256-GCM authentication
    - encrypted recovery metadata
    - original file size
    - embedded SHA-256
    - index metadata consistency

    Most importantly:

    MOVE mode is NOT allowed to remove the
    original folder unless every encrypted
    file passes this phase.
*/

for (
    const encrypted
    of encryptedFiles
) {

const verification =
    await verifyCLV2FileStream(
        encrypted
    );


    if (
        !verification ||
        verification.success !== true
    ) {

        throw new Error(
            `Vault verification failed for "${encrypted.name}". Original folder was not removed.`
        );

    }


    /*
        Folder relationship is part of the
        authenticated CLV2 recovery metadata.

        Verify it independently as well.
    */

    if (
        verification.metadata.parentFolderId !==
        folderId
    ) {

        throw new Error(
            `Folder verification failed for "${encrypted.name}".`
        );

    }


    if (
        verification.metadata.relativePath !==
        encrypted.relativePath
    ) {

        throw new Error(
            `Folder path verification failed for "${encrypted.name}".`
        );

    }

}

/*
            Folder metadata is created only
            after every file was encrypted.
        */

        const folderMetadata = {

            id:
                folderId,

            name:
                folderName,

            totalSize,

            formattedSize:
                formatFileSize(
                    totalSize
                ),

            fileCount:
                scan.files.length,

            folderCount:
                scan.folders.length,

            structure:
                scan.folders.map(
                    folder => ({

                        name:
                            folder.name,

                        relativePath:
                            folder.relativePath

                    })
                ),

            addedAt:
                new Date()
                    .toISOString(),

            mode:
                removeOriginal ? 'move' : 'copy',

            sourceRemoved:
                Boolean(removeOriginal)

        };


        /*
            PHASE 2 — COMMIT

            Read the current encrypted index
            once and add the complete folder
            transaction in one update.
        */

        const index =
            await readVaultIndex();


        index.files.push(
            ...encryptedFiles
        );


        index.folders.push(
            folderMetadata
        );


        try {

    await writeVaultIndex(
        index
    );

    indexWritten =
    true;

    /*
        From this exact point onward the folder
        transaction is part of index.clm.

        The outer rollback must never delete
        these encrypted containers.
    */

    /*
    =============================
    COMMIT READ-BACK VERIFICATION
    =============================

    Do not trust only the successful return
    from writeVaultIndex().

    Read index.clm back from disk, decrypt it,
    and confirm that the complete folder
    transaction is actually recoverable.
*/

const committedIndex =
    await readVaultIndex();


/*
    Verify folder metadata exists.
*/

const committedFolder =
    committedIndex.folders.find(
        folder =>
            folder.id ===
            folderId
    );


if (!committedFolder) {

    throw new Error(
        'Committed folder metadata could not be read back from vault index.'
    );

}


/*
    Verify every encrypted file belonging to
    this transaction exists in the committed
    index with the expected folder relationship.
*/

for (
    const encryptedFile
    of encryptedFiles
) {

    const committedFile =
        committedIndex.files.find(
            file =>
                file.id ===
                encryptedFile.id
        );


    if (!committedFile) {

        throw new Error(
            `Committed file "${encryptedFile.name}" could not be read back from vault index.`
        );

    }


    if (
        committedFile.encryptedFile !==
        encryptedFile.encryptedFile
    ) {

        throw new Error(
            `Committed container reference mismatch for "${encryptedFile.name}".`
        );

    }


    if (
        committedFile.parentFolderId !==
        folderId
    ) {

        throw new Error(
            `Committed folder relationship mismatch for "${encryptedFile.name}".`
        );

    }


    if (
        committedFile.relativePath !==
        encryptedFile.relativePath
    ) {

        throw new Error(
            `Committed relative path mismatch for "${encryptedFile.name}".`
        );

    }

}


/*
    The transaction has now been:

    1. written to index.clm
    2. read back from index.clm
    3. decrypted/authenticated
    4. folder metadata confirmed
    5. every file reference confirmed

    Only NOW may rollback protection switch
    to committed state.
*/

transactionCommitted =
    true;


} catch (error) {

    /*
        There are two fundamentally different
        failure states here.

        1. indexWritten === false

           writeVaultIndex() did not complete.
           The transaction is not known to have
           reached index.clm.

           Normal rollback is allowed.

        2. indexWritten === true

           index.clm was already replaced, but
           read-back verification failed.

           We MUST treat this as an uncertain
           commit. The encrypted containers may
           already be referenced by index.clm,
           so they must not be deleted.
    */

    if (indexWritten) {

        const uncertainError =
            new Error(
                `Vault folder commit could not be verified: ${error.message}`
            );


        uncertainError.code =
            'VAULT_COMMIT_UNCERTAIN';


        uncertainError.folderId =
            folderId;


        uncertainError.folderName =
            folderName;


        uncertainError.encryptedFiles =
            encryptedFiles.map(
                file => ({
                    id:
                        file.id,

                    encryptedFile:
                        file.encryptedFile
                })
            );


        throw uncertainError;

    }


    throw new Error(
        `Unable to commit folder to vault: ${error.message}`
    );

}


        /*
            MOVE MODE

            Original folder is removed ONLY
            after:

            - every file encrypted
            - every encrypted file completed
            - metadata committed successfully

            Therefore a failed encryption can
            never delete the source folder.
        */

        if (removeOriginal) {

            try {

                await fs.rm(
                    sourceFolder,
                    {
                        recursive: true,
                        force: false
                    }
                );


                folderMetadata.sourceRemoved =
                    true;


            } catch (error) {

                /*
                    Encryption is already safely
                    committed.

                    Failure to remove source is
                    NOT a vault failure.

                    User keeps both copies.
                */

                folderMetadata.sourceRemoved =
                    false;


                folderMetadata.sourceRemoveError =
                    'The folder was encrypted successfully, but the original folder could not be removed.';

            }

        }


        return folderMetadata;


    } catch (error) {

    /*
        =============================
        ROLLBACK
        =============================

        Rollback is allowed ONLY before
        index.clm has successfully committed
        this folder transaction.

        Once committed, encrypted CLV2 files
        must never be deleted here.
    */

    if (
    !indexWritten &&
    !transactionCommitted
) {

    for (
        const encryptedFile
        of encryptedFiles
    ) {

        try {

            const encryptedPath =
                path.join(
                    getVaultFilesDirectory(),
                    encryptedFile.encryptedFile
                );


            await fs.unlink(
                encryptedPath
            );


        } catch (cleanupError) {

            if (
                cleanupError.code !==
                'ENOENT'
            ) {

                console.error(
                    'Unable to rollback encrypted folder file:',
                    encryptedFile.encryptedFile,
                    cleanupError
                );

            }

        }

    }

}


    throw error;

}

}

/* =========================================
   DELETE VAULT FOLDER
========================================= */

async function deleteVaultFolder(
    folderId
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    if (
        typeof folderId !== 'string' ||
        !folderId.trim()
    ) {

        throw new Error(
            'Invalid folder ID.'
        );

    }


    /*
        PHASE 1 — READ CURRENT INDEX

        Nothing is modified yet.
    */

    const index =
        await readVaultIndex();


    const folder =
        index.folders.find(
            item =>
                item.id === folderId
        );


    if (!folder) {

        throw new Error(
            'Folder was not found in the vault.'
        );

    }


    /*
        Collect every encrypted file belonging
        to this folder transaction.

        Folder encryption stores the root
        folder ID in parentFolderId for every
        file, including files inside nested
        directories.
    */

    const folderFiles =
        index.files.filter(
            file =>
                file.parentFolderId ===
                folderId
        );


    /*
        Snapshot the physical container
        references BEFORE modifying index.clm.

        We will need these only after the
        metadata deletion has been committed
        and verified.
    */

    const containers =
        folderFiles
            .filter(
                file =>
                    typeof file.encryptedFile ===
                        'string' &&
                    file.encryptedFile.length > 0
            )
            .map(
                file => ({

                    id:
                        file.id,

                    name:
                        file.name,

                    encryptedFile:
                        file.encryptedFile

                })
            );


    /*
        PHASE 2 — BUILD NEW INDEX

        Do not mutate the original arrays
        incrementally.

        Build the complete post-delete state
        first.
    */

    const updatedIndex = {

        ...index,

        files:
            index.files.filter(
                file =>
                    file.parentFolderId !==
                        folderId
            ),

        folders:
            index.folders.filter(
                item =>
                    item.id !==
                        folderId
            )

    };


    /*
        PHASE 3 — COMMIT METADATA DELETION

        IMPORTANT:

        Physical .clv containers MUST remain
        untouched until index.clm has been
        successfully written AND read back.

        This prevents data loss if the index
        commit fails.
    */

    let indexWritten =
        false;


    try {

        await writeVaultIndex(
            updatedIndex
        );


        indexWritten =
            true;


        /*
            COMMIT READ-BACK VERIFICATION

            Re-read the encrypted index from
            disk and prove that:

            1. folder metadata is gone
            2. every file belonging to the
               folder is gone

            Only after this verification may
            physical containers be deleted.
        */

        const committedIndex =
            await readVaultIndex();


        const folderStillExists =
            committedIndex.folders.some(
                item =>
                    item.id ===
                        folderId
            );


        if (folderStillExists) {

            throw new Error(
                'Deleted folder metadata is still present in the vault index.'
            );

        }


        /*
            Verify by FILE ID as well.

            This is stronger than checking only
            parentFolderId because the committed
            records must specifically exclude
            every file we intended to delete.
        */

        const deletedFileIds =
            new Set(
                folderFiles.map(
                    file =>
                        file.id
                )
            );


        const fileStillExists =
            committedIndex.files.find(
                file =>
                    deletedFileIds.has(
                        file.id
                    )
            );


        if (fileStillExists) {

            throw new Error(
                `Deleted file "${fileStillExists.name}" is still present in the vault index.`
            );

        }


    } catch (error) {

        /*
            writeVaultIndex() returning does not
            automatically mean our read-back
            verification succeeded.

            Once writeVaultIndex() completed,
            the old folder MAY already be gone
            from index.clm.

            Therefore containers must NEVER be
            deleted in this uncertain state.
        */

        if (indexWritten) {

            const uncertainError =
                new Error(
                    `Vault folder deletion commit could not be verified: ${error.message}`
                );


            uncertainError.code =
                'DELETE_COMMIT_UNCERTAIN';


            uncertainError.folderId =
                folderId;


            uncertainError.folderName =
                folder.name;


            uncertainError.encryptedFiles =
                containers.map(
                    file => ({

                        id:
                            file.id,

                        encryptedFile:
                            file.encryptedFile

                    })
                );


            throw uncertainError;

        }


        throw error;

    }


    /*
        PHASE 4 — PHYSICAL CONTAINER CLEANUP

        At this point index.clm has been:

        - written
        - decrypted again
        - folder absence verified
        - every child file absence verified

        Therefore the .clv files are now
        unreferenced and safe to remove.
    */

    const cleanupFailures = [];


    for (const file of containers) {

        /*
            Never trust encryptedFile as a path.

            A valid index entry should contain
            only the generated .clv filename.
        */

        const safeName =
            path.basename(
                file.encryptedFile
            );


        if (
            safeName !==
                file.encryptedFile ||
            !safeName.endsWith(
                '.clv'
            )
        ) {

            cleanupFailures.push({

                id:
                    file.id,

                name:
                    file.name,

                encryptedFile:
                    file.encryptedFile,

                error:
                    'Invalid encrypted container filename.'

            });


            continue;

        }


        const encryptedPath =
            path.join(
                getVaultFilesDirectory(),
                safeName
            );


        try {

            await fs.unlink(
                encryptedPath
            );


        } catch (error) {

            /*
                ENOENT means the desired final
                state already exists.

                The index no longer references
                this container and the container
                is already absent.
            */

            if (
                error.code ===
                'ENOENT'
            ) {

                continue;

            }


            cleanupFailures.push({

                id:
                    file.id,

                name:
                    file.name,

                encryptedFile:
                    safeName,

                error:
                    error.message

            });

        }

    }


    /*
        Metadata deletion already succeeded.

        If one or more physical containers could
        not be removed, DO NOT attempt to put the
        folder back into index.clm.

        Those files are now unreferenced orphan
        containers and can be handled by the
        existing orphan-recovery architecture.
    */

    if (
        cleanupFailures.length > 0
    ) {

        const cleanupError =
            new Error(
                `Folder was removed from the vault index, but ${cleanupFailures.length} encrypted container(s) could not be deleted.`
            );


        cleanupError.code =
            'DELETE_CONTAINER_CLEANUP_FAILED';


        cleanupError.folderId =
            folderId;


        cleanupError.folderName =
            folder.name;


        cleanupError.cleanupFailures =
            cleanupFailures;


        cleanupError.deletedContainerCount =
            containers.length -
            cleanupFailures.length;


        cleanupError.totalContainerCount =
            containers.length;


        throw cleanupError;

    }


    /*
        COMPLETE SUCCESS
    */

    return {

        success:
            true,

        id:
            folder.id,

        name:
            folder.name,

        fileCount:
            folderFiles.length,

        deletedContainerCount:
            containers.length

    };

}

/* =========================================
   DELETE VAULT FILE
========================================= */

async function deleteVaultFile(
    fileId
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    if (
        typeof fileId !== 'string' ||
        !fileId
    ) {

        throw new Error(
            'Invalid file ID.'
        );

    }


    /*
        Read current authenticated index.
    */

    const index =
        await readVaultIndex();


    const file =
        index.files.find(
            item =>
                item.id === fileId
        );


    if (!file) {

        throw new Error(
            'File was not found in the vault.'
        );

    }


    /*
        This function deletes only standalone
        vault files.

        Files belonging to folders must be
        removed through the folder delete
        transaction so folder integrity is
        never broken.
    */

    if (
        file.parentFolderId
    ) {

        throw new Error(
            'This file belongs to a folder and cannot be deleted separately.'
        );

    }


    if (
        typeof file.encryptedFile !==
            'string' ||
        !file.encryptedFile
    ) {

        throw new Error(
            'Invalid encrypted file reference.'
        );

    }


    /*
        Build the new index in memory.

        The physical .clv is intentionally NOT
        deleted yet.
    */

    const updatedIndex = {

        ...index,

        files:
            index.files.filter(
                item =>
                    item.id !== fileId
            )

    };


    /*
        PHASE 1 — COMMIT INDEX DELETION

        writeVaultIndex() itself writes a
        temporary authenticated index and
        verifies it before replacing index.clm.
    */

    await writeVaultIndex(
        updatedIndex
    );


    /*
        PHASE 2 — READ-BACK VERIFICATION

        Confirm that the deleted item really
        disappeared from the committed index
        before touching its encrypted container.
    */

    const committedIndex =
        await readVaultIndex();


    const stillExists =
        committedIndex.files.some(
            item =>
                item.id === fileId
        );


    if (stillExists) {

        const error =
            new Error(
                'Vault deletion commit could not be verified.'
            );


        error.code =
            'DELETE_COMMIT_UNCERTAIN';


        throw error;

    }


    /*
        PHASE 3 — REMOVE ENCRYPTED CONTAINER

        Only now is it safe to remove the
        physical .clv because index.clm no
        longer references it.
    */

    const encryptedFileName =
        path.basename(
            file.encryptedFile
        );


    if (
        encryptedFileName !==
        file.encryptedFile ||
        !encryptedFileName.endsWith(
            '.clv'
        )
    ) {

        throw new Error(
            'Unsafe encrypted file reference.'
        );

    }


    const encryptedPath =
        path.join(
            getVaultFilesDirectory(),
            encryptedFileName
        );


    try {

        await fs.unlink(
            encryptedPath
        );

    } catch (error) {

        /*
            ENOENT means the index deletion is
            already correct and there is no
            physical container left to remove.
        */

        if (
            error.code !== 'ENOENT'
        ) {

            const cleanupError =
                new Error(
                    'The file was removed from the vault index, but its encrypted container could not be deleted.'
                );


            cleanupError.code =
                'DELETE_CONTAINER_CLEANUP_FAILED';


            cleanupError.originalError =
                error;


            throw cleanupError;

        }

    }


    return {

        success: true,

        id:
            file.id,

        name:
            file.name,

        encryptedFile:
            file.encryptedFile

    };

}

/* =========================================
   STREAMING RESTORE
========================================= */

async function restoreVaultFileStream(
    fileMetadata,
    destinationPath,
    operationId = null,
    onProgress = null
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    if (
        !fileMetadata ||
        typeof fileMetadata.id !== 'string' ||
        typeof fileMetadata.encryptedFile !== 'string' ||
        typeof fileMetadata.sha256 !== 'string'
    ) {
        throw new Error(
            'Invalid file metadata.'
        );
    }


    const encryptedPath =
        path.join(
            getVaultFilesDirectory(),
            fileMetadata.encryptedFile
        );


    /*
        Read only the 32-byte header.

        CLV1       4 bytes
        IV        12 bytes
        Auth Tag  16 bytes
    */

    const handle =
        await fs.open(
            encryptedPath,
            'r'
        );


    const header =
        Buffer.alloc(32);


    try {

        const { bytesRead } =
            await handle.read(
                header,
                0,
                32,
                0
            );


        if (bytesRead !== 32) {

            throw new Error(
                'Encrypted file is corrupted.'
            );

        }

    } finally {

        await handle.close();

    }


    const magic =
        header
            .subarray(0, 4)
            .toString('utf8');


    if (magic !== 'CLV1') {

        throw new Error(
            'Invalid CrypticLocker file.'
        );

    }


    const iv =
        header.subarray(
            4,
            16
        );


    const authTag =
        header.subarray(
            16,
            32
        );


    const decipher =
        crypto.createDecipheriv(
            'aes-256-gcm',
            vaultMasterKey,
            iv
        );


    decipher.setAAD(
        Buffer.from(
            `CrypticLocker|1|${fileMetadata.id}`,
            'utf8'
        )
    );


    decipher.setAuthTag(
        authTag
    );


    /*
        Never write directly to final path.

        If authentication/hash verification
        fails, we don't want a corrupt final
        file left behind.
    */

    const temporaryPath =
        `${destinationPath}.crypticlocker-part`;


    /*
        Safety check in case a stale temporary
        file already exists.
    */

    try {

        await fs.access(
            temporaryPath
        );


        throw new Error(
            'A temporary restore file already exists at this location.'
        );

    } catch (error) {

        if (
            error.code &&
            error.code !== 'ENOENT'
        ) {
            throw error;
        }

    }


    const hash =
        crypto.createHash(
            'sha256'
        );


    /*
        Transform stream used only for
        calculating the plaintext hash while
        data continues toward disk.
    */


    const hashTransform =
        new Transform({

            transform(
                chunk,
                encoding,
                callback
            ) {

                hash.update(chunk);

                callback(
                    null,
                    chunk
                );

            }

        });


    const progressTransform =
    createProgressTransform(
        processedBytes => {

            if (
                typeof onProgress ===
                'function'
            ) {

                onProgress({

                    fileId:
                        fileMetadata.id,

                    name:
                        fileMetadata.name,

                    processedBytes,

                    totalBytes:
                        fileMetadata.size

                });

            }

        },
        operationId
    );
    
    try {

        const encryptedReadStream =
            fsSync.createReadStream(
                encryptedPath,
                {
                    start: 32
                }
            );


        const restoredWriteStream =
            fsSync.createWriteStream(
                temporaryPath,
                {
                    flags: 'wx'
                }
            );


        /*
            Encrypted file
                ↓
            AES-GCM decipher
                ↓
            SHA-256 calculation
                ↓
            temporary restored file
        */

        await pipeline(
    encryptedReadStream,
    decipher,
    progressTransform,
    hashTransform,
    restoredWriteStream
);


        /*
            pipeline() only completes after
            AES-GCM authentication succeeds.
        */

        const restoredHash =
            hash.digest('hex');


        if (
            restoredHash !==
            fileMetadata.sha256
        ) {

            throw new Error(
                'Restored file integrity verification failed.'
            );

        }


        /*
            Also verify resulting size.
        */

        const restoredStat =
            await fs.stat(
                temporaryPath
            );


        if (
            typeof fileMetadata.size === 'number' &&
            restoredStat.size !== fileMetadata.size
        ) {

            throw new Error(
                'Restored file size verification failed.'
            );

        }


        /*
            Only after:
              AES-GCM authentication ✓
              SHA-256 ✓
              file size ✓

            turn temporary output into the
            final restored file.
        */

        await fs.rename(
            temporaryPath,
            destinationPath
        );


        return {
            success: true
        };


    } catch (error) {

        /*
            Never leave incomplete plaintext
            behind after a failed restore.
        */

        try {

            await fs.unlink(
                temporaryPath
            );

        } catch {
            // Best-effort cleanup
        }


        throw error;

    }

}

/* =========================================
   RESTORE VAULT FOLDER
========================================= */

async function restoreVaultFolder(
    folderMetadata,
    index,
    destinationParent,
    onProgress = null,
    operationId = null
) {

    if (!sessionManager.isUnlocked()) {
    throw new Error('Vault is locked.');
}

const vaultMasterKey =
    sessionManager.getVaultMasterKey();


    if (
        !folderMetadata ||
        typeof folderMetadata.id !== 'string' ||
        typeof folderMetadata.name !== 'string'
    ) {
        throw new Error(
            'Invalid folder metadata.'
        );
    }


    /*
        The selected location is the parent.

        Example:

        User selects:
        D:\Restored

        We create:
        D:\Restored\College
    */

    const destinationRoot =
        path.join(
            destinationParent,
            folderMetadata.name
        );


    /*
        Never silently merge with or overwrite
        an existing folder.
    */




    /*
        Only files belonging to this logical
        root folder are restored.
    */

    const folderFiles =
        index.files.filter(
            file =>
                file.parentFolderId ===
                folderMetadata.id
        );


    const totalFiles =
    folderFiles.length;


const totalBytes =
    folderFiles.reduce(
        (sum, file) =>
            sum + (
                typeof file.size === 'number'
                    ? file.size
                    : 0
            ),
        0
    );


let completedFiles = 0;

let completedBytes = 0;

let destinationCreated =
        false;


    try {

        /*
            Create root folder.
        */

        await fs.mkdir(
            destinationRoot,
            {
                recursive: false
            }
        );


        destinationCreated =
            true;


        /*
            Recreate the complete directory
            structure first.

            This also restores empty folders.
        */

        const structure =
            Array.isArray(
                folderMetadata.structure
            )
                ? folderMetadata.structure
                : [];


        for (
            const folder
            of structure
        ) {

            const relativePath =
                normalizeRestoreRelativePath(
                    folder.relativePath
                );


            if (!relativePath) {
                continue;
            }


            const folderPath =
                path.join(
                    destinationRoot,
                    ...relativePath.split('/')
                );


            await fs.mkdir(
                folderPath,
                {
                    recursive: true
                }
            );

        }


        /*
            Restore every encrypted file using
            our existing streaming restore.

            Therefore every file still gets:

            AES-GCM authentication
            SHA-256 verification
            Size verification
            Temporary-file protection
        */

        for (
            const file
            of folderFiles
        ) {

            if (!file.sha256) {

                throw new Error(
                    `"${file.name}" uses an older vault format and cannot be integrity-verified.`
                );

            }


            const encryptedPath =
                path.join(
                    getVaultFilesDirectory(),
                    file.encryptedFile || ''
                );

            let containerExists = false;

            try {
                await fs.access(encryptedPath);
                containerExists = true;
            } catch {
                containerExists = false;
            }

            if (!containerExists) {
                console.warn(
                    `Skipping missing container for folder file: ${file.name}`
                );
                continue;
            }


            const relativePath =
                normalizeRestoreRelativePath(
                    file.relativePath
                );


            if (!relativePath) {

                throw new Error(
                    `Invalid restore path for "${file.name}".`
                );

            }


            const parts =
                relativePath.split('/');


            const destinationPath =
                path.join(
                    destinationRoot,
                    ...parts
                );


            /*
                Defensive creation in case an
                older folder index does not
                contain complete structure
                metadata.
            */

            await fs.mkdir(
                path.dirname(
                    destinationPath
                ),
                {
                    recursive: true
                }
            );


            if (
    typeof onProgress ===
    'function'
) {

    onProgress({

        status:
            'file-started',

        name:
            folderMetadata.name,

        currentFile:
            file.name,

        processedBytes:
            completedBytes,

        totalBytes,

        completedFiles,

        totalFiles

    });

}

if (
    operationId &&
    isVaultOperationCancelled(operationId)
) {
    throw createVaultOperationCancelledError();
}

await restoreVaultFileAuto(
    file,
    destinationPath,
    operationId,
    fileProgress => {

        const folderProcessedBytes =
            completedBytes +
            fileProgress.processedBytes;


        if (
            typeof onProgress ===
            'function'
        ) {

            onProgress({

                status:
                    'progress',

                name:
                    folderMetadata.name,

                currentFile:
                    file.name,

                processedBytes:
                    folderProcessedBytes,

                totalBytes,

                currentFileProcessedBytes:
                    fileProgress.processedBytes,

                currentFileTotalBytes:
                    fileProgress.totalBytes,

                completedFiles,

                totalFiles

            });

        }

    }
);


completedFiles++;

completedBytes +=
    typeof file.size === 'number'
        ? file.size
        : 0;


if (
    typeof onProgress ===
    'function'
) {

    onProgress({

        status:
            'file-completed',

        name:
            folderMetadata.name,

        currentFile:
            file.name,

        processedBytes:
            completedBytes,

        totalBytes,

        completedFiles,

        totalFiles

    });

}

        }


        if (folderFiles.length > 0 && completedFiles === 0) {

            throw new Error(
                'The encrypted container files for this folder could not be found in vault storage. They may have been moved, renamed, or deleted.'
            );

        }


        return {

            success: true,

            name:
                folderMetadata.name,

            fileCount:
                completedFiles,

            destinationPath:
                destinationRoot

        };


    } catch (error) {

        /*
            Folder restore is transactional
            from the user's perspective.

            If ANY file fails authentication,
            hash verification, disk write etc.,
            remove the incomplete plaintext
            folder.

            The encrypted vault remains
            untouched.
        */

        if (destinationCreated) {

            try {

                await fs.rm(
                    destinationRoot,
                    {
                        recursive: true,
                        force: true
                    }
                );

            } catch (cleanupError) {

                console.error(
                    'Unable to clean incomplete restored folder:',
                    cleanupError
                );

            }

        }


        throw error;

    }

}


/*
    Vault relative paths come from metadata,
    but we still validate them before using
    them as filesystem paths.

    Reject absolute paths and ".." traversal.
*/

function normalizeRestoreRelativePath(
    value
) {

    const normalized =
        String(value || '')
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '');


    if (!normalized) {
        return '';
    }


    const parts =
        normalized.split('/');


    for (const part of parts) {

        if (
            !part ||
            part === '.' ||
            part === '..'
        ) {

            throw new Error(
                'Invalid folder restore path.'
            );

        }

    }


    return parts.join('/');

}

/* =========================================
   SELECT + ENCRYPT FILE
========================================= */

ipcMain.handle(
    'vault:add-file',
    async (event, mode = 'copy') => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                message: 'Vault is locked.'
            };
        }

        let operationId = null;
        let operationName = null;

        try {

            const result =
                await dialog.showOpenDialog(
                    mainWindow,
                    {
                        title:
                            'Add Files to CrypticLocker',

                        properties: [
                            'openFile',
                            'multiSelections'
                        ]
                    }
                );


            if (
                result.canceled ||
                result.filePaths.length === 0
            ) {

                return {
                    success: false,
                    canceled: true
                };

            }


            const removeOriginal =
                mode === 'move';


            const sourcePaths =
                result.filePaths;


            operationName =
                sourcePaths.length === 1
                    ? path.basename(
                        sourcePaths[0]
                    )
                    : `${sourcePaths.length} files`;


            /*
                Stat every selected file up front.

                This finds a missing/unreadable
                file before any encryption starts,
                and gives an accurate combined
                total for the storage check and
                the progress bar.
            */

            const sourceStats = [];

            let totalBytes = 0;

            for (const sourcePath of sourcePaths) {

                const stat =
                    await fs.stat(
                        sourcePath
                    );

                sourceStats.push({
                    sourcePath,
                    size: stat.size
                });

                totalBytes += stat.size;

            }


            const storageCheck =
                await ensureVaultStorageAvailable(
                    totalBytes
                );


            if (!storageCheck.enough) {

                return {

                    success: false,

                    errorCode:
                        'INSUFFICIENT_STORAGE',

                    message:
                        'Not enough storage space.',

                    requiredBytes:
                        storageCheck.requiredWithBuffer,

                    fileSize:
                        totalBytes,

                    availableBytes:
                        storageCheck.availableBytes

                };

            }


            operationId =
                crypto.randomUUID();


            let lastProgressTime =
                Date.now();

            let lastProgressBytes =
                0;

            let smoothedSpeed =
                0;

            let completedFiles =
                0;

            let processedBytesTotal =
                0;


            sendVaultProgress(
                event,
                {
                    operationId,

                    operation:
                        'encrypt',

                    itemType:
                        'file',

                    status:
                        'started',

                    name:
                        operationName,

                    currentFile:
                        null,

                    processedBytes:
                        0,

                    totalBytes,

                    totalFiles:
                        sourceStats.length,

                    completedFiles:
                        0
                }
            );


            const addedFiles = [];
const addedSourcePaths = [];
const failures = [];


            for (
                const {
                    sourcePath,
                    size
                } of sourceStats
            ) {

                const fileName =
                    path.basename(
                        sourcePath
                    );


                try {

                    const file =
                        await encryptFileV2(
                            sourcePath,
                            {
                                mode: mode === 'move' ? 'move' : 'copy',
                                operationId:
    operationId,
    onProgress:
                                    progress => {

                    const now =
                        Date.now();


                    const elapsedSeconds =
                        (
                            now -
                            lastProgressTime
                        ) / 1000;


                    if (
                        elapsedSeconds >= 0.25
                    ) {

                        const currentGlobalBytes =
                            processedBytesTotal +
                            progress.processedBytes;


                        const bytesDifference =
                            currentGlobalBytes -
                            lastProgressBytes;


                        const instantSpeed =
                            bytesDifference /
                            elapsedSeconds;


                        if (
                            smoothedSpeed === 0
                        ) {

                            smoothedSpeed =
                                instantSpeed;

                        } else {

                            smoothedSpeed =
                                (
                                    smoothedSpeed * 0.7
                                ) +
                                (
                                    instantSpeed * 0.3
                                );

                        }


                        lastProgressTime =
                            now;

                        lastProgressBytes =
                            currentGlobalBytes;

                    }


                    const globalProcessedBytes =
                        processedBytesTotal +
                        progress.processedBytes;


                    const remainingBytes =
                        Math.max(
                            0,
                            totalBytes -
                            globalProcessedBytes
                        );


                    const etaSeconds =
                        smoothedSpeed > 0
                            ? remainingBytes /
                                smoothedSpeed
                            : null;


                    sendVaultProgress(
                        event,
                        {
                            operationId,

                            operation:
                                'encrypt',

                            itemType:
                                'file',

                            status:
                                'progress',

                            name:
                                fileName,

                            currentFile:
                                fileName,

                            processedBytes:
                                globalProcessedBytes,

                            totalBytes,

                            totalFiles:
                                sourceStats.length,

                            completedFiles,

                            speedBytesPerSecond:
                                smoothedSpeed,

                            etaSeconds
                        }
                    );

                                }
                            }
                        );


                    file.sourceRemoved =
    false;


                    addedFiles.push(
                        file
                    );

                    addedSourcePaths.push(
    sourcePath
);

                    completedFiles += 1;

                    processedBytesTotal += size;


                    sendVaultProgress(
                        event,
                        {
                            operationId,

                            operation:
                                'encrypt',

                            itemType:
                                'file',

                            status:
                                'progress',

                            name:
                                fileName,

                            currentFile:
                                null,

                            processedBytes:
                                processedBytesTotal,

                            totalBytes,

                            totalFiles:
                                sourceStats.length,

                            completedFiles,

                            completedFile:
                                fileName,

                            speedBytesPerSecond:
                                smoothedSpeed,

                            etaSeconds:
                                null
                        }
                    );

                } catch (error) {

                    if (
    error.code ===
    'OPERATION_CANCELLED'
) {

break;

}

                    console.error(
                        `Add file failed for "${fileName}":`,
                        error
                    );

                    processedBytesTotal += size;

                    failures.push({
                        name: fileName,
                        message:
                            error.message ||
                            'Unable to add file.'
                    });

                }

            }


            if (
    isVaultOperationCancelled(
        operationId
    )
) {

    for (
        const file of addedFiles
    ) {

        try {

            await fs.unlink(
                path.join(
                    getVaultFilesDirectory(),
                    file.encryptedFile
                )
            );

        } catch (cleanupError) {

            if (
                cleanupError.code !==
                'ENOENT'
            ) {

                console.error(
                    'Unable to rollback cancelled encrypted file:',
                    file.encryptedFile,
                    cleanupError
                );

            }

        }

    }


    const cancelError =
        createVaultOperationCancelledError();

    throw cancelError;

}

if (addedFiles.length === 0) {

                const failureError =
                    new Error(
                        failures[0]?.message ||
                        'Unable to add files.'
                    );

                sendVaultOperationFailure(
                    event,
                    {
                        operationId,

                        operation:
                            'encrypt',

                        itemType:
                            'file',

                        name:
                            operationName,

                        error:
                            failureError,

                        fallbackMessage:
                            'Unable to add files.'
                    }
                );

                return {
                    success: false,
                    operationFailed: true,
                    message:
                        failureError.message,
                    failures
                };

            }

            if (
    isVaultOperationCancelled(
        operationId
    )
) {

    const cancelError =
        createVaultOperationCancelledError();

    throw cancelError;

}


const index =
    await readVaultIndex();


index.files.push(
    ...addedFiles
);


await writeVaultIndex(
    index
);

if (removeOriginal) {

    for (
        let i = 0;
        i < addedFiles.length;
        i++
    ) {

        const file =
            addedFiles[i];

        const sourcePath =
    addedSourcePaths[i];


        try {

            await verifyCLV2FileStream(
                file
            );


            await fs.unlink(
                sourcePath
            );


            file.sourceRemoved =
                true;


        } catch (error) {

            file.sourceRemoved =
                false;

            file.sourceRemoveError =
                error.message ||
                'Unable to remove original file.';

            console.error(
                'Unable to remove original file after batch commit:',
                sourcePath,
                error
            );

        }

    }

}

if (removeOriginal) {

    const updatedIndex =
        await readVaultIndex();


    const addedFileIds =
        new Set(
            addedFiles.map(
                file => file.id
            )
        );


    for (
        const indexedFile
        of updatedIndex.files
    ) {

        if (
            addedFileIds.has(
                indexedFile.id
            )
        ) {

            const processedFile =
                addedFiles.find(
                    file =>
                        file.id ===
                        indexedFile.id
                );


            indexedFile.sourceRemoved =
                processedFile.sourceRemoved;


            if (
                processedFile.sourceRemoveError
            ) {

                indexedFile.sourceRemoveError =
                    processedFile
                        .sourceRemoveError;

            }

        }

    }


    await writeVaultIndex(
        updatedIndex
    );

}

            sendVaultProgress(
                event,
                {
                    operationId,

                    operation:
                        'encrypt',

                    itemType:
                        'file',

                    status:
                        'completed',

                    name:
                        operationName,

                    currentFile:
                        null,

                    processedBytes:
                        totalBytes,

                    totalBytes,

                    totalFiles:
                        sourceStats.length,

                    completedFiles:
                        addedFiles.length,

                    completedFile:
                        operationName
                }
            );


            return {
                success: true,
                files: addedFiles,
                failures
            };


        } catch (error) {

    console.error(
        'Add file failed:',
        error
    );


    if (operationId) {

        sendVaultOperationFailure(
            event,
            {
                operationId,

                operation:
                    'encrypt',

                itemType:
                    'file',

                name:
                    operationName,

                error,

                fallbackMessage:
                    'Unable to add file.'
            }
        );

    }


    return {

    success: false,

    operationFailed:
        Boolean(operationId),

    errorCode:
        typeof error.code === 'string'
            ? error.code
            : 'OPERATION_FAILED',

    message:
        error.message ||
        'Unable to add file.'

};

}

    }
);


/* =========================================
   CLEAR VAULT SESSION
========================================= */

function clearVaultSession() {

    sessionManager.destroySession();

}

/* =========================================
   SYSTEM SLEEP VAULT LOCK
========================================= */

async function lockVaultForSystemSleep() {

    try {

        /*
            Read the latest saved setting
            every time Windows is about to sleep.

            This means changing the toggle does
            not require an application restart.
        */

        const settings =
            await readApplicationSettings();


        if (
            settings.lockOnSleep !== true
        ) {

            return;

        }


        /*
            Already locked = nothing to do.
        */

        if (!sessionManager.isUnlocked()) {
            return;
        }


        /*
            Security-critical part:

            clearVaultSession() overwrites the
            AES key Buffer before removing it.
        */

        sessionManager.destroySession();


        console.log(
            'CrypticLocker locked the vault because the computer entered sleep mode.'
        );


        /*
            Tell the renderer that the main
            process locked the vault externally.

            The renderer will later switch from
            Dashboard/Settings/etc. to the
            Unlock screen.
        */

        if (
            mainWindow &&
            !mainWindow.isDestroyed()
        ) {

            mainWindow.webContents.send(
                'vault:session-locked',
                {
                    reason:
                        'system-sleep'
                }
            );

        }


    } catch (error) {

        console.error(
            'Unable to process system sleep lock:',
            error
        );

    }

}

/* =========================================
   UNLOCK VAULT
========================================= */

async function unlockVault(password) {

    if (
        typeof password !== 'string' ||
        password.length === 0
    ) {
        return false;
    }


    let passwordUnlockKey = null;

let vaultMasterKey = null;


    try {

        const configData =
            await fs.readFile(
                getVaultConfigPath(),
                'utf8'
            );


        const config =
            JSON.parse(configData);


        const salt =
            Buffer.from(
                config.password.salt,
                'base64'
            );


        passwordUnlockKey =
    vaultCrypto.derivePasswordKey(
        password,
        salt
    );

    const iv =
    Buffer.from(
        config.password.vmk.iv,
        'base64'
    );

const authTag =
    Buffer.from(
        config.password.vmk.authTag,
        'base64'
    );

const ciphertext =
    Buffer.from(
        config.password.vmk.encrypted,
        'base64'
    );
    
    const passwordPackage = {

    iv,

    authTag,

    encryptedVMK: ciphertext

};

vaultMasterKey =
    vaultCrypto.decryptVaultMasterKey(
        passwordPackage,
        passwordUnlockKey
    );


        /*
            Remove any previous session key.
        */

        sessionManager.destroySession();

sessionManager.createSession();


        /*
            Keep a copy of the derived key
            only in the Electron main process.
        */

        sessionManager.setVaultMasterKey(
    vaultMasterKey
);


        /*
            Wipe temporary key buffer.
        */


        return true;


    } catch {

    return false;

} finally {

    if (passwordUnlockKey) {
        passwordUnlockKey.fill(0);
    }

    if (vaultMasterKey) {
        vaultMasterKey.fill(0);
    }

}

}

/* =========================================
   VAULT INTEGRITY CHECK
========================================= */

async function checkVaultStructure(report) {

    report.structure.vaultConfig =
        await pathExists(
            getVaultConfigPath()
        );

    const indexExists =
        await pathExists(
            getVaultIndexPath()
        );

    const backupExists =
        await pathExists(
            getVaultIndexBackupPath()
        );

    const filesFolderExists =
        await pathExists(
            getVaultFilesDirectory()
        );

    /*
        A fresh vault has no index.clm,
        no index.clm.bak, and no files/
        directory. This is perfectly valid
        — the vault is simply empty.

        These structures are only created
        when the first file is added.

        Mark them as "passed" if the vault
        is in a consistent empty state
        (config exists but index doesn't).
    */

    if (indexExists) {

        report.structure.vaultIndex = true;

        /*
            index.clm.bak is created by
            writeVaultIndex() when rotating
            a previous index.clm to backup.

            It only exists after the second
            index write cycle. Its absence
            is NEVER a corruption indicator
            — it simply means the vault has
            had few operations.
        */

        report.structure.indexBackup =
            true;

    } else {

        /*
            No index.clm — vault is empty.
            This is valid, not an issue.
        */

        report.structure.vaultIndex = true;
        report.structure.indexBackup = true;

    }


    /*
        files/ directory is created on
        first file add. Its absence in
        an empty vault is normal.
    */

    report.structure.filesFolder =
        filesFolderExists || !indexExists;

}

async function checkVaultConfiguration(report) {

    if (!report.structure.vaultConfig) {

        return;

    }

    try {

        const rawConfig =
            await fs.readFile(
                getVaultConfigPath(),
                'utf8'
            );

        const config =
            JSON.parse(rawConfig);

        report.configuration.validJson =
            true;

        report.configuration.passwordSection =
            !!config.password;

        report.configuration.recoverySection =
            !!config.recovery;

        report.configuration.versionField =
            !!config.version;

    }

    catch {

        report.configuration.validJson =
            false;

    }

}

async function checkVaultIndex(report) {

    /*
        readVaultIndex() gracefully handles
        ENOENT (fresh vault with no index)
        by returning { files: [], folders: [] }.

        So we always call it — if it fails
        for a reason other than ENOENT,
        that's a genuine integrity issue.
    */

    try {

        const index =
            await readVaultIndex();

        report.index.readable =
            true;

        report.index.filesArray =
            Array.isArray(
                index.files
            );

        report.index.foldersArray =
            Array.isArray(
                index.folders
            );

    }

    catch {

        report.index.readable =
            false;

    }

}

async function checkVaultContainers(
    report
) {

    if (!report.index.readable) {

        return;

    }

    const index =
        await readVaultIndex();

    let allPresent =
        true;

    for (const file of index.files) {

        const exists =
            await pathExists(

                getVaultEncryptedFilePath(

                    file.encryptedFile

                )

            );

        if (!exists) {

            allPresent = false;

            report.containers.missing.push(

                file.name

            );

        }

    }

    report.containers.allPresent =
        allPresent;

}

function buildIntegritySummary(
    report
) {

    let issues = 0;

    if (!report.structure.vaultConfig)
        issues++;

    if (!report.structure.vaultIndex)
        issues++;

    if (!report.structure.indexBackup)
        issues++;

    if (!report.structure.filesFolder)
        issues++;

    if (!report.configuration.validJson)
        issues++;

    if (!report.configuration.passwordSection)
        issues++;

    if (!report.configuration.recoverySection)
        issues++;

    if (!report.configuration.versionField)
        issues++;

    if (!report.index.readable)
        issues++;

    if (!report.index.filesArray)
        issues++;

    if (!report.index.foldersArray)
        issues++;

    issues +=
        report.containers.missing.length;


    if (issues === 0) {

        return {

            status: 'HEALTHY',

            issues: 0,

            message:
                'No integrity issues detected.'

        };

    }


    return {

        status: 'WARNING',

        issues,

        message:
            `${issues} integrity issue(s) detected.`

    };

}

async function checkVaultIntegrity() {

const report = {

    structure: {

        vaultConfig: false,

        vaultIndex: false,

        indexBackup: false,

        filesFolder: false

    },

    configuration: {

    validJson: false,

    passwordSection: false,

    recoverySection: false,

    versionField: false

},

index: {

    readable: false,

    filesArray: false,

    foldersArray: false

},

containers: {

    allPresent: false,

    missing: []

}

};

await checkVaultStructure(report);
await checkVaultConfiguration(report);
await checkVaultIndex(report);
await checkVaultContainers(report);

    const passed =
    report.structure.vaultConfig &&
    report.structure.vaultIndex &&
    report.structure.indexBackup && 
    report.structure.filesFolder &&
    report.configuration.validJson &&
    report.configuration.passwordSection &&
    report.configuration.recoverySection &&
    report.index.readable &&
    report.index.filesArray &&
    report.index.foldersArray &&
    report.containers.allPresent &&
    report.configuration.versionField;

    const summary =
    buildIntegritySummary(
        report
    );

return {

    success: true,

    passed,

    summary,

    report

};

}
    
async function changeMasterPassword(
    currentPassword,
    newPassword
) {

    if (
        typeof newPassword !== 'string' ||
        newPassword.length < 8 ||
        !/[A-Z]/.test(newPassword) ||
        !/[a-z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword)
    ) {

        return {

            success: false,

            message:
                'Password does not meet the requirements.'

        };

    }

    if (
        typeof currentPassword !== 'string' ||
        currentPassword.length === 0
    ) {

        return {

            success: false,

            message:
                'Enter your current password.'

        };

    }

    if (currentPassword === newPassword) {

        return {

            success: false,

            message:
                'New password must be different from your current password.'

        };

    }

    let currentPasswordUnlockKey =
        null;

    let vaultMasterKey =
        null;

    let newPasswordUnlockKey =
        null;

    try {

        /*
            STEP 1

            Read vault.json
        */

        const configData =
            await fs.readFile(
                getVaultConfigPath(),
                'utf8'
            );

        const config =
            JSON.parse(
                configData
            );

        /*
            Derive key from
            CURRENT password.
        */
       const passwordSalt =
    Buffer.from(
        config.password.salt,
        'base64'
    );

currentPasswordUnlockKey =
    vaultCrypto.derivePasswordKey(
        currentPassword,
        passwordSalt
    );

        /*
            Decrypt SAME VMK.
        */
       const passwordPackage = {

    iv:
        Buffer.from(
            config.password.vmk.iv,
            'base64'
        ),

    authTag:
        Buffer.from(
            config.password.vmk.authTag,
            'base64'
        ),

    encryptedVMK:
        Buffer.from(
            config.password.vmk.encrypted,
            'base64'
        )

};

try {

    vaultMasterKey =
        vaultCrypto.decryptVaultMasterKey(
            passwordPackage,
            currentPasswordUnlockKey
        );

} catch {

    return {

        success: false,

        message:
            'Incorrect current password.'

    };

}

        /*
            Generate NEW salt.
        */
       const newPasswordSalt =
    crypto.randomBytes(
        CONSTANTS.SCRYPT.SALT_LENGTH
    );

        /*
            Derive NEW password key.
        */
       newPasswordUnlockKey =
    vaultCrypto.derivePasswordKey(
        newPassword,
        newPasswordSalt
    );

        /*
            Encrypt SAME VMK
            using NEW password.
        */
       const newPasswordPackage =
    vaultCrypto.encryptVaultMasterKey(
        vaultMasterKey,
        newPasswordUnlockKey
    );

        /*
            Replace ONLY the
            password section.
        */
       config.password = {

    algorithm: "scrypt",

    salt:
        newPasswordSalt.toString(
            'base64'
        ),

    N:
        CONSTANTS.SCRYPT.N,

    r:
        CONSTANTS.SCRYPT.R,

    p:
        CONSTANTS.SCRYPT.P,

    vmk: {

        iv:
            newPasswordPackage
                .iv
                .toString(
                    'base64'
                ),

        authTag:
            newPasswordPackage
                .authTag
                .toString(
                    'base64'
                ),

        encrypted:
            newPasswordPackage
                .encryptedVMK
                .toString(
                    'base64'
                )

    }

};

        /*
            Save vault.json.
        */
       const temporaryPath =
    path.join(
        getVaultDirectory(),
        'vault.tmp'
    );

await fs.writeFile(

    temporaryPath,

    JSON.stringify(
        config,
        null,
        2
    ),

    {

        encoding:
            'utf8',

        flag:
            'w'

    }

);

await fs.rename(

    temporaryPath,

    getVaultConfigPath()

);

        /*
            Destroy session.

            User must login again
            using NEW password.
        */

        sessionManager.destroySession();

setPendingLoginSuccessMessage(
    'Password changed successfully. Log in using your new password.'
);

mainWindow.webContents.send(
    'vault:session-locked'
);

        return {

            success: true

        };

    }

    finally {

        if (
            currentPasswordUnlockKey
        ) {

            currentPasswordUnlockKey.fill(
                0
            );

        }

        if (
            newPasswordUnlockKey
        ) {

            newPasswordUnlockKey.fill(
                0
            );

        }

        if (
            vaultMasterKey
        ) {

            vaultMasterKey.fill(
                0
            );

        }

    }

}
    
    /* =========================================
   VERIFY MASTER PASSWORD
========================================= */

ipcMain.handle(
    'vault:verify-password',
    async (event, password) => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                message: 'Vault is locked.'
            };
        }

        if (
            typeof password !== 'string' ||
            password.length === 0
        ) {
            return {
                success: false,
                message: 'Password is required.'
            };
        }

        try {

            const configData =
                await fs.readFile(
                    getVaultConfigPath(),
                    'utf8'
                );

            const config =
                JSON.parse(
                    configData
                );

            const passwordSalt =
                Buffer.from(
                    config.password.salt,
                    'base64'
                );

            const passwordUnlockKey =
                vaultCrypto.derivePasswordKey(
                    password,
                    passwordSalt
                );

            const passwordPackage = {

                iv:
                    Buffer.from(
                        config.password.vmk.iv,
                        'base64'
                    ),

                authTag:
                    Buffer.from(
                        config.password.vmk.authTag,
                        'base64'
                    ),

                encryptedVMK:
                    Buffer.from(
                        config.password.vmk.encrypted,
                        'base64'
                    )

            };

            try {

                vaultCrypto.decryptVaultMasterKey(
                    passwordPackage,
                    passwordUnlockKey
                );

                return {
                    success: true
                };

            } catch {

                return {
                    success: false,
                    message: 'Incorrect password.'
                };

            }

        } catch (error) {

            console.error('Password verify error:', error);
            return {
                success: false,
                message: 'Failed to verify password.'
            };

        }

    }
);

    /* =========================================
   DELETE VAULT
========================================= */

ipcMain.handle(
    'vault:delete-vault',
    async (event, password) => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                message: 'Vault is locked.'
            };
        }

        if (
            typeof password !== 'string' ||
            password.length === 0
        ) {
            return {
                success: false,
                message:
                    'Password is required to delete the vault.'
            };
        }


        /*
            Verify the provided password
            by deriving PUK and decrypting VMK.
        */

        try {

            const configData =
                await fs.readFile(
                    getVaultConfigPath(),
                    'utf8'
                );

            const config =
                JSON.parse(
                    configData
                );


            const passwordSalt =
                Buffer.from(
                    config.password.salt,
                    'base64'
                );

            const passwordUnlockKey =
                vaultCrypto.derivePasswordKey(
                    password,
                    passwordSalt
                );


            const passwordPackage = {

                iv:
                    Buffer.from(
                        config.password.vmk.iv,
                        'base64'
                    ),

                authTag:
                    Buffer.from(
                        config.password.vmk.authTag,
                        'base64'
                    ),

                encryptedVMK:
                    Buffer.from(
                        config.password.vmk.encrypted,
                        'base64'
                    )

            };


            try {

                vaultCrypto.decryptVaultMasterKey(
                    passwordPackage,
                    passwordUnlockKey
                );

            } catch {

                return {
                    success: false,
                    message:
                        'Incorrect password.'
                };

            }


            /*
                Password verified.
                Destroy the in-memory session first.
            */

            sessionManager.destroySession();


            /*
                Delete the entire vault directory.
            */

            const vaultDir =
                getVaultDirectory();

            try {

                await fs.rm(
                    vaultDir,
                    {
                        recursive: true,
                        force: true
                    }
                );

            } catch (rmError) {

                console.error(
                    'Failed to delete vault directory:',
                    rmError
                );

                return {
                    success: false,
                    message:
                        'Failed to delete vault data. Some files may be in use.'
                };

            }


            /*
                Delete settings.json
                for a clean fresh start.
            */

            try {

                await fs.unlink(
                    path.join(
                        app.getPath('userData'),
                        'settings.json'
                    )
                );

            } catch {

                /* Settings file may not exist, ignore. */

            }


            /*
                Reset any failed attempt lockout state.
            */

            await resetLockoutState();


            /*
                Redirect to create vault screen.
            */

            if (mainWindow && !mainWindow.isDestroyed()) {

                mainWindow.loadFile(
                    'src/index.html'
                );

            }


            return {
                success: true
            };


        } catch (error) {

            console.error(
                'Delete vault error:',
                error
            );

            return {
                success: false,
                message:
                    'An unexpected error occurred while deleting the vault.'
            };

        }

    }
);

    /* =========================================
   EXPORT VAULT
========================================= */

ipcMain.handle(
    'vault:export-vault',
    async (event) => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                message: 'Vault must be unlocked to export.'
            };
        }

        const exportOperationId = 'export_' + Date.now();
        let saveFilePath = null;

        try {

            const vaultDir = getVaultDirectory();
            const vaultConfigPath = getVaultConfigPath();

            try {
                await fs.access(vaultConfigPath);
            } catch {
                return {
                    success: false,
                    message: 'No active vault configuration found to export.'
                };
            }

            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const defaultFilename = `CrypticLocker_${timestamp}.clvault`;

            const saveResult = await dialog.showSaveDialog(
                mainWindow,
                {
                    title: 'Export CrypticLocker Vault',
                    defaultPath: path.join(
                        app.getPath('downloads'),
                        defaultFilename
                    ),
                    buttonLabel: 'Export Vault',
                    filters: [
                        {
                            name: 'CrypticLocker Vault Archive (*.clvault)',
                            extensions: ['clvault']
                        }
                    ],
                    properties: ['showOverwriteConfirmation']
                }
            );

            if (saveResult.canceled || !saveResult.filePath) {
                return {
                    success: false,
                    canceled: true
                };
            }

            // Pre-check destination disk space
            const files = await vaultPackage.collectFilesRecursively(vaultDir);
            let totalVaultBytes = 0;
            for (const f of files) {
                try {
                    const s = await fs.stat(f.fullPath);
                    totalVaultBytes += s.size;
                } catch {}
            }

            const destinationDir = path.dirname(saveResult.filePath);
            saveFilePath = saveResult.filePath;
            const storageCheck = await ensureStorageAvailable(destinationDir, totalVaultBytes);
            if (!storageCheck.enough) {
                return {
                    success: false,
                    errorCode: 'INSUFFICIENT_STORAGE',
                    requiredBytes: storageCheck.requiredWithBuffer,
                    availableBytes: storageCheck.availableBytes,
                    message: 'Not enough storage space on the selected destination drive.'
                };
            }

            const exportResult = await vaultPackage.exportVaultPackage(
                vaultDir,
                saveFilePath,
                getApplicationSettingsPath(),
                (progress) => {
                    sendVaultProgress(event, {
                        ...progress,
                        operationId: exportOperationId
                    });
                },
                () => isVaultOperationCancelled(exportOperationId)
            );

            return {
                success: true,
                filePath: exportResult.outputPath,
                fileCount: exportResult.fileCount,
                totalBytes: exportResult.totalBytes
            };

        } catch (error) {

            if (error.code === 'OPERATION_CANCELLED' || (exportOperationId && isVaultOperationCancelled(exportOperationId))) {
                sendVaultProgress(event, {
                    operationId: exportOperationId,
                    operation: 'export',
                    status: 'cancelled',
                    name: path.basename(saveFilePath || 'vault_backup.clvault'),
                    message: 'The vault export was cancelled.'
                });
                return {
                    success: false,
                    canceled: true
                };
            }

            console.error('Export vault error:', error);
            return {
                success: false,
                message: error.message || 'Failed to export vault.'
            };

        }

    }
);

    /* =========================================
   IMPORT VAULT
========================================= */

ipcMain.handle(
    'vault:import-vault',
    async (event) => {

        // Import is strictly permitted on fresh install (when no vault exists)
        if (await vaultExists()) {
            return {
                success: false,
                message: 'A vault already exists. You must delete your current vault before importing an existing one.'
            };
        }

        const importOperationId = 'import_' + Date.now();
        let packageFilePath = null;

        try {

            const openResult = await dialog.showOpenDialog(
                mainWindow,
                {
                    title: 'Import CrypticLocker Vault',
                    buttonLabel: 'Import Vault',
                    properties: ['openFile'],
                    filters: [
                        {
                            name: 'CrypticLocker Vault Archive (*.clvault)',
                            extensions: ['clvault']
                        }
                    ]
                }
            );

            if (openResult.canceled || !openResult.filePaths || openResult.filePaths.length === 0) {
                return {
                    success: false,
                    canceled: true
                };
            }

            packageFilePath = openResult.filePaths[0];
            const targetVaultDir = getVaultDirectory();

            // Pre-check target drive disk space from package manifest
            let manifestTotalBytes = 0;
            try {
                const fd = await fs.open(packageFilePath, 'r');
                try {
                    const headerBuf = Buffer.alloc(16);
                    await fd.read(headerBuf, 0, 16, 0);
                    const manifestLen = headerBuf.readUInt32BE(12);
                    if (manifestLen > 0 && manifestLen < 10 * 1024 * 1024) {
                        const manifestBuf = Buffer.alloc(manifestLen);
                        await fd.read(manifestBuf, 0, manifestLen, 16);
                        const manifest = JSON.parse(manifestBuf.toString('utf8'));
                        manifestTotalBytes = manifest.totalBytes || 0;
                    }
                } finally {
                    await fd.close();
                }
            } catch {}

            if (manifestTotalBytes > 0) {
                const storageCheck = await ensureStorageAvailable(path.dirname(targetVaultDir), manifestTotalBytes);
                if (!storageCheck.enough) {
                    return {
                        success: false,
                        errorCode: 'INSUFFICIENT_STORAGE',
                        requiredBytes: storageCheck.requiredWithBuffer,
                        availableBytes: storageCheck.availableBytes,
                        message: 'Insufficient storage space on your device.'
                    };
                }
            }

            const importResult = await vaultPackage.validateAndExtractVaultPackage(
                packageFilePath,
                targetVaultDir,
                getApplicationSettingsPath(),
                (progress) => {
                    sendVaultProgress(event, {
                        ...progress,
                        operationId: importOperationId
                    });
                },
                () => isVaultOperationCancelled(importOperationId)
            );

            // Re-synchronize application settings into memory and platform state
            try {
                await synchronizeApplicationSettings();
            } catch (syncErr) {
                console.error('Failed to sync settings on import:', syncErr);
            }

            // Reset any previous lockout state
            await resetLockoutState();

            return {
                success: true,
                fileCount: importResult.fileCount,
                totalBytes: importResult.totalBytes,
                theme: importResult.theme
            };

        } catch (error) {

            if (error.code === 'OPERATION_CANCELLED' || (importOperationId && isVaultOperationCancelled(importOperationId))) {
                sendVaultProgress(event, {
                    operationId: importOperationId,
                    operation: 'import',
                    status: 'cancelled',
                    name: path.basename(packageFilePath || 'package.clvault'),
                    message: 'The vault import was cancelled.'
                });
                return {
                    success: false,
                    canceled: true
                };
            }

            console.error('Import vault error:', error);
            return {
                success: false,
                message: error.message || 'Failed to import vault package.'
            };

        }

    }
);

    /* =========================================
   LOCK VAULT
========================================= */

function lockVault() {

    sessionManager.destroySession();

    return {
        success: true
    };

}

/* =========================================
   CREATE WINDOW
========================================= */

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 1200,
        height: 750,

        minWidth: 900,
        minHeight: 600,

        center: true,

        title: 'CrypticLocker',

        icon: path.join(
            __dirname,
            'src',
            'img',
            'logo.png'
        ),

        autoHideMenuBar: true,

        webPreferences: {

            preload: path.join(
                __dirname,
                'preload.js'
            ),

            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }

    });


    mainWindow.loadFile(
        'src/index.html'
    );

}


ipcMain.handle(
    'auth:get-success-message',
    () => {

        return consumePendingLoginSuccessMessage();

    }
);

/* =========================================
   IPC
========================================= */

ipcMain.handle(
    'vault:exists',
    async () => {

        return await vaultExists();

    }
);

ipcMain.handle(
    'vault:delete-file',
    async (
        event,
        fileId
    ) => {

        let operationId = null;
        let operationName = null;


        /*
            Validate active vault session
            before attempting deletion.
        */
 
            if (!sessionManager.isUnlocked()) {

    return {
        success: false,
        message: 'Vault is locked.'
    };

}


        try {

            /*
                Basic IPC boundary validation.

                Renderer input is never trusted
                directly by the main process.
            */

            if (
                typeof fileId !== 'string' ||
                !fileId.trim()
            ) {

                throw new Error(
                    'Invalid file ID.'
                );

            }


            /*
                Read metadata first so the
                progress UI can display the
                real filename.
            */

            const index =
                await readVaultIndex();


            const file =
                index.files.find(
                    item =>
                        item.id === fileId
                );


            if (!file) {

                throw new Error(
                    'File was not found in the vault.'
                );

            }


            operationId =
                crypto.randomUUID();


            operationName =
                file.name;


            /*
                Notify renderer that deletion
                has started.

                Delete is not a byte-streaming
                operation, therefore speed and
                ETA remain terminal-style values.
            */

            sendVaultProgress(
                event,
                {

                    operationId,

                    operation:
                        'delete',

                    itemType:
                        'file',

                    status:
                        'started',

                    name:
                        operationName,

                    currentFile:
                        null,

                    processedBytes:
                        0,

                    totalBytes:
                        file.size || 0,

                    completedFiles:
                        0,

                    totalFiles:
                        1,

                    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        null

                }
            );


            /*
                Actual transaction-safe deletion.

                deleteVaultFile() commits the
                index removal first, verifies it,
                and only then removes the .clv.
            */

            const deleted =
                await deleteVaultFile(
                    fileId
                );


            /*
                Terminal success event.
            */

            sendVaultProgress(
                event,
                {

                    operationId,

                    operation:
                        'delete',

                    itemType:
                        'file',

                    status:
                        'completed',

                    name:
                        deleted.name,

                    currentFile:
                        null,

                    processedBytes:
                        file.size || 0,

                    totalBytes:
                        file.size || 0,

                    completedFiles:
                        1,

                    totalFiles:
                        1,

                    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        null

                }
            );


            return {

                success: true,

                operationId,

                deleted: {

                    id:
                        deleted.id,

                    name:
                        deleted.name,

                    encryptedFile:
                        deleted.encryptedFile

                }

            };


        } catch (error) {

            console.error(
                'Vault file deletion failed:',
                error
            );


            /*
                Use the same centralized failure
                event architecture as the other
                vault operations.
            */

            sendVaultOperationFailure(
                event,
                {

                    operationId,

                    operation:
                        'delete',

                    itemType:
                        'file',

                    name:
                        operationName,

                    error,

                    fallbackMessage:
                        'The file could not be deleted.'

                }
            );

        return {

    success: false,

    /*
        True only when the actual delete
        operation had already started.

        Renderer then knows that
        status: 'failed' was already sent
        to the centralized operation panel.
    */

    operationFailed:
        Boolean(operationId),

    operationId,

    errorCode:
        typeof error.code ===
            'string'
            ? error.code
            : 'DELETE_FAILED',

    message:
        error.message ||
        'The file could not be deleted.'

};

        }

    }
);

ipcMain.handle(
    'vault:cancel-operation',
    async (
        event,
        operationId
    ) => {

        return {
            success:
                markVaultOperationCancelled(
                    operationId
                )
        };

    }
);

/* =========================================
   APPLICATION SETTINGS IPC
========================================= */

ipcMain.handle(
    'settings:get',
    async () => {

        try {

            const settings =
    await synchronizeApplicationSettings();


            return {
                success: true,
                settings
            };


        } catch (error) {

            console.error(
                'Unable to get application settings:',
                error
            );


            return {
                success: false,
                message:
                    'Unable to load settings.'
            };

        }

    }
);


ipcMain.handle(
    'settings:update',
    async (
        event,
        updates
    ) => {

        try {

            /*
                Only allow known settings.

                Never directly merge arbitrary
                renderer-controlled properties
                into the settings file.
            */

            const allowedKeys =
                new Set([
                    'autoLockMinutes',
                    'lockOnSleep',
                    'theme',
                    'launchAtStartup'
                ]);


            if (
                !updates ||
                typeof updates !== 'object' ||
                Array.isArray(updates)
            ) {

                throw new Error(
                    'Invalid settings update.'
                );

            }


            const currentSettings =
                await readApplicationSettings();


            const nextSettings = {
                ...currentSettings
            };


            for (
                const [
                    key,
                    value
                ] of Object.entries(updates)
            ) {

                if (
                    allowedKeys.has(key)
                ) {

                    nextSettings[key] =
                        value;

                }

            }


            const savedSettings =
                await writeApplicationSettings(
                    nextSettings
                );

            if (nativeTheme && savedSettings.theme) {

                nativeTheme.themeSource =
                    savedSettings.theme;

            }


            return {
                success: true,
                settings:
                    savedSettings
            };


        } catch (error) {

            console.error(
                'Unable to update application settings:',
                error
            );


            return {
                success: false,
                message:
                    error.message ||
                    'Unable to save settings.'
            };

        }

    }
);

/* =========================================
   DELETE VAULT FOLDER IPC
========================================= */

ipcMain.handle(
    'vault:delete-folder',
    async (
        event,
        folderId
    ) => {

        let operationId = null;
        let operationName = null;


        /*
            Vault must already be unlocked.

            Never allow renderer input to reach
            deletion logic without an active key.
        */

        if (!sessionManager.isUnlocked()) {

    return {
        success: false,
        message: 'Vault is locked.'
    };

}


        try {

            /*
                IPC boundary validation.

                Renderer data is never trusted
                directly by the main process.
            */

            if (
                typeof folderId !== 'string' ||
                !folderId.trim()
            ) {

                throw new Error(
                    'Invalid folder ID.'
                );

            }


            /*
                Read current authenticated index
                before starting the operation.

                This gives us trusted folder
                metadata for progress reporting.
            */

            const index =
                await readVaultIndex();


            const folder =
                index.folders.find(
                    item =>
                        item.id === folderId
                );


            if (!folder) {

                throw new Error(
                    'Folder was not found in the vault.'
                );

            }


            /*
                Collect every file belonging to
                this folder transaction.

                All nested files still use the
                same root parentFolderId.
            */

            const folderFiles =
                index.files.filter(
                    file =>
                        file.parentFolderId ===
                        folderId
                );


            const totalFiles =
                folderFiles.length;


            const totalBytes =
                folderFiles.reduce(
                    (
                        total,
                        file
                    ) => {

                        return total +
                            (
                                typeof file.size ===
                                    'number'
                                    ? file.size
                                    : 0
                            );

                    },
                    0
                );


            operationId =
                crypto.randomUUID();


            operationName =
                folder.name;


            /*
                Folder deletion itself is not a
                byte-streaming operation.

                We still expose total file/byte
                information so the renderer can
                use the same operation UI.
            */

            sendVaultProgress(
                event,
                {

                    operationId,

                    operation:
                        'delete',

                    itemType:
                        'folder',

                    status:
                        'started',

                    name:
                        operationName,

                    currentFile:
                        null,

                    processedBytes:
                        0,

                    totalBytes,

                    completedFiles:
                        0,

                    totalFiles,

                    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        null

                }
            );


            /*
                Execute the transaction-safe
                folder deletion.

                deleteVaultFolder() guarantees:

                1. index.clm is updated first
                2. committed index is read back
                3. folder/file absence is verified
                4. only then are .clv containers
                   physically removed
            */

            const deleted =
                await deleteVaultFolder(
                    folderId
                );


            /*
                Terminal success event.
            */

            sendVaultProgress(
                event,
                {

                    operationId,

                    operation:
                        'delete',

                    itemType:
                        'folder',

                    status:
                        'completed',

                    name:
                        deleted.name,

                    currentFile:
                        null,

                    processedBytes:
                        totalBytes,

                    totalBytes,

                    completedFiles:
                        totalFiles,

                    totalFiles,

                    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        null

                }
            );


            return {

                success:
                    true,

                operationId,

                deleted: {

                    id:
                        deleted.id,

                    name:
                        deleted.name,

                    fileCount:
                        deleted.fileCount,

                    deletedContainerCount:
                        deleted.deletedContainerCount

                }

            };


        } catch (error) {

            console.error(
                'Vault folder deletion failed:',
                error
            );


            /*
                Use the same standardized
                terminal failure architecture
                already used by other vault
                operations.
            */

            sendVaultOperationFailure(
                event,
                {

                    operationId,

                    operation:
                        'delete',

                    itemType:
                        'folder',

                    name:
                        operationName,

                    error,

                    fallbackMessage:
                        'The folder could not be deleted.'

                }
            );


            /*
                Preserve useful structured
                information for special deletion
                failure states.

                DELETE_COMMIT_UNCERTAIN:
                    index may already have been
                    committed, therefore physical
                    containers were intentionally
                    left untouched.

                DELETE_CONTAINER_CLEANUP_FAILED:
                    index deletion succeeded but
                    one or more now-unreferenced
                    containers could not be removed.
            */

            return {

                success:
                    false,

                /*
    True only when the actual delete
    operation had already started.

    Renderer then knows that
    status: 'failed' was already sent
    to the centralized operation panel.
*/

operationFailed:
    Boolean(operationId),
    
    operationId,

                errorCode:
                    typeof error.code ===
                        'string'
                        ? error.code
                        : 'DELETE_FOLDER_FAILED',

                message:
                    error.message ||
                    'The folder could not be deleted.',

                folderId:
                    error.folderId ||
                    folderId,

                folderName:
                    error.folderName ||
                    operationName,

                cleanupFailures:
                    Array.isArray(
                        error.cleanupFailures
                    )
                        ? error.cleanupFailures
                        : [],

                deletedContainerCount:
                    typeof error.deletedContainerCount ===
                        'number'
                        ? error.deletedContainerCount
                        : null,

                totalContainerCount:
                    typeof error.totalContainerCount ===
                        'number'
                        ? error.totalContainerCount
                        : null

            };

        }

    }
);


/* =========================================
   BULK DELETE

   Reuses deleteVaultFile / deleteVaultFolder
   per item so the exact same safety checks
   that already protect single deletes apply
   here too. One item failing does not stop
   the rest — matches the existing quarantine
   bulk-delete pattern.
========================================= */

ipcMain.handle(
    'vault:bulk-delete',
    async (
        event,
        items
    ) => {

        if (!sessionManager.isUnlocked()) {

            return {
                success: false,
                message: 'Vault is locked.'
            };

        }


        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return {
                success: false,
                message: 'No items selected.'
            };

        }


        let deletedCount = 0;

        const failures = [];


        for (const item of items) {

            try {

                if (
                    !item ||
                    typeof item.id !== 'string' ||
                    (
                        item.type !== 'file' &&
                        item.type !== 'folder'
                    )
                ) {

                    throw new Error(
                        'Invalid item.'
                    );

                }


                if (item.type === 'folder') {

                    await deleteVaultFolder(
                        item.id
                    );

                } else {

                    await deleteVaultFile(
                        item.id
                    );

                }


                deletedCount += 1;


            } catch (error) {

                console.error(
                    `Bulk delete failed for "${item?.name || item?.id}":`,
                    error
                );

                failures.push({
                    name:
                        item?.name ||
                        item?.id ||
                        'item',
                    message:
                        error.message ||
                        'Unable to delete item.'
                });

            }

        }


        return {
            success: deletedCount > 0,
            deletedCount,
            failures
        };

    }
);


/* =========================================
   BULK RESTORE

   Asks for ONE destination folder, then
   reuses restoreVaultFileStream /
   restoreVaultFolder per item — the same
   functions the single-item restore path
   already relies on.
========================================= */

ipcMain.handle(
    'vault:bulk-restore',
    async (
        event,
        items,
        removeFromVault = false
    ) => {

        if (!sessionManager.isUnlocked()) {

            return {
                success: false,
                message: 'Vault is locked.'
            };

        }


        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return {
                success: false,
                message: 'No items selected.'
            };

        }


        let operationId = null;

        try {

            const destinationResult =
                await dialog.showOpenDialog(
                    mainWindow,
                    {
                        title:
                            'Choose where to restore items',

                        properties: [
                            'openDirectory',
                            'createDirectory'
                        ]
                    }
                );


            if (
                destinationResult.canceled ||
                destinationResult.filePaths.length === 0
            ) {

                return {
                    success: false,
                    canceled: true
                };

            }


            const destinationFolder =
                destinationResult.filePaths[0];


            const index =
                await readVaultIndex();


            /*
                Pre-calculate total bytes across
                all items so the progress overlay
                can display accurate percentages,
                processed sizes and ETA from the
                very first event.
            */

            let totalBytes = 0;
            let totalFileCount = 0;

            for (const item of items) {

                if (item.type === 'folder') {

                    const folderMeta =
                        index.folders.find(
                            f => f.id === item.id
                        );

                    if (folderMeta) {

                        totalBytes +=
                            typeof folderMeta.totalSize ===
                            'number'
                                ? folderMeta.totalSize
                                : 0;

                        totalFileCount +=
                            typeof folderMeta.fileCount ===
                            'number'
                                ? folderMeta.fileCount
                                : 1;

                    } else {

                        totalFileCount += 1;

                    }

                } else {

                    const fileMeta =
                        index.files.find(
                            f => f.id === item.id
                        );

                    if (fileMeta) {

                        totalBytes +=
                            typeof fileMeta.size ===
                            'number'
                                ? fileMeta.size
                                : 0;

                    }

                    totalFileCount += 1;

                }

            }


            operationId =
                crypto.randomUUID();


            const operationName =
                items.length === 1
                    ? (
                        items[0].name ||
                        'item'
                    )
                    : `${items.length} items`;


            let lastProgressTime =
                Date.now();

            let lastProgressBytes =
                0;

            let smoothedSpeed =
                0;

            let bytesCompletedSoFar =
                0;

            let globalCompletedFiles =
                0;


            sendVaultProgress(
                event,
                {
                    operationId,

                    operation:
                        'restore',

                    itemType:
                        'file',

                    status:
                        'started',

                    name:
                        operationName,

                    currentFile:
                        null,

                    processedBytes:
                        0,

                    totalBytes,

                    completedFiles:
                        0,

                    totalFiles:
                        totalFileCount,

                    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        null
                }
            );


            const restoredItems = [];
            const failures = [];

            let completedCount = 0;


            for (const item of items) {

                if (
                    isVaultOperationCancelled(
                        operationId
                    )
                ) {
                    break;
                }

                const itemLabel =
                    item?.name ||
                    item?.id ||
                    'item';


                try {

                    if (
                        !item ||
                        typeof item.id !== 'string' ||
                        (
                            item.type !== 'file' &&
                            item.type !== 'folder'
                        )
                    ) {

                        throw new Error(
                            'Invalid item.'
                        );

                    }


                    if (item.type === 'folder') {

                        const folderMetadata =
                            index.folders.find(
                                folder =>
                                    folder.id ===
                                    item.id
                            );


                        if (!folderMetadata) {

                            throw new Error(
                                'Folder not found in vault index.'
                            );

                        }


                        const folderBytesOffset =
                            bytesCompletedSoFar;

                        const folderFilesOffset =
                            globalCompletedFiles;

                        const folderDestinationPath =
                            path.join(
                                destinationFolder,
                                folderMetadata.name
                            );


                        await restoreVaultFolder(
                            folderMetadata,
                            index,
                            destinationFolder,

                            progress => {

                                const now =
                                    Date.now();


                                if (
                                    progress.status ===
                                    'progress'
                                ) {

                                    const elapsedSeconds =
                                        (
                                            now -
                                            lastProgressTime
                                        ) / 1000;


                                    if (
                                        elapsedSeconds >= 0.25
                                    ) {

                                        const currentGlobalBytes =
                                            folderBytesOffset +
                                            progress.processedBytes;


                                        const bytesDifference =
                                            currentGlobalBytes -
                                            lastProgressBytes;


                                        const instantSpeed =
                                            bytesDifference /
                                            elapsedSeconds;


                                        if (
                                            smoothedSpeed === 0
                                        ) {

                                            smoothedSpeed =
                                                instantSpeed;

                                        } else {

                                            smoothedSpeed =
                                                (
                                                    smoothedSpeed *
                                                    0.7
                                                ) +
                                                (
                                                    instantSpeed *
                                                    0.3
                                                );

                                        }


                                        lastProgressTime =
                                            now;

                                        lastProgressBytes =
                                            currentGlobalBytes;

                                    }

                                }


                                const globalProcessedBytes =
                                    folderBytesOffset +
                                    progress.processedBytes;

                                const globalFilesCompleted =
                                    folderFilesOffset +
                                    (progress.completedFiles || 0);


                                const remainingBytes =
                                    Math.max(
                                        0,
                                        totalBytes -
                                        globalProcessedBytes
                                    );


                                const etaSeconds =
                                    smoothedSpeed > 0
                                        ? remainingBytes /
                                            smoothedSpeed
                                        : null;


                                sendVaultProgress(
                                    event,
                                    {

                                        operationId,

                                        operation:
                                            'restore',

                                        itemType:
                                            'file',

                                        status:
                                            progress.status,

                                        name:
                                            operationName,

                                        currentFile:
                                            progress.currentFile ||
                                            folderMetadata.name,

                                        processedBytes:
                                            globalProcessedBytes,

                                        totalBytes,

                                        completedFiles:
                                            globalFilesCompleted,

                                        totalFiles:
                                            totalFileCount,

                                        speedBytesPerSecond:
                                            smoothedSpeed,

                                        etaSeconds

                                    }
                                );

                            },
                            operationId
                        );


                        const folderSize =
                            typeof folderMetadata.totalSize ===
                            'number'
                                ? folderMetadata.totalSize
                                : 0;

                        const folderFileCount =
                            typeof folderMetadata.fileCount ===
                            'number'
                                ? folderMetadata.fileCount
                                : 0;

                        bytesCompletedSoFar +=
                            folderSize;

                        globalCompletedFiles +=
                            folderFileCount;


                        restoredItems.push({
                            id: item.id,
                            type: 'folder',
                            name: folderMetadata.name,
                            destinationPath: folderDestinationPath
                        });


                    } else {

                        const fileMetadata =
                            index.files.find(
                                file =>
                                    file.id ===
                                    item.id
                            );


                        if (!fileMetadata) {

                            throw new Error(
                                'File not found in vault index.'
                            );

                        }


                        const destinationPath =
                            path.join(
                                destinationFolder,
                                fileMetadata.name
                            );


                        const fileBytesOffset =
                            bytesCompletedSoFar;


                        await restoreVaultFileAuto(
                            fileMetadata,
                            destinationPath,
                            operationId,
                            fileProgress => {

                                const now =
                                    Date.now();


                                const elapsedSeconds =
                                    (
                                        now -
                                        lastProgressTime
                                    ) / 1000;


                                if (
                                    elapsedSeconds >= 0.25
                                ) {

                                    const currentGlobalBytes =
                                        fileBytesOffset +
                                        fileProgress.processedBytes;


                                    const bytesDifference =
                                        currentGlobalBytes -
                                        lastProgressBytes;


                                    const instantSpeed =
                                        bytesDifference /
                                        elapsedSeconds;


                                    if (
                                        smoothedSpeed === 0
                                    ) {

                                        smoothedSpeed =
                                            instantSpeed;

                                    } else {

                                        smoothedSpeed =
                                            (
                                                smoothedSpeed *
                                                0.7
                                            ) +
                                                (
                                                    instantSpeed *
                                                    0.3
                                                );

                                    }


                                    lastProgressTime =
                                        now;

                                    lastProgressBytes =
                                        currentGlobalBytes;

                                }


                                const globalProcessedBytes =
                                    fileBytesOffset +
                                    fileProgress.processedBytes;


                                const remainingBytes =
                                    Math.max(
                                        0,
                                        totalBytes -
                                        globalProcessedBytes
                                    );


                                const etaSeconds =
                                    smoothedSpeed > 0
                                        ? remainingBytes /
                                            smoothedSpeed
                                        : null;


                                sendVaultProgress(
                                    event,
                                    {

                                        operationId,

                                        operation:
                                            'restore',

                                        itemType:
                                            'file',

                                        status:
                                            'progress',

                                        name:
                                            operationName,

                                        currentFile:
                                            fileMetadata.name,

                                        processedBytes:
                                            globalProcessedBytes,

                                        totalBytes,

                                        completedFiles:
                                            globalCompletedFiles,

                                        totalFiles:
                                            totalFileCount,

                                        speedBytesPerSecond:
                                            smoothedSpeed,

                                        etaSeconds

                                    }
                                );

                            }
                        );


                        const fileSize =
                            typeof fileMetadata.size ===
                            'number'
                                ? fileMetadata.size
                                : 0;

                        bytesCompletedSoFar +=
                            fileSize;

                        globalCompletedFiles += 1;


                        restoredItems.push({
                            id: item.id,
                            type: 'file',
                            name: fileMetadata.name,
                            destinationPath
                        });

                    }


                    completedCount += 1;


                    sendVaultProgress(
                        event,
                        {
                            operationId,

                            operation:
                                'restore',

                            itemType:
                                'file',

                            status:
                                'progress',

                            name:
                                operationName,

                            currentFile:
                                itemLabel,

                            processedBytes:
                                bytesCompletedSoFar,

                            totalBytes,

                            completedFiles:
                                globalCompletedFiles,

                            totalFiles:
                                totalFileCount,

                            completedFile:
                                itemLabel,

                            speedBytesPerSecond:
                                smoothedSpeed,

                            etaSeconds:
                                smoothedSpeed > 0
                                    ? Math.max(
                                        0,
                                        totalBytes -
                                        bytesCompletedSoFar
                                    ) / smoothedSpeed
                                    : null
                        }
                    );


                } catch (error) {

                    if (
                        error.code === 'OPERATION_CANCELLED' ||
                        isVaultOperationCancelled(operationId)
                    ) {
                        break;
                    }

                    console.error(
                        `Bulk restore failed for "${itemLabel}":`,
                        error
                    );

                    failures.push({
                        name: itemLabel,
                        message:
                            formatUserFriendlyError(
                                error,
                                'Unable to restore item.'
                            )
                    });

                }

            }


            /*
                ALL-OR-NOTHING RESTORE ROLLBACK:

                If user cancelled the batch operation mid-way,
                clean up all files and folders that were already
                restored to the destination directory.

                The vault remains completely untouched and
                consistent.
            */

            if (
                isVaultOperationCancelled(
                    operationId
                )
            ) {

                for (const restored of restoredItems) {

                    try {

                        if (restored.type === 'folder') {

                            await fs.rm(
                                restored.destinationPath,
                                {
                                    recursive: true,
                                    force: true
                                }
                            );

                        } else {

                            await fs.unlink(
                                restored.destinationPath
                            );

                        }

                    } catch (cleanupError) {

                        if (
                            cleanupError.code !== 'ENOENT'
                        ) {

                            console.error(
                                'Unable to rollback restored item on cancel:',
                                restored.destinationPath,
                                cleanupError
                            );

                        }

                    }

                }

                const cancelError =
                    createVaultOperationCancelledError();

                sendVaultOperationFailure(
                    event,
                    {
                        operationId,

                        operation:
                            'restore',

                        itemType:
                            'file',

                        name:
                            operationName,

                        error:
                            cancelError,

                        fallbackMessage:
                            'Restore cancelled.'
                    }
                );

                return {
                    success: false,
                    operationFailed: true,
                    message:
                        cancelError.message,
                    failures
                };

            }


            if (restoredItems.length === 0) {

                const failureError =
                    new Error(
                        failures[0]?.message ||
                        'Unable to restore items.'
                    );

                sendVaultOperationFailure(
                    event,
                    {
                        operationId,

                        operation:
                            'restore',

                        itemType:
                            'file',

                        name:
                            operationName,

                        error:
                            failureError,

                        fallbackMessage:
                            'Unable to restore items.'
                    }
                );

                return {
                    success: false,
                    operationFailed: true,
                    message:
                        failureError.message,
                    failures
                };

            }


            /*
                Only remove items from vault after the entire
                restore batch has succeeded without cancellation.
            */

            if (removeFromVault) {

                for (const restored of restoredItems) {

                    try {

                        if (restored.type === 'folder') {

                            await deleteVaultFolder(
                                restored.id
                            );

                        } else {

                            await deleteVaultFile(
                                restored.id
                            );

                        }

                    } catch (vaultDeleteError) {

                        console.error(
                            'Unable to remove restored item from vault:',
                            restored.id,
                            vaultDeleteError
                        );

                    }

                }

            }


            sendVaultProgress(
                event,
                {
                    operationId,

                    operation:
                        'restore',

                    itemType:
                        'file',

                    status:
                        'completed',

                    name:
                        operationName,

                    currentFile:
                        null,

                    processedBytes:
                        totalBytes,

                    totalBytes,

                    completedFiles:
                        globalCompletedFiles,

                    totalFiles:
                        totalFileCount,

                    completedFile:
                        operationName,

                    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        0
                }
            );


            return {
                success: true,
                restoredItems,
                failures
            };


        } catch (error) {

            console.error(
                'Bulk restore failed:',
                error
            );

            if (operationId) {

                sendVaultOperationFailure(
                    event,
                    {
                        operationId,

                        operation:
                            'restore',

                        itemType:
                            'file',

                        name:
                            'items',

                        error,

                        fallbackMessage:
                            'Unable to restore items.'
                    }
                );

            }

            return {

                success: false,

                operationFailed:
                    Boolean(operationId),

                message:
                    error.message ||
                    'Unable to restore items.'

            };

        }

    }
);

/* =========================================
   CHECK ITEMS STATUS (PRE-RESTORE VERIFICATION)
========================================= */

ipcMain.handle(
    'vault:check-items-status',
    async (event, items) => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                message: 'Vault is locked.'
            };
        }

        if (!Array.isArray(items) || items.length === 0) {
            return {
                success: false,
                message: 'No items provided.'
            };
        }

        try {

            const index =
                await readVaultIndex();

            const filesDir =
                getVaultFilesDirectory();

            let selectedFoldersCount = 0;
            let selectedFilesCount = 0;
            let totalFilesCount = 0;
            let missingFilesCount = 0;

            const folderIssues = [];
            const rootFileIssues = [];
            const validItems = [];
            const issueItems = [];

            for (const item of items) {

                if (item.type === 'folder') {

                    selectedFoldersCount += 1;

                    const folder =
                        index.folders.find(
                            f => f.id === item.id
                        );

                    if (!folder) {
                        missingFilesCount += 1;
                        totalFilesCount += 1;
                        const issueEntry = {
                            id: item.id,
                            name: item.name || 'Folder',
                            totalFiles: 0,
                            missingCount: 1,
                            validCount: 0,
                            allMissing: true,
                            missingFiles: [{
                                name: 'Folder index entry missing',
                                reason: 'Folder metadata missing from vault index'
                            }]
                        };
                        folderIssues.push(issueEntry);
                        issueItems.push({
                            id: item.id,
                            name: item.name || 'Folder',
                            type: 'folder',
                            reason: 'Folder metadata missing from vault index'
                        });
                        continue;
                    }

                    const childFiles =
                        index.files.filter(
                            f => f.parentFolderId === folder.id
                        );

                    const folderTotalFiles = childFiles.length;
                    totalFilesCount += folderTotalFiles;

                    const missingInFolder = [];
                    const validInFolder = [];

                    for (const child of childFiles) {

                        const encryptedPath =
                            path.join(
                                filesDir,
                                child.encryptedFile || ''
                            );

                        let exists = false;

                        try {
                            await fs.access(encryptedPath);
                            exists = true;
                        } catch {
                            exists = false;
                        }

                        if (!exists) {
                            missingInFolder.push({
                                id: child.id,
                                name: child.name,
                                relativePath: child.relativePath || child.name,
                                encryptedFile: child.encryptedFile || '',
                                size: typeof child.size === 'number' ? child.size : (child.formattedSize || 0),
                                reason: 'Encrypted container is missing from vault storage'
                            });
                            issueItems.push({
                                id: child.id,
                                name: `${folder.name}/${child.name}`,
                                encryptedFile: child.encryptedFile || '',
                                type: 'file',
                                size: typeof child.size === 'number' ? child.size : (child.formattedSize || 0),
                                reason: 'Encrypted container is missing from vault storage'
                            });
                        } else {
                            validInFolder.push(child);
                        }

                    }

                    missingFilesCount += missingInFolder.length;

                    if (missingInFolder.length > 0) {
                        folderIssues.push({
                            id: folder.id,
                            name: folder.name,
                            totalFiles: folderTotalFiles,
                            missingCount: missingInFolder.length,
                            validCount: validInFolder.length,
                            allMissing: (folderTotalFiles > 0 && missingInFolder.length === folderTotalFiles),
                            missingFiles: missingInFolder
                        });
                    }

                    if (validInFolder.length > 0) {
                        validItems.push(item);
                    }

                } else {

                    selectedFilesCount += 1;
                    totalFilesCount += 1;

                    const file =
                        index.files.find(
                            f => f.id === item.id
                        );

                    if (!file) {
                        missingFilesCount += 1;
                        rootFileIssues.push({
                            id: item.id,
                            name: item.name || 'File',
                            size: 0,
                            reason: 'File metadata missing from vault index'
                        });
                        issueItems.push({
                            id: item.id,
                            name: item.name || 'File',
                            type: 'file',
                            size: 0,
                            reason: 'File metadata missing from vault index'
                        });
                        continue;
                    }

                    const encryptedPath =
                        path.join(
                            filesDir,
                            file.encryptedFile || ''
                        );

                    let exists = false;

                    try {
                        await fs.access(encryptedPath);
                        exists = true;
                    } catch {
                        exists = false;
                    }

                    if (!exists) {
                        missingFilesCount += 1;
                        rootFileIssues.push({
                            id: file.id,
                            name: file.name,
                            encryptedFile: file.encryptedFile || '',
                            size: typeof file.size === 'number' ? file.size : 0,
                            reason: 'Encrypted container is missing from vault storage'
                        });
                        issueItems.push({
                            id: file.id,
                            name: file.name,
                            encryptedFile: file.encryptedFile || '',
                            type: 'file',
                            size: typeof file.size === 'number' ? file.size : 0,
                            reason: 'Encrypted container is missing from vault storage'
                        });
                    } else {
                        validItems.push(item);
                    }

                }

            }

            const verifiedFilesCount =
                Math.max(0, totalFilesCount - missingFilesCount);

            return {
                success: true,
                selectedTotalCount: items.length,
                selectedFoldersCount,
                selectedFilesCount,
                totalFilesCount,
                missingFilesCount,
                verifiedFilesCount,
                hasIssues: missingFilesCount > 0,
                folderIssues,
                rootFileIssues,
                issueItems,
                validItems
            };

        } catch (error) {

            console.error(
                'Check items status failed:',
                error
            );

            return {
                success: false,
                message: error.message || 'Unable to check item status.'
            };

        }

    }
);

function setPendingLoginSuccessMessage(
    message
) {

    pendingLoginSuccessMessage =
        message;

}

function consumePendingLoginSuccessMessage() {

    const message =
        pendingLoginSuccessMessage;

    pendingLoginSuccessMessage =
        null;

    return message;

}

ipcMain.handle(
    'vault:add-folder',
    async (
        event,
        mode = 'copy'
    ) => {

        if (!sessionManager.isUnlocked()) {

    return {
        success: false,
        message: 'Vault is locked.'
    };

}

        let operationId = null;
let operationName = null;

try {

    /*
        Ask user to select one or more
        folders to add to CrypticLocker.
    */

    const result =
        await dialog.showOpenDialog(
            mainWindow,
            {
                title:
                    'Add Folders to CrypticLocker',

                properties: [
                    'openDirectory',
                    'multiSelections'
                ]
            }
        );


    /*
        User closed/cancelled the folder picker.
    */

    if (
        result.canceled ||
        result.filePaths.length === 0
    ) {

        return {
            success: false,
            canceled: true
        };

    }


    const sourceFolders =
        result.filePaths;


    operationName =
        sourceFolders.length === 1
            ? path.basename(
                sourceFolders[0]
            )
            : `${sourceFolders.length} folders`;


    const removeOriginal =
        mode === 'move';


    operationId =
        crypto.randomUUID();


let lastProgressTime =
    Date.now();


let lastProgressBytes =
    0;


let smoothedSpeed =
    0;


/*
    Running totals from folders that have
    already fully completed. Combined with
    the current folder's own progress, this
    gives an accurate combined total across
    the whole batch even though each folder's
    own size is only discovered once its
    scan finishes.
*/

let bytesOffset = 0;
let filesOffset = 0;
let completedFolders = 0;


sendVaultProgress(
    event,
    {

        operationId,

        operation:
            'encrypt',

        itemType:
            'folder',

        status:
            'started',

        name:
            operationName,

        currentFile:
            null,

        processedBytes:
            0,

        totalBytes:
            0,

        completedFiles:
            0,

        totalFiles:
            0,

        speedBytesPerSecond:
            0,

        etaSeconds:
            null

    }
);


const addedFolders = [];
const failures = [];


for (
    const sourceFolder
    of sourceFolders
) {

    const folderLabel =
        path.basename(
            sourceFolder
        );


    try {

        const folder =
    await encryptFolder(
        sourceFolder,
        removeOriginal,

        operationId,

        progress => {

                    const now =
                        Date.now();


                    if (
                        progress.status ===
                        'progress'
                    ) {

                        const elapsedSeconds =
                            (
                                now -
                                lastProgressTime
                            ) / 1000;


                        if (
                            elapsedSeconds >= 0.25
                        ) {

                            const currentGlobalBytes =
                                bytesOffset +
                                progress.processedBytes;


                            const bytesDifference =
                                currentGlobalBytes -
                                lastProgressBytes;


                            const instantSpeed =
                                bytesDifference /
                                elapsedSeconds;


                            if (
                                smoothedSpeed === 0
                            ) {

                                smoothedSpeed =
                                    instantSpeed;

                            } else {

                                smoothedSpeed =
                                    (
                                        smoothedSpeed *
                                        0.7
                                    ) +
                                    (
                                        instantSpeed *
                                        0.3
                                    );

                            }


                            lastProgressTime =
                                now;


                            lastProgressBytes =
                                currentGlobalBytes;

                        }

                    }


                    const globalProcessedBytes =
                        bytesOffset +
                        progress.processedBytes;

                    const globalTotalBytes =
                        bytesOffset +
                        progress.totalBytes;

                    const globalCompletedFiles =
                        filesOffset +
                        progress.completedFiles;

                    const globalTotalFiles =
                        filesOffset +
                        progress.totalFiles;


                    const remainingBytes =
                        Math.max(
                            0,
                            globalTotalBytes -
                            globalProcessedBytes
                        );


                    const etaSeconds =
                        smoothedSpeed > 0
                            ? remainingBytes /
                                smoothedSpeed
                            : null;


                    sendVaultProgress(
                        event,
                        {

                            operationId,

                            operation:
                                'encrypt',

                            itemType:
                                'folder',

                            status:
                                progress.status,

                            name:
                                sourceFolders.length === 1
                                    ? progress.name
                                    : folderLabel,

                            currentFile:
                                progress.currentFile,

                            processedBytes:
                                globalProcessedBytes,

                            totalBytes:
                                globalTotalBytes,

                            completedFiles:
                                globalCompletedFiles,

                            totalFiles:
                                globalTotalFiles,

                            speedBytesPerSecond:
                                smoothedSpeed,

                            etaSeconds

                        }
                    );

                }
            );


        addedFolders.push(
            folder
        );

        bytesOffset +=
            folder.totalSize;

        filesOffset +=
            folder.fileCount;

        completedFolders += 1;


    } catch (error) {

        /*
            Special case:

            index.clm may already contain the
            transaction, but read-back verification
            could not confirm it.

            This is NOT a normal encryption failure.

            Stop the whole batch immediately so the
            user sees this before any further folders
            are touched — any remaining, not-yet-started
            folders in this selection are simply left
            untouched and can be re-added afterwards.
        */

        if (
            error.code ===
            'VAULT_COMMIT_UNCERTAIN'
        ) {

            console.error(
                'Vault folder commit is uncertain:',
                error
            );


            sendVaultProgress(
                event,
                {

                    operationId,

                    operation:
                        'encrypt',

                    itemType:
                        'folder',

                    status:
                        'attention',

                    name:
                        folderLabel,

                    currentFile:
                        null,

                    errorCode:
                        'VAULT_COMMIT_UNCERTAIN',

                    message:
                        'The folder was encrypted, but CrypticLocker could not verify the final vault commit. Your original folder has not been removed.',

                    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        null

                }
            );


            return {

                success:
                    addedFolders.length > 0,

                folders:
                    addedFolders,

                failures,

                errorCode:
                    'VAULT_COMMIT_UNCERTAIN',

                uncertainCommit:
                    true,

                message:
                    'The folder was encrypted, but CrypticLocker could not verify the final vault commit. Your original folder has not been removed.',

                folderId:
                    error.folderId || null,

                folderName:
                    error.folderName || null,

                encryptedFiles:
                    Array.isArray(
                        error.encryptedFiles
                    )
                        ? error.encryptedFiles
                        : []

            };

        }


        /*
            User-initiated cancellation.

            Stop the batch immediately and let
            the post-loop cancellation handler
            send the correct 'cancelled' status
            to the renderer.
        */

        if (
            error.code ===
            'OPERATION_CANCELLED'
        ) {

            break;

        }


        console.error(
            `Add folder failed for "${folderLabel}":`,
            error
        );


        failures.push({

            name:
                folderLabel,

            message:
                error.code ===
                'INSUFFICIENT_STORAGE'
                    ? 'Not enough storage space.'
                    : (
                        error.message ||
                        'Unable to add folder.'
                    )

        });

    }

}


/*
    The user cancelled the batch.

    Send a proper 'cancelled' terminal event so the
    renderer shows "Operation cancelled" instead of
    "Folder could not be secured".

    This mirrors the vault:add-file cancellation
    handler.
*/

if (
    isVaultOperationCancelled(
        operationId
    )
) {

    const cancelError =
        createVaultOperationCancelledError();

    sendVaultOperationFailure(
        event,
        {
            operationId,

            operation:
                'encrypt',

            itemType:
                'folder',

            name:
                operationName,

            error:
                cancelError,

            fallbackMessage:
                'Unable to add folders.'
        }
    );

    return {

        success: false,

        operationFailed: true,

        message:
            cancelError.message,

        failures

    };

}


if (addedFolders.length === 0) {

    const failureError =
        new Error(
            failures[0]?.message ||
            'Unable to add folders.'
        );

    sendVaultOperationFailure(
        event,
        {
            operationId,

            operation:
                'encrypt',

            itemType:
                'folder',

            name:
                operationName,

            error:
                failureError,

            fallbackMessage:
                'Unable to add folders.'
        }
    );

    return {

        success: false,

        operationFailed: true,

        message:
            failureError.message,

        failures

    };

}


sendVaultProgress(
    event,
    {

        operationId,

        operation:
            'encrypt',

        itemType:
            'folder',

        status:
            'completed',

        name:
            operationName,

        currentFile:
            null,

        processedBytes:
            bytesOffset,

        totalBytes:
            bytesOffset,

        completedFiles:
            filesOffset,

        totalFiles:
            filesOffset,

        speedBytesPerSecond:
            0,

        etaSeconds:
            0

    }
);


return {
    success: true,
    folders: addedFolders,
    failures
};


        } catch (error) {

    /*
        Preserve storage information because
        renderer may use these values for the
        dedicated insufficient-storage UI.
    */

    if (
        error.code ===
        'INSUFFICIENT_STORAGE'
    ) {

        if (operationId) {

            sendVaultOperationFailure(
                event,
                {
                    operationId,

                    operation:
                        'encrypt',

                    itemType:
                        'folder',

                    name:
                        operationName,

                    error,

                    fallbackMessage:
                        'Unable to add folder.'
                }
            );

        }

        return {

            success: false,

            operationFailed:
    Boolean(operationId),
    
    errorCode:
            'INSUFFICIENT_STORAGE',

        message:
            'Not enough storage space.',

        requiredBytes:
            error.requiredBytes,

        folderSize:
            error.folderSize,

        availableBytes:
            error.availableBytes

    };

}


console.error(
    'Add folder failed:',
    error
);

if (operationId) {

    sendVaultOperationFailure(
        event,
        {
            operationId,

            operation:
                'encrypt',

            itemType:
                'folder',

            name:
                operationName,

            error,

            fallbackMessage:
                'Unable to add folder.'
        }
    );

}


return {

    success: false,

    operationFailed:
        Boolean(operationId),

    errorCode:
        typeof error.code === 'string'
            ? error.code
            : 'OPERATION_FAILED',

    message:
        error.message ||
        'Unable to add folder.'

};

}

    }
);


ipcMain.handle(
    'vault:create',
    async (event, password) => {

        try {

            const result =
    await createVault(password);

return result;

        } catch (error) {

            console.error(
                'Vault creation failed:',
                error
            );

            return {
                success: false,
                message:
                    'Unable to create the vault.'
            };

        }

    }
);


/* =========================================
   CHECK QUARANTINED ORPHAN RECOVERY STATUS
========================================= */

ipcMain.handle(
    'vault:check-orphan-recovery',
    async (event, orphanFileName) => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                recoverable: false,
                message: 'Vault is locked.'
            };
        }

        const safeName =
            path.basename(String(orphanFileName || ''));

        if (!safeName || !safeName.endsWith('.clv')) {
            return {
                success: false,
                recoverable: false,
                message: 'Invalid CrypticLocker container.'
            };
        }

        const orphanPath =
            path.join(
                getVaultOrphansDirectory(),
                safeName
            );

        try {

            const stat = await fs.stat(orphanPath);
            if (!stat.isFile()) {
                return {
                    success: false,
                    recoverable: false,
                    message: 'Container is not a file.'
                };
            }

            const containerInfo =
                await detectCLVContainerVersion(orphanPath);

            const containerVersion =
                containerInfo.version;

            if (containerVersion === 1) {

                const idMatch =
                    safeName.match(
                        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
                    );

                if (!idMatch) {
                    return {
                        success: false,
                        recoverable: false,
                        message: 'Unable to recover the CLV1 container ID.'
                    };
                }

                return {
                    success: true,
                    recoverable: true,
                    originalName: `Recovered-${idMatch[1]}.bin`,
                    version: 1
                };

            } else if (containerVersion === CLV2_VERSION) {

                const inspection =
                    await inspectCLV2OrphanMetadata(safeName);

                if (
                    !inspection ||
                    inspection.success !== true ||
                    !inspection.originalName
                ) {
                    return {
                        success: false,
                        recoverable: false,
                        message: 'Unable to inspect CLV2 recovery metadata.'
                    };
                }

                return {
                    success: true,
                    recoverable: true,
                    originalName: inspection.originalName,
                    version: 2
                };

            } else {

                return {
                    success: false,
                    recoverable: false,
                    message: 'Unsupported CrypticLocker container version.'
                };

            }

        } catch (error) {

            return {
                success: false,
                recoverable: false,
                message: error.message || 'Unable to inspect quarantined container.'
            };

        }

    }
);


/* =========================================
   RECOVER QUARANTINED ORPHAN
   CLV1 + CLV2 AUTO ROUTER
========================================= */

ipcMain.handle(
    'vault:recover-orphan',
    async (
        event,
        orphanFileName,
        removeFromQuarantine = false
    ) => {

        let operationId = null;

        let safeName = null;


        try {

            if (!sessionManager.isUnlocked()) {

    return {
        success: false,
        message: 'Vault is locked.'
    };

}

            safeName =
                path.basename(
                    orphanFileName
                );


            if (
                !safeName ||
                !safeName.endsWith('.clv')
            ) {

                return {
                    success: false,
                    message:
                        'Invalid CrypticLocker container.'
                };

            }


            /*
                Inspect the actual container
                header before choosing recovery
                behaviour.
            */

            const orphanPath =
                path.join(
                    getVaultOrphansDirectory(),
                    safeName
                );


            const containerInfo =
                await detectCLVContainerVersion(
                    orphanPath
                );


            let defaultName;

            let containerVersion =
                containerInfo.version;


            /*
                CLV1:

                Original filename does not exist
                inside the legacy container.

                Recover UUID from filename and use
                a safe generic output name.
            */

            if (
                containerVersion === 1
            ) {

                const idMatch =
                    safeName.match(
                        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.clv$/i
                    );


                if (!idMatch) {

                    return {
                        success: false,
                        message:
                            'Unable to recover the CLV1 container ID.'
                    };

                }


                defaultName =
                    `Recovered-${idMatch[1]}.bin`;

            }


            /*
                CLV2:

                Metadata is encrypted inside the
                container.

                Authenticate the complete AES-GCM
                payload and recover the original
                filename before showing Save As.
            */

            else if (
                containerVersion ===
                CLV2_VERSION
            ) {

                const inspection =
                    await inspectCLV2OrphanMetadata(
                        safeName
                    );


                if (
                    !inspection ||
                    inspection.success !== true ||
                    !inspection.originalName
                ) {

                    throw new Error(
                        'Unable to inspect CLV2 recovery metadata.'
                    );

                }


                defaultName =
                    inspection.originalName;

            }


            else {

                return {
                    success: false,
                    message:
                        'Unsupported CrypticLocker container version.'
                };

            }


            /*
                Ask user where the recovered
                file should be written.
            */

            const saveResult =
                await dialog.showSaveDialog(
                    mainWindow,
                    {

                        title:
                            'Recover CrypticLocker File',

                        defaultPath:
                            path.join(
                                app.getPath(
                                    'downloads'
                                ),
                                defaultName
                            ),

                        buttonLabel:
                            'Recover',

                        properties: [
                            'showOverwriteConfirmation'
                        ]

                    }
                );


            if (
                saveResult.canceled ||
                !saveResult.filePath
            ) {

                return {
                    success: false,
                    canceled: true
                };

            }


            /*
    If CrypticLocker was previously terminated
    during recovery, the destination may contain
    an incomplete CrypticLocker temp file.

    Remove it before starting a new recovery.

    The user's final destination file is NEVER
    touched here.
*/

await cleanupStaleRecoveryTempFile(
    saveResult.filePath
);

operationId =
    crypto.randomUUID();


sendVaultProgress(
    event,
    {
        operationId,

        operation:
            'recover',

        itemType:
            'file',

        status:
            'started',

        name:
            defaultName,

        currentFile:
            null,

        processedBytes:
            0,

        totalBytes:
            0,

        completedFiles:
            0,

        totalFiles:
            1,

        speedBytesPerSecond:
            0,

        etaSeconds:
            null,

        containerVersion
    }
);


let lastProgressTime =
    Date.now();


let lastProgressBytes =
    0;


let smoothedSpeed =
    0;


/*
    One progress callback works for
    both CLV1 and CLV2 recovery.
*/

            const handleProgress =
                progress => {

                    if (
                        !progress ||
                        !Number.isFinite(
                            progress.processedBytes
                        ) ||
                        !Number.isFinite(
                            progress.totalBytes
                        )
                    ) {
                        return;
                    }


                    const now =
                        Date.now();


                    const elapsedSeconds =
                        (
                            now -
                            lastProgressTime
                        ) / 1000;


                    if (
                        elapsedSeconds >=
                        0.25
                    ) {

                        const bytesDifference =
                            Math.max(
                                0,
                                progress.processedBytes -
                                lastProgressBytes
                            );


                        const instantSpeed =
                            elapsedSeconds > 0
                                ? bytesDifference /
                                    elapsedSeconds
                                : 0;


                        if (
                            instantSpeed > 0
                        ) {

                            if (
                                smoothedSpeed === 0
                            ) {

                                smoothedSpeed =
                                    instantSpeed;

                            } else {

                                smoothedSpeed =
                                    (
                                        smoothedSpeed *
                                        0.75
                                    ) +
                                    (
                                        instantSpeed *
                                        0.25
                                    );

                            }

                        }


                        lastProgressTime =
                            now;


                        lastProgressBytes =
                            progress.processedBytes;

                    }


                    const totalBytes =
                        Math.max(
                            0,
                            progress.totalBytes
                        );


                    const processedBytes =
                        Math.min(
                            Math.max(
                                0,
                                progress.processedBytes
                            ),
                            totalBytes
                        );


                    const remainingBytes =
                        Math.max(
                            0,
                            totalBytes -
                            processedBytes
                        );


                    const etaSeconds =
                        smoothedSpeed > 0
                            ? remainingBytes /
                                smoothedSpeed
                            : null;


                    sendVaultProgress(
                        event,
                        {

                            operationId,

                            operation:
                                'recover',

                            itemType:
                                'file',

                            status:
                                'progress',

                            name:
                                progress.name ||
                                defaultName,

                            currentFile:
                                progress.name ||
                                defaultName,

                            processedBytes,

                            totalBytes,

                            completedFiles:
    0,

totalFiles:
    1,
    
    speedBytesPerSecond:
                                smoothedSpeed,

                            etaSeconds,

                            containerVersion

                        }
                    );

                };

                /*
    Persist the destination BEFORE recovery
    starts.

    If the application crashes during recovery,
    the next launch can find and remove the
    incomplete plaintext temporary file.
*/

await writeRecoveryJournal(
    saveResult.filePath
);


/*
    IMPORTANT:

    Auto router now chooses:

    CLV1 → recoverOrphanFile()

    CLV2 → recoverCLV2OrphanFile()
*/

const result =
    await recoverQuarantinedOrphanAuto(

        safeName,

        saveResult.filePath,

        handleProgress

    );


            /*
                Send terminal success state.
            */

            /*
    Recovery completed successfully.

    No incomplete recovery remains, therefore
    the crash-recovery journal is no longer
    required.
*/

await clearRecoveryJournal();

sendVaultProgress(
                event,
                {

                    operationId,

                    operation:
                        'recover',

                    itemType:
                        'file',

                    status:
                        'completed',

                    name:
                        result.originalName ||
                        defaultName,

                    currentFile:
                        null,

                    processedBytes:
                        result.metadata &&
                        Number.isSafeInteger(
                            result.metadata.size
                        )
                            ? result.metadata.size
                            : null,

                    totalBytes:
                        result.metadata &&
                        Number.isSafeInteger(
                            result.metadata.size
                        )
                            ? result.metadata.size
                            : null,

                    completedFiles:
    1,

totalFiles:
    1,
    
    speedBytesPerSecond:
                        0,

                    etaSeconds:
                        0,

                    containerVersion

                }
            );


            let removedFromQuarantine = false;
            let removeFromQuarantineError = null;

            if (removeFromQuarantine) {

                try {

                    await deleteQuarantinedOrphan(
                        safeName
                    );

                    removedFromQuarantine = true;

                } catch (error) {

                    console.error(
                        'Unable to remove orphan from quarantine after recovery:',
                        error
                    );

                    removeFromQuarantineError =
                        error.message ||
                        'The file was recovered, but could not be removed from quarantine.';

                }

            }


            return {

                success: true,

                operationId,

                containerVersion,

                originalName:
                    result.originalName ||
                    defaultName,

                destinationPath:
                    result.destinationPath ||
                    saveResult.filePath,

                removedFromQuarantine,

                removeFromQuarantineError

            };


        } catch (error) {

            console.error(
                'Orphan recovery failed:',
                error
            );


            if (operationId) {

                sendVaultOperationFailure(
                    event,
                    {

                        operationId,

                        operation:
                            'recover',

                        itemType:
                            'file',

                        name:
                            safeName,

                        error,

                        fallbackMessage:
                            'Unable to recover the quarantined file.'

                    }
                );

            }


            return {

                success: false,

                errorCode:
                    error.code ||
                    null,

                message:
                    error.message ||
                    'Unable to recover the quarantined file.'

            };

        }

    }
);

/* =========================================
   FORGOT PASSWORD
========================================= */

async function resetPasswordUsingRecoveryKey(
    recoveryKey,
    newPassword
) {

    if (
        typeof recoveryKey !== 'string' ||
        recoveryKey.length === 0
    ) {

        return {

            success: false,

            message:
                'Enter your recovery key.'

        };

    }

    if (

        typeof newPassword !== 'string' ||

        newPassword.length < 8 ||

        !/[A-Z]/.test(newPassword) ||

        !/[a-z]/.test(newPassword) ||

        !/[0-9]/.test(newPassword)

    ) {

        return {

            success: false,

            message:
                'Password does not meet the requirements.'

        };

    }

    const vaultConfigPath =
    getVaultConfigPath();

const raw =
    await fs.readFile(
        vaultConfigPath,
        'utf8'
    );

const vaultConfig =
    JSON.parse(raw);

    let recoveryUnlockKey;

let vaultMasterKey;
let newPasswordUnlockKey;

try {

if (
    !vaultConfig.recovery ||
    !vaultConfig.recovery.salt ||
    !vaultConfig.recovery.vmk
) {

    return {

        success: false,

        message:
            'Recovery information is missing.'

    };

}

const recoverySalt =
    Buffer.from(
        vaultConfig.recovery.salt,
        'base64'
    );

recoveryUnlockKey =
    vaultCrypto.deriveRecoveryKey(
        recoveryKey,
        recoverySalt
    );

    const recoveryIV =
    Buffer.from(
        vaultConfig.recovery.vmk.iv,
        'base64'
    );

const recoveryAuthTag =
    Buffer.from(
        vaultConfig.recovery.vmk.authTag,
        'base64'
    );

const encryptedVaultMasterKey =
    Buffer.from(
        vaultConfig.recovery.vmk.encrypted,
        'base64'
    );

try {

    const recoveryPackage = {

    iv: recoveryIV,

    authTag: recoveryAuthTag,

    encryptedVMK: encryptedVaultMasterKey

};

vaultMasterKey =
    vaultCrypto.decryptVaultMasterKey(
        recoveryPackage,
        recoveryUnlockKey
    );

} catch {

    recoveryUnlockKey.fill(0);

    return {

        success: false,

        message:
            'Invalid recovery key.'

    };

}

/*
    Generate NEW password salt.
*/

const newPasswordSalt =
    crypto.randomBytes(
        CONSTANTS.SCRYPT.SALT_LENGTH
    );

/*
    Derive NEW password key.
*/

newPasswordUnlockKey =
    vaultCrypto.derivePasswordKey(
        newPassword,
        newPasswordSalt
    );

/*
    Encrypt SAME VMK using NEW password.
*/

const newPasswordPackage =
    vaultCrypto.encryptVaultMasterKey(
        vaultMasterKey,
        newPasswordUnlockKey
    );

    /*
    Replace password protection
    with the NEW password.
*/

vaultConfig.password = {

    algorithm: "scrypt",

    salt:
        newPasswordSalt.toString(
            "base64"
        ),

    N: CONSTANTS.SCRYPT.N,

    r: CONSTANTS.SCRYPT.R,

    p: CONSTANTS.SCRYPT.P,

    vmk: {

        iv:
            newPasswordPackage.iv.toString(
                "base64"
            ),

        authTag:
            newPasswordPackage.authTag.toString(
                "base64"
            ),

        encrypted:
            newPasswordPackage.encryptedVMK.toString(
                "base64"
            )

    }

};

await fs.writeFile(

    vaultConfigPath,

    JSON.stringify(
        vaultConfig,
        null,
        2
    ),

    "utf8"

);

setPendingLoginSuccessMessage(
    'Password reset successfully. Log in using your new password.'
);

await resetLockoutState();

return {

    success: true

};

}

finally {

    if (recoveryUnlockKey) {
        recoveryUnlockKey.fill(0);
    }

    if (newPasswordUnlockKey) {
        newPasswordUnlockKey.fill(0);
    }

    if (vaultMasterKey) {
        vaultMasterKey.fill(0);
    }

}
}
    ipcMain.handle(
    'vault:reset-password',
    async (
        event,
        recoveryKey,
        newPassword
    ) => {

        return await resetPasswordUsingRecoveryKey(
            recoveryKey,
            newPassword
        );

    }
);

ipcMain.handle(
    'vault:get-lockout-status',
    async () => {
        try {
            const lockout = await readLockoutState();
            return {
                success: true,
                locked: lockout.isLocked,
                remainingSeconds: lockout.remainingSeconds,
                attempts: lockout.attempts
            };
        } catch (err) {
            console.error('Error getting lockout status:', err);
            return {
                success: false,
                locked: false,
                remainingSeconds: 0,
                attempts: 0
            };
        }
    }
);

ipcMain.handle(
    'vault:unlock',
    async (event, password) => {

        try {

            const lockout = await readLockoutState();
            if (lockout.isLocked) {
                return {
                    success: false,
                    locked: true,
                    remainingSeconds: lockout.remainingSeconds,
                    attemptsCount: lockout.attempts,
                    message: `Too many failed attempts. Please wait ${lockout.remainingSeconds}s before trying again.`
                };
            }

            const unlocked =
                await unlockVault(password);

            if (!unlocked) {
                const failResult = await recordFailedAttempt();
                let message = 'Incorrect master password.';
                if (failResult.isLocked) {
                    message = `Too many failed attempts. Please wait ${failResult.remainingSeconds}s before trying again.`;
                }

                return {
                    success: false,
                    locked: failResult.isLocked,
                    remainingSeconds: failResult.remainingSeconds,
                    attemptsCount: failResult.attempts,
                    message
                };
            }

            // Successfully unlocked: reset lockout state
            await resetLockoutState();


/*
    Vault is now successfully unlocked.

    We can safely decrypt index.clm and
    compare its references with the actual
    encrypted .clv files on disk.
*/

/*
    Before orphan detection, make sure the
    active metadata index is trustworthy.

    If index.clm is damaged or missing while
    encrypted vault data exists, the recovery
    engine will attempt to restore it from the
    authenticated backup.
*/

const indexRecovery =
    await recoverVaultIndexIfNeeded();


const index =
    indexRecovery.index;


console.log(
    'INDEX RECOVERY STATUS:',
    {
        recovered:
            indexRecovery.recovered,

        source:
            indexRecovery.source,

        files:
            index.files.length,

        folders:
            index.folders.length
    }
);

const orphanFiles =
    await detectOrphanVaultFiles(
        index
    );


if (orphanFiles.length > 0) {

    console.warn(
        `CrypticLocker detected ${orphanFiles.length} orphan encrypted file(s).`
    );


    for (const orphan of orphanFiles) {

        console.warn(
            'Orphan:',
            orphan.name,
            '-',
            orphan.size,
            'bytes'
        );

    }

}

if (orphanFiles.length > 0) {

    const quarantined =
        await quarantineOrphanVaultFiles(
            orphanFiles
        );


    if (quarantined.length > 0) {

        console.warn(
            `CrypticLocker quarantined ${quarantined.length} orphan encrypted file(s).`
        );

    }

}

const quarantinedOrphans =
    await scanQuarantinedOrphans();


if (quarantinedOrphans.length > 0) {

    console.warn(
        `CrypticLocker found ${quarantinedOrphans.length} quarantined orphan(s).`
    );


    for (
        const orphan
        of quarantinedOrphans
    ) {

        if (orphan.valid) {

            console.warn(
                'Quarantined orphan:',
                orphan.name,
                '→ POSSIBLE VALID CONTAINER',
                '-',
                orphan.size,
                'bytes'
            );

        } else {

            console.warn(
                'Quarantined orphan:',
                orphan.name,
                '→ INVALID',
                '-',
                orphan.reason
            );

        }

    }

}
    
return {
    success: true
};


        } catch (error) {

            console.error(
                'Vault unlock failed:',
                error
            );


            return {
                success: false,
                message:
                    'Unable to unlock the vault.'
            };

        }

    }
);


ipcMain.handle(
    'vault:integrity-check',
    async () => {

        return await checkVaultIntegrity();

    }
);

ipcMain.handle(
    'vault:change-password',
    async (
        event,
        currentPassword,
        newPassword
    ) => {

        if (!sessionManager.isUnlocked()) {

            return {

                success: false,

                message:
                    'Vault is locked.'

            };

        }

        try {

            return await changeMasterPassword(
                currentPassword,
                newPassword
            );

        } catch (error) {

            console.error(
                'Change password failed:',
                error
            );

            return {

                success: false,

                message:
                    'Unable to change password.'

            };

        }

    }
);

/* =========================================
   VAULT SESSION
========================================= */

ipcMain.handle(
    'vault:session-status',
    async () => {

        return {
    unlocked:
        sessionManager.isUnlocked()
};

    }
);


ipcMain.handle(
    'vault:lock',
    async () => {

        return lockVault();

    }
);

ipcMain.handle(
    'vault:get-files',
    async () => {

        if (!sessionManager.isUnlocked()) {

            return {
                success: false,
                message: 'Vault is locked.'
            };

        }

        try {

            const index =
                await readVaultIndex();

            return {
                success: true,
                files: index.files,
                folders: index.folders
            };

        } catch (error) {

            console.error(
                'Unable to read vault index:',
                error
            );

            return {
                success: false,
                message:
                    'Unable to load vault files.'
            };

        }

    }
);

/* =========================================
   VAULT SETTINGS INFO
========================================= */

ipcMain.handle(
    'vault:get-settings-info',
    async () => {

        if (!sessionManager.isUnlocked()) {

            return {
                success: false,
                message: 'Vault is locked.'
            };

        }

        try {

            const index =
                await readVaultIndex();

            const filesDir =
                getVaultFilesDirectory();

            let storageBytes = 0;

            if (await pathExists(filesDir)) {

                storageBytes +=
                    await getDirectorySize(
                        filesDir
                    );

            }

            const orphansDir =
                getVaultOrphansDirectory();

            if (await pathExists(orphansDir)) {

                storageBytes +=
                    await getDirectorySize(
                        orphansDir
                    );

            }

            // Fallback: if disk scan returns 0 but index has files/folders
            if (storageBytes === 0) {

                if (Array.isArray(index.files) && index.files.length > 0) {
                    for (const f of index.files) {
                        storageBytes += Number(f.size) || 0;
                    }
                }

                if (storageBytes === 0 && Array.isArray(index.folders) && index.folders.length > 0) {
                    for (const fld of index.folders) {
                        storageBytes += Number(fld.totalSize) || 0;
                    }
                }

            }

            return {

                success: true,

                storageLocation:
                    getVaultDirectory(),

                storageBytes,

                fileCount:
                    index.files.length,

                folderCount:
                    index.folders.length,

                appVersion:
                    app.getVersion()

            };

        } catch (error) {

            console.error(
                'Unable to load vault settings information:',
                error
            );

            return {

                success: false,

                message:
                    'Unable to load vault information.'

            };

        }

    }
);

/* =========================================
   OPEN VAULT STORAGE LOCATION
========================================= */

ipcMain.handle(
    'vault:open-storage-location',
    async () => {

        try {

            const vaultDir =
                getVaultDirectory();

            try {
                await fs.mkdir(
                    vaultDir,
                    { recursive: true }
                );
            } catch {
                // Directory exists or created
            }

            const errorMsg =
                await shell.openPath(
                    vaultDir
                );

            if (errorMsg) {

                console.error(
                    'Failed to open vault storage location:',
                    errorMsg
                );

                return {
                    success: false,
                    message: errorMsg
                };

            }

            return {
                success: true
            };

        } catch (error) {

            console.error(
                'Error opening vault storage location:',
                error
            );

            return {
                success: false,
                message:
                    error.message ||
                    'Unable to open storage location.'
            };

        }

    }
);

ipcMain.handle(
    'vault:get-recovery-key',
    async () => {

        if (!sessionManager.isUnlocked()) {

            return {
                success: false,
                message: 'Vault is locked.'
            };

        }

        try {
         
         const config =
    JSON.parse(
        await fs.readFile(
            getVaultConfigPath(),
            'utf8'
        )
    );

const packageData = {

    iv:
        Buffer.from(
            config.recovery.key.iv,
            'base64'
        ),

    authTag:
        Buffer.from(
            config.recovery.key.authTag,
            'base64'
        ),

    encryptedRecoveryKey:
        Buffer.from(
            config.recovery.key.encrypted,
            'base64'
        )

};

const recoveryKey =
    vaultCrypto.decryptRecoveryKey(

        packageData,

        sessionManager.getVaultMasterKey()

    );

return {

    success: true,

    recoveryKey

};

        } catch (error) {

            console.error(
                'Unable to load recovery key:',
                error
            );

            return {

                success: false,

                message:
                    'Unable to load recovery key.'

            };

        }

    }
);

/* =========================================
   DELETE QUARANTINED ORPHAN
========================================= */

ipcMain.handle(
    'vault:delete-quarantined-orphan',
    async (
        event,
        orphanFileName
    ) => {

        if (!sessionManager.isUnlocked())

            {

    return {
        success: false,
        message: 'Vault is locked.'
    };

}

        try {

            return await deleteQuarantinedOrphan(
                orphanFileName
            );


        } catch (error) {

            console.error(
                'Unable to delete quarantined container:',
                error
            );


            return {
                success: false,

                errorCode:
                    typeof error.code === 'string'
                        ? error.code
                        : null,

                message:
                    error.message ||
                    'Unable to delete quarantined container.'
            };

        }

    }
);

/* =========================================
   DELETE ALL INVALID QUARANTINED ORPHANS
========================================= */

ipcMain.handle(
    'vault:delete-all-invalid-quarantined-orphans',
    async () => {

        if (!sessionManager.isUnlocked())

            {

    return {
        success: false,
        message: 'Vault is locked.'
    };

}

        try {

            return await
                deleteAllInvalidQuarantinedOrphans();


        } catch (error) {

            console.error(
                'Unable to delete invalid quarantined containers:',
                error
            );


            return {

                success: false,

                partial: false,

                deletedCount: 0,

                failedCount: 0,

                deleted: [],

                failed: [],

                errorCode:
                    typeof error.code ===
                    'string'
                        ? error.code
                        : null,

                message:
                    error.message ||
                    'Unable to delete invalid quarantined containers.'

            };

        }

    }
);

/* =========================================
   COPY 
========================================= */

const {
    clipboard
} = require('electron');


ipcMain.handle(
    'clipboard:copy',
    async (event, text) => {

        clipboard.writeText(text);

        return {
            success: true
        };

    }
);


/* =========================================
   RESTORE FILE - STREAMING
========================================= */

ipcMain.handle(
    'vault:restore-file',
    async (
        event,
        fileId,
        removeFromVault = false
    ) => {

        if (!sessionManager.isUnlocked()) {
            return {
                success: false,
                message: 'Vault is locked.'
            };
        }

        let operationId = null;
        let operationName = null;

        try {

            /*
                Renderer only supplies an ID.

                Trusted metadata is loaded
                from our encrypted index.
            */

            const index =
                await readVaultIndex();


            const file =
                index.files.find(
                    item =>
                        item.id === fileId
                );


            if (!file) {

                return {
                    success: false,
                    message:
                        'File was not found in the vault.'
                };

            }


            /*
                Older development files may
                not contain SHA-256 metadata.
            */

            if (!file.sha256) {

                return {
                    success: false,
                    message:
                        'This file uses an older vault format and cannot be integrity-verified.'
                };

            }


            const saveResult =
                await dialog.showSaveDialog(
                    mainWindow,
                    {
                        title:
                            'Restore from CrypticLocker',

                        defaultPath:
                            file.name,

                        buttonLabel:
                            'Restore'
                    }
                );


            if (
                saveResult.canceled ||
                !saveResult.filePath
            ) {

                return {
                    success: false,
                    canceled: true
                };

            }


            /*
    Check destination storage BEFORE
    starting decryption.

    Example:
    D:\Restored\movie.mkv
        ↓
    Check free space on D:\Restored
*/

const destinationDirectory =
    path.dirname(
        saveResult.filePath
    );


const storageCheck =
    await ensureStorageAvailable(
        destinationDirectory,
        file.size
    );


if (!storageCheck.enough) {

    return {

        success: false,

        errorCode:
            'INSUFFICIENT_STORAGE',

        message:
            'Not enough storage space.',

        requiredBytes:
            storageCheck.requiredWithBuffer,

        fileSize:
            file.size,

        availableBytes:
            storageCheck.availableBytes

    };

}


            operationName =
    file.name;

operationId =
    crypto.randomUUID();


let lastProgressTime =
    Date.now();

let lastProgressBytes =
    0;

let smoothedSpeed =
    0;


sendVaultProgress(
    event,
    {

        operationId,

        operation:
            'restore',

        itemType:
            'file',

        status:
            'started',

        name:
            file.name,

        currentFile:
            file.name,

        processedBytes:
            0,

        totalBytes:
            file.size,

        completedFiles:
            0,

        totalFiles:
            1,

        speedBytesPerSecond:
            0,

        etaSeconds:
            null

    }
);


const restored =
    await restoreVaultFileAuto(
        file,
        saveResult.filePath,

        operationId,

        progress => {

        const now =
            Date.now();


        const elapsedSeconds =
            (
                now -
                lastProgressTime
            ) / 1000;


        if (
            elapsedSeconds >= 0.25
        ) {

            const bytesDifference =
                progress.processedBytes -
                lastProgressBytes;


            const instantSpeed =
                bytesDifference /
                elapsedSeconds;


            if (
                smoothedSpeed === 0
            ) {

                smoothedSpeed =
                    instantSpeed;

            } else {

                smoothedSpeed =
                    (
                        smoothedSpeed * 0.7
                    ) +
                    (
                        instantSpeed * 0.3
                    );

            }


            lastProgressTime =
                now;

            lastProgressBytes =
                progress.processedBytes;

        }


        const remainingBytes =
            Math.max(
                0,
                progress.totalBytes -
                progress.processedBytes
            );


        const etaSeconds =
            smoothedSpeed > 0
                ? remainingBytes /
                    smoothedSpeed
                : null;


        sendVaultProgress(
    event,
    {
        operationId,

        operation:
            'restore',

        itemType:
            'file',

        status:
            'progress',

        name:
            file.name,

        currentFile:
            file.name,

        processedBytes:
            progress.processedBytes,

        totalBytes:
            progress.totalBytes,

        completedFiles:
            0,

        totalFiles:
            1,

        speedBytesPerSecond:
            smoothedSpeed,

        etaSeconds
    }
);

        }
    );


console.log(
    `Normal restore completed using CLV${restored.containerVersion}.`
);


/*
    restoreVaultFileStream() returns only
    after authentication, hash and size
    verification have succeeded.
*/

sendVaultProgress(
    event,
    {

        operationId,

        operation:
            'restore',

        itemType:
            'file',

        status:
            'completed',

        name:
            file.name,

        currentFile:
            null,

        processedBytes:
            file.size,

        totalBytes:
            file.size,

        completedFiles:
            1,

        totalFiles:
            1,

        speedBytesPerSecond:
            0,

        etaSeconds:
            0

    }
);


            let removedFromVault = false;
            let removeFromVaultError = null;

            if (removeFromVault) {

                try {

                    await deleteVaultFile(
                        file.id
                    );

                    removedFromVault = true;

                } catch (error) {

                    console.error(
                        'Unable to remove file from vault after restore:',
                        error
                    );

                    removeFromVaultError =
                        error.message ||
                        'The file was restored, but could not be removed from the vault.';

                }

            }


            return {
                success: true,
                name: file.name,
                removedFromVault,
                removeFromVaultError
            };


                } catch (error) {

            console.error(
                'Streaming restore failed:',
                error
            );


            /*
                Only send a terminal failure event
                if the actual restore operation
                had already started.

                Errors before operationId creation
                are still returned normally.
            */

            if (operationId) {

                sendVaultOperationFailure(
                    event,
                    {
                        operationId,

                        operation:
                            'restore',

                        itemType:
                            'file',

                        name:
                            operationName,

                        error,

                        fallbackMessage:
                            'Unable to restore file.'
                    }
                );

            }

            const isCancelled =
                error.code === 'OPERATION_CANCELLED' ||
                (operationId && isVaultOperationCancelled(operationId));

            return {
                success: false,
                canceled: isCancelled,
                operationFailed: Boolean(operationId),
                errorCode:
                    typeof error.code === 'string'
                        ? error.code
                        : (isCancelled ? 'OPERATION_CANCELLED' : 'OPERATION_FAILED'),
                message:
                    error.message ||
                    'Unable to restore file.'
            };

        }

    }
);

/* =========================================
   RESTORE FOLDER
========================================= */

ipcMain.handle(
    'vault:restore-folder',
    async (
        event,
        folderId,
        removeFromVault = false
    ) => {

                let operationId = null;
        let operationName = null;
        
        if (!sessionManager.isUnlocked())

            {

    return {
        success: false,
        message: 'Vault is locked.'
    };

}


        try {

            /*
                Renderer supplies only ID.

                Folder metadata is always loaded
                from trusted encrypted index.
            */

            const index =
                await readVaultIndex();


            const folder =
                index.folders.find(
                    item =>
                        item.id ===
                        folderId
                );


            if (!folder) {

                return {
                    success: false,
                    message:
                        'Folder was not found in the vault.'
                };

            }


            /*
                User selects only the parent
                destination directory.
            */

            const result =
                await dialog.showOpenDialog(
                    mainWindow,
                    {
                        title:
                            `Restore ${folder.name}`,

                        buttonLabel:
                            'Restore Here',

                        properties: [
                            'openDirectory',
                            'createDirectory'
                        ]
                    }
                );


            /*
    User cancelled destination selection.

    No restore operation has started yet,
    therefore no terminal failure event
    should be sent.
*/

if (
    result.canceled ||
    result.filePaths.length === 0
) {

    return {
        success: false,
        canceled: true
    };

}

/*
    Check destination storage BEFORE
    creating/restoring the folder.
*/

const destinationParent =
    result.filePaths[0];


const folderFiles =
    index.files.filter(
        file =>
            file.parentFolderId ===
            folder.id
    );


const requiredFolderBytes =
    folderFiles.reduce(
        (total, file) =>
            total +
            (
                typeof file.size === 'number'
                    ? file.size
                    : 0
            ),
        0
    );


const storageCheck =
    await ensureStorageAvailable(
        destinationParent,
        requiredFolderBytes
    );


if (!storageCheck.enough) {

    return {

        success: false,

        errorCode:
            'INSUFFICIENT_STORAGE',

        message:
            'Not enough storage space.',

        requiredBytes:
            storageCheck.requiredWithBuffer,

        folderSize:
            requiredFolderBytes,

        availableBytes:
            storageCheck.availableBytes

    };

}


           operationName =
    folder.name;

operationId =
    crypto.randomUUID();


let lastProgressTime =
    Date.now();

let lastProgressBytes =
    0;

let smoothedSpeed =
    0;


/*
    Folder restore is starting.

    Total bytes/files will become available
    when restoreVaultFolder begins processing.
*/

sendVaultProgress(
    event,
    {

        operationId,

        operation:
            'restore',

        itemType:
            'folder',

        status:
            'started',

        name:
            folder.name,

        currentFile:
            null,

        processedBytes:
            0,

        totalBytes:
            folder.totalSize || 0,

        completedFiles:
            0,

        totalFiles:
            folder.fileCount || 0,

        speedBytesPerSecond:
            0,

        etaSeconds:
            null

    }
);


const restored =
    await restoreVaultFolder(
        folder,
        index,
        result.filePaths[0],

        progress => {

            const now =
                Date.now();


            /*
                Calculate actual restore speed.
            */

            if (
                progress.status ===
                'progress'
            ) {

                const elapsedSeconds =
                    (
                        now -
                        lastProgressTime
                    ) / 1000;


                if (
                    elapsedSeconds >= 0.25
                ) {

                    const bytesDifference =
                        progress.processedBytes -
                        lastProgressBytes;


                    const instantSpeed =
                        bytesDifference /
                        elapsedSeconds;


                    if (
                        smoothedSpeed === 0
                    ) {

                        smoothedSpeed =
                            instantSpeed;

                    } else {

                        smoothedSpeed =
                            (
                                smoothedSpeed *
                                0.7
                            ) +
                            (
                                instantSpeed *
                                0.3
                            );

                    }


                    lastProgressTime =
                        now;

                    lastProgressBytes =
                        progress.processedBytes;

                }

            }


            const remainingBytes =
                Math.max(
                    0,
                    progress.totalBytes -
                    progress.processedBytes
                );


            const etaSeconds =
                smoothedSpeed > 0
                    ? remainingBytes /
                        smoothedSpeed
                    : null;


            sendVaultProgress(
                event,
                {

                    operationId,

                    operation:
                        'restore',

                    itemType:
                        'folder',

                    status:
                        progress.status,

                    name:
                        progress.name,

                    currentFile:
                        progress.currentFile,

                    processedBytes:
                        progress.processedBytes,

                    totalBytes:
                        progress.totalBytes,

                    completedFiles:
                        progress.completedFiles,

                    totalFiles:
                        progress.totalFiles,

                    speedBytesPerSecond:
                        smoothedSpeed,

                    etaSeconds

                }
            );

        },
        operationId
    );


/*
    We reach this point only after every file
    has been decrypted and integrity verified.
*/

sendVaultProgress(
    event,
    {

        operationId,

        operation:
            'restore',

        itemType:
            'folder',

        status:
            'completed',

        name:
            restored.name,

        currentFile:
            null,

        processedBytes:
            folder.totalSize || 0,

        totalBytes:
            folder.totalSize || 0,

        completedFiles:
            restored.fileCount,

        totalFiles:
            restored.fileCount,

        speedBytesPerSecond:
            0,

        etaSeconds:
            0

    }
);


            let removedFromVault = false;
            let removeFromVaultError = null;

            if (removeFromVault) {

                try {

                    await deleteVaultFolder(
                        folder.id
                    );

                    removedFromVault = true;

                } catch (error) {

                    console.error(
                        'Unable to remove folder from vault after restore:',
                        error
                    );

                    removeFromVaultError =
                        error.message ||
                        'The folder was restored, but could not be removed from the vault.';

                }

            }


            return {
                ...restored,
                removedFromVault,
                removeFromVaultError
            };


                } catch (error) {

            console.error(
                'Folder restore failed:',
                error
            );


            /*
                Send terminal failure only if
                the actual folder restore operation
                had already started.
            */

            if (operationId) {

                sendVaultOperationFailure(
                    event,
                    {
                        operationId,

                        operation:
                            'restore',

                        itemType:
                            'folder',

                        name:
                            operationName,

                        error,

                        fallbackMessage:
                            'Unable to restore folder.'
                    }
                );

            }


            const isCancelled =
                error.code === 'OPERATION_CANCELLED' ||
                (operationId && isVaultOperationCancelled(operationId));

            return {
                success: false,
                canceled: isCancelled,
                operationFailed: Boolean(operationId),
                errorCode:
                    typeof error.code === 'string'
                        ? error.code
                        : (isCancelled ? 'OPERATION_CANCELLED' : 'OPERATION_FAILED'),
                message:
                    error.message ||
                    'Unable to restore folder.'
            };

        }

    }
);

/* =========================================
   APP
========================================= */

app.whenReady().then(
    async () => {

        /*
            Remove encrypted temporary files
            left behind by an interrupted
            previous CrypticLocker session.
        */

        await cleanupStaleVaultTempFiles();
        await synchronizeApplicationSettings();

/*
    Recover from an application/process crash
    that happened during orphan recovery.

    This runs before the UI opens so an
    incomplete plaintext recovery file is not
    left behind unnoticed.
*/

try {

    await cleanupRecoveryJournalOnStartup();

} catch (error) {

    /*
        Do not delete the journal when cleanup
        fails.

        Keeping it allows CrypticLocker to try
        again on the next launch instead of
        forgetting about an incomplete recovery.
    */

    console.error(
        'Startup recovery cleanup failed:',
        error
    );

}


createWindow();

        /*
    Electron emits "suspend" when the
    operating system is entering sleep.

    powerMonitor can only be used after
    Electron's app is ready.
*/

powerMonitor.on(
    'suspend',
    () => {

        void lockVaultForSystemSleep();

    }
);

powerMonitor.on(
    'lock-screen',
    () => {

        void lockVaultForSystemSleep();

    }
);

powerMonitor.on(
    'resume',
    () => {

        void lockVaultForSystemSleep();

    }
);

app.on(
            'activate',
            () => {

                if (
                    BrowserWindow
                        .getAllWindows()
                        .length === 0
                ) {

                    createWindow();

                }

            }
        );

    }
);


app.on(
    'window-all-closed',
    () => {

        clearVaultSession();


        if (
            process.platform !== 'darwin'
        ) {

            app.quit();

        }

    }
);


app.on(
    'before-quit',
    () => {

        clearVaultSession();

    }
);