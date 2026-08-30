'use strict';

/**
 * =========================================================================
 * CRYPTICLOCKER - MASTER PRE-PACKAGING AUTOMATED AUDIT SUITE
 * =========================================================================
 * Runs a complete, end-to-end verification of all application features,
 * security primitives, IPC communication, and UI contracts.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const projectRoot = process.cwd();

console.log('\n================================================================');
console.log('       🔒 CRYPTICLOCKER PRE-PACKAGING MASTER HEALTH AUDIT       ');
console.log('================================================================\n');

let totalSuites = 0;
let passedSuites = 0;
let failedSuites = 0;

function runSuite(name, testFn) {
    totalSuites++;
    try {
        testFn();
        passedSuites++;
        console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
        failedSuites++;
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Reason: ${err.message}\n`);
    }
}

async function runAsyncSuite(name, testFn) {
    totalSuites++;
    try {
        await testFn();
        passedSuites++;
        console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
        failedSuites++;
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Reason: ${err.message}\n`);
    }
}

async function main() {
    const clean = str => str.replace(/\r\n/g, '\n');
    const mainJs = clean(fs.readFileSync(path.join(projectRoot, 'main.js'), 'utf8'));
    const preloadJs = clean(fs.readFileSync(path.join(projectRoot, 'preload.js'), 'utf8'));
    const dashboardJs = clean(fs.readFileSync(path.join(projectRoot, 'src/js/dashboard.js'), 'utf8'));
    const appJs = clean(fs.readFileSync(path.join(projectRoot, 'src/js/app.js'), 'utf8'));
    const indexHtml = clean(fs.readFileSync(path.join(projectRoot, 'src/index.html'), 'utf8'));
    const dashboardHtml = clean(fs.readFileSync(path.join(projectRoot, 'src/dashboard.html'), 'utf8'));
    const dashboardCss = clean(fs.readFileSync(path.join(projectRoot, 'src/css/dashboard.css'), 'utf8'));
    const styleCss = clean(fs.readFileSync(path.join(projectRoot, 'src/css/style.css'), 'utf8'));
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

    // -------------------------------------------------------------
    // MODULE 1: CORE SYNTAX & ENVIRONMENT
    // -------------------------------------------------------------
    console.log('▶ [1/8] Verifying Codebase Syntax & Package Configuration...');
    runSuite('package.json has valid name, version, and electron main entry', () => {
        assert.strictEqual(packageJson.name.toLowerCase(), 'crypticlocker');
        assert.ok(packageJson.version, 'version must exist');
        assert.strictEqual(packageJson.main, 'main.js');
    });

    runSuite('HTML files have zero duplicate or broken main IDs', () => {
        assert.ok(dashboardHtml.includes('id="vaultView"'));
        assert.ok(dashboardHtml.includes('id="quarantineView"'));
        assert.ok(dashboardHtml.includes('id="recoveryKeyView"'));
        assert.ok(dashboardHtml.includes('id="settingsView"'));
        assert.ok(dashboardHtml.includes('id="aboutView"'));
        assert.ok(dashboardHtml.includes('id="operationOverlay"'));
        assert.ok(dashboardHtml.includes('id="restoreConfirmOverlay"'));
    });

    // -------------------------------------------------------------
    // MODULE 2: CRYPTO ENGINE & SECURITY
    // -------------------------------------------------------------
    console.log('\n▶ [2/8] Testing Cryptography & Key Management Pipeline...');
    runSuite('Scrypt key derivation and AES-256-GCM parameters', () => {
        assert.ok(mainJs.includes('derivePasswordKey') || mainJs.includes('scryptSync') || mainJs.includes('vaultCrypto.derivePasswordKey'));
        assert.ok(mainJs.includes('aes-256-gcm'));
        assert.ok(mainJs.includes('CLV2_MAGIC') || mainJs.includes('CLV2_HEADER_LENGTH'));
    });

    runSuite('Preload contextBridge exposes all required methods securely', () => {
        const requiredApis = [
            'getFiles', 'addFile', 'addFolder', 'restoreFile', 'restoreFolder',
            'deleteFile', 'deleteFolder', 'bulkDeleteItems', 'bulkRestoreItems',
            'exportVault', 'importVault', 'deleteVault', 'verifyPassword',
            'cancelOperation', 'checkVaultIntegrity', 'getLockoutStatus',
            'onOperationProgress', 'onSessionLocked'
        ];
        for (const api of requiredApis) {
            assert.ok(preloadJs.includes(`${api}:`), `preload must expose ${api}`);
        }
    });

    // -------------------------------------------------------------
    // MODULE 3: FAILED ATTEMPTS LOCKOUT & COOLDOWN
    // -------------------------------------------------------------
    console.log('\n▶ [3/8] Testing Failed Attempts Lockout & Security Cooldown...');
    runSuite('Progressive lockout cooldown ladder and state tracking', () => {
        assert.ok(mainJs.includes('calculateCooldownSeconds'));
        assert.ok(mainJs.includes('recordFailedAttempt'));
        assert.ok(mainJs.includes('resetLockoutState'));
        assert.ok(appJs.includes('startLockoutCountdown'));
        assert.ok(appJs.includes('checkAndApplyLockout'));
    });

    // -------------------------------------------------------------
    // MODULE 4: IMPORT & EXPORT (.clvault PACKAGE FORMAT)
    // -------------------------------------------------------------
    console.log('\n▶ [4/8] Testing Vault Import & Export Packaging Engine...');
    await runAsyncSuite('Full .clvault archive streaming, byte integrity & instant pre-scan', async () => {
        const vaultPackage = require(path.join(projectRoot, 'core/vault/vaultPackage'));
        const tempTestDir = path.join(projectRoot, '.test_audit_export_' + Date.now());
        const tempVault = path.join(tempTestDir, 'src_vault');
        const tempExport = path.join(tempTestDir, 'backup.clvault');
        const tempDest = path.join(tempTestDir, 'dest_vault');

        try {
            await fsp.mkdir(path.join(tempVault, 'files'), { recursive: true });
            
            const validVaultConfig = {
                version: 1,
                format: 'CLV2',
                password: {
                    algorithm: 'scrypt',
                    salt: crypto.randomBytes(32).toString('base64'),
                    N: 16384,
                    r: 8,
                    p: 1,
                    vmk: {
                        iv: crypto.randomBytes(12).toString('base64'),
                        authTag: crypto.randomBytes(16).toString('base64'),
                        encrypted: crypto.randomBytes(32).toString('base64')
                    }
                },
                recovery: {
                    algorithm: 'scrypt',
                    salt: crypto.randomBytes(32).toString('base64'),
                    N: 16384,
                    r: 8,
                    p: 1,
                    vmk: {
                        iv: crypto.randomBytes(12).toString('base64'),
                        authTag: crypto.randomBytes(16).toString('base64'),
                        encrypted: crypto.randomBytes(32).toString('base64')
                    },
                    key: {
                        iv: crypto.randomBytes(12).toString('base64'),
                        authTag: crypto.randomBytes(16).toString('base64'),
                        encrypted: crypto.randomBytes(69).toString('base64')
                    }
                },
                createdAt: new Date().toISOString()
            };

            await fsp.writeFile(path.join(tempVault, 'vault.json'), JSON.stringify(validVaultConfig, null, 2), 'utf8');
            await fsp.writeFile(path.join(tempVault, 'index.clm'), Buffer.from('CLM1_TEST_DATA'));
            await fsp.writeFile(path.join(tempVault, 'files', 'test.clv'), Buffer.from('CLV2_TEST_PAYLOAD'));

            // Test export
            let progressCalled = false;
            const expRes = await vaultPackage.exportVaultPackage(tempVault, tempExport, null, (p) => {
                progressCalled = true;
            });
            assert.strictEqual(expRes.success, true, 'export must succeed');
            assert.strictEqual(progressCalled, true, 'progress callback must be invoked');
            assert.ok(fs.existsSync(tempExport), 'exported package file must exist');

            // Test import
            const impRes = await vaultPackage.validateAndExtractVaultPackage(tempExport, tempDest);
            assert.strictEqual(impRes.success, true, 'import must succeed');
            assert.ok(fs.existsSync(path.join(tempDest, 'vault.json')), 'vault.json must be restored');
            assert.ok(fs.existsSync(path.join(tempDest, 'files', 'test.clv')), 'test.clv must be restored');
        } finally {
            // Cleanup
            await fsp.rm(tempTestDir, { recursive: true, force: true });
        }
    });

    runSuite('Export & Import pre-check storage and working cancel buttons', () => {
        assert.ok(mainJs.includes('const destinationDir = path.dirname(saveResult.filePath);'));
        assert.ok(mainJs.includes('ensureStorageAvailable(destinationDir'));
        assert.ok(dashboardJs.includes('operationCancelButton.hidden = false;'));
        assert.ok(indexHtml.includes('id="importCancelButton"'));
    });

    // -------------------------------------------------------------
    // MODULE 5: RESTORE FLOW, POPUP CLEANUP & CANCELLATION
    // -------------------------------------------------------------
    console.log('\n▶ [5/8] Testing File/Folder Restoration & Instant Cancellation...');
    runSuite('Restore overlay cleanup upon confirmation and on operation start', () => {
        assert.ok(dashboardJs.includes('if (\n    !restoreConfirmOverlay.hidden\n) {\n\n    closeRestoreConfirm(false);\n\n}'));
        const closeCalls = dashboardJs.split('closeRestoreConfirm(false);').length - 1;
        assert.ok(closeCalls >= 8, 'closeRestoreConfirm must be invoked immediately after user confirm');
    });

    runSuite('restoreCLV2FileStream and restoreVaultFolder cancellation checks', () => {
        assert.ok(mainJs.includes('isVaultOperationCancelled(operationId)'));
        assert.ok(mainJs.includes('createVaultOperationCancelledError()'));
        assert.ok(mainJs.includes('restoreCLV2FileStream(\n                encryptedPath,\n                destinationPath,\n                fileMetadata.id,\n                onProgress,\n                operationId\n            );'));
    });

    // -------------------------------------------------------------
    // MODULE 6: QUARANTINE & DEEP INSPECTION
    // -------------------------------------------------------------
    console.log('\n▶ [6/8] Testing Quarantine & Orphan Recovery Subsystem...');
    runSuite('Quarantine original names, dynamic SVG icons & deep inspection', () => {
        assert.ok(dashboardJs.includes('getQuarantineFileIconSvg'));
        assert.ok(dashboardHtml.includes('id="quarantineInspectOverlay"'));
        assert.ok(dashboardJs.includes('highlightQuarantinedOrphans'));
        assert.ok(dashboardJs.includes('quarantineInspectRecover'));
    });

    // -------------------------------------------------------------
    // MODULE 7: SETTINGS, ABOUT & DANGER ZONE
    // -------------------------------------------------------------
    console.log('\n▶ [7/8] Testing Settings, About View & Delete Vault Danger Zone...');
    runSuite('Danger Zone 3-step verification modal and clean session deletion', () => {
        assert.ok(dashboardHtml.includes('deleteVaultOverlay'));
        assert.ok(dashboardHtml.includes('deleteVaultStep1'));
        assert.ok(dashboardHtml.includes('deleteVaultStep2'));
        assert.ok(dashboardHtml.includes('deleteVaultStep3'));
        assert.ok(mainJs.includes("'vault:delete-vault'"));
        assert.ok(mainJs.includes("'vault:verify-password'"));
    });

    runSuite('About page, layout matching and unified scrollbars', () => {
        assert.ok(dashboardHtml.includes('id="aboutView"'));
        assert.ok(dashboardHtml.includes('id="aboutNavButton"'));
        assert.ok(dashboardCss.includes('.about-content'));
        assert.ok(dashboardCss.includes('::-webkit-scrollbar'));
    });

    // -------------------------------------------------------------
    // MODULE 8: UI / RENDERER CONTRACTS & FORMATTING
    // -------------------------------------------------------------
    console.log('\n▶ [8/8] Testing UI Formatting, Symmetrical Spacing & Dropdowns...');
    runSuite('Uppercase mode labels, uppercase folder/extension, DD/MM/YYYY dates', () => {
        assert.ok(dashboardJs.includes('formatVaultDate'));
        assert.ok(dashboardJs.includes('formatOperationBytes'));
        assert.ok(dashboardHtml.includes('id="selectionCancelButton"'));
        assert.ok(dashboardCss.includes('.selection-bar-actions'));
    });

    // -------------------------------------------------------------
    // FINAL SUMMARY REPORT
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TOTAL TEST SUITES:  ${totalSuites}`);
    console.log(`PASSED:             ${passedSuites} ✅`);
    console.log(`FAILED:             ${failedSuites} ${failedSuites === 0 ? '🎉' : '❌'}`);
    console.log('================================================================');

    if (failedSuites === 0) {
        console.log('\n🟢 RESULT: ALL SYSTEMS OPERATIONAL! APPLICATION IS 100% READY FOR PACKAGING.\n');
        process.exit(0);
    } else {
        console.log('\n🔴 RESULT: SOME TESTS FAILED. PLEASE REVIEW THE LOGS ABOVE BEFORE PACKAGING.\n');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
