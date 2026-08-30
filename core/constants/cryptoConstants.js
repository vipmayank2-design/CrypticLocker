'use strict';

/**
 * ============================================================
 * CrypticLocker Crypto Constants
 * ============================================================
 * Central place for all cryptographic configuration.
 * No magic numbers should exist anywhere else in the project.
 * ============================================================
 */

const CRYPTO_CONSTANTS = Object.freeze({

    // ========================================================
    // Vault
    // ========================================================

    VAULT_VERSION: 1,
    VAULT_FORMAT: 'CLV2',

    // ========================================================
    // AES-256-GCM
    // ========================================================

    AES: Object.freeze({

        ALGORITHM: 'aes-256-gcm',

        KEY_LENGTH: 32,          // 256-bit

        IV_LENGTH: 12,           // Recommended for GCM

        AUTH_TAG_LENGTH: 16      // 128-bit authentication tag

    }),

    // ========================================================
    // Scrypt
    // ========================================================

    SCRYPT: Object.freeze({

        KEY_LENGTH: 32,

        SALT_LENGTH: 32,

        N: 16384,

        R: 8,

        P: 1,

        MAX_MEMORY: 64 * 1024 * 1024

    }),

    // ========================================================
    // Vault Master Key (VMK)
    // ========================================================

    MASTER_KEY: Object.freeze({

        LENGTH: 32

    }),

    // ========================================================
    // Recovery Key
    // ========================================================

    RECOVERY: Object.freeze({

    BYTE_LENGTH: 32,

    GROUP_SIZE: 4,

    SEPARATOR: '-',

    ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',

    PREFIX: 'CKRV'

}),

    // ========================================================
    // Metadata
    // ========================================================

    METADATA: Object.freeze({

        VERSION: 1

    }),

    // ========================================================
    // Encodings
    // ========================================================

    ENCODING: Object.freeze({

        UTF8: 'utf8',

        HEX: 'hex',

        BASE64: 'base64'

    })

});

module.exports = CRYPTO_CONSTANTS;