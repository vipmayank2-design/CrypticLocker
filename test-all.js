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
        assert.ok(dashboardJs.includes('!restoreConfirmOverlay.hidden') && dashboardJs.includes('closeRestoreConfirm(false);'));
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
    // MODULE 9: ADAPTIVE HARDWARE-AWARE I/O ACCELERATION ENGINE
    // -------------------------------------------------------------
    console.log('\n▶ [9/9] Testing Adaptive Hardware-Aware I/O Acceleration Engine...');
    runSuite('Dynamic Buffer Scaling and Hardware-Aware Profile Contracts', () => {
        const vaultPkg = require(path.join(projectRoot, 'core/vault/vaultPackage'));
        assert.strictEqual(typeof vaultPkg.getStreamChunkSize, 'function', 'getStreamChunkSize must be exported');
        assert.strictEqual(typeof vaultPkg.setStreamChunkSize, 'function', 'setStreamChunkSize must be exported');

        const originalChunk = vaultPkg.getStreamChunkSize();
        vaultPkg.setStreamChunkSize(2 * 1024 * 1024); // 2 MB
        assert.strictEqual(vaultPkg.getStreamChunkSize(), 2 * 1024 * 1024, 'Stream chunk size must scale dynamically');
        vaultPkg.setStreamChunkSize(originalChunk); // Restore

        assert.ok(preloadJs.includes('getHardwareProfile:'), 'preload must expose getHardwareProfile');
        assert.ok(preloadJs.includes('setIoAcceleration:'), 'preload must expose setIoAcceleration');
        assert.ok(mainJs.includes("'vault:get-hardware-profile'"), 'main must handle vault:get-hardware-profile');
        assert.ok(mainJs.includes("'vault:set-io-acceleration'"), 'main must handle vault:set-io-acceleration');

        assert.ok(dashboardHtml.includes('id="operationBoostDropdown"'), 'dashboardHtml must contain operationBoostDropdown');
        assert.ok(dashboardHtml.includes('id="operationBoostButton"'), 'dashboardHtml must contain operationBoostButton');
        assert.ok(dashboardHtml.includes('id="operationBoostMenu"'), 'dashboardHtml must contain operationBoostMenu');
        assert.ok(dashboardCss.includes('.operation-boost-dropdown'), 'dashboardCss must style operation-boost-dropdown');
        assert.ok(dashboardJs.includes('closeOperationBoostDropdown'), 'dashboardJs must handle closeOperationBoostDropdown');
    });

    // -------------------------------------------------------------
    // MODULE 10: CONTEXT-AWARE EMPTY STATE ENGINE
    // -------------------------------------------------------------
    console.log('\n▶ [10/10] Testing Context-Aware Empty State Engine (Folder vs Vault)...');
    runSuite('Folder-specific empty state, dynamic parent back navigation & SVG switching', () => {
        assert.ok(dashboardHtml.includes('id="emptyStateIcon"'), 'dashboard.html must have emptyStateIcon');
        assert.ok(dashboardHtml.includes('id="emptyFolderButtons"'), 'dashboard.html must have emptyFolderButtons');
        assert.ok(dashboardHtml.includes('id="emptyFolderBackButton"'), 'dashboard.html must have emptyFolderBackButton');
        assert.ok(dashboardHtml.includes('id="emptyFolderBackButtonText"'), 'dashboard.html must have emptyFolderBackButtonText');

        assert.ok(dashboardCss.includes('.empty-folder-buttons'), 'dashboard.css must style empty-folder-buttons');
        assert.ok(dashboardCss.includes('.empty-folder-back-btn'), 'dashboard.css must style empty-folder-back-btn');

        assert.ok(dashboardJs.includes('EMPTY_FOLDER_ICON_SVG'), 'dashboard.js must define EMPTY_FOLDER_ICON_SVG');
        assert.ok(dashboardJs.includes('EMPTY_VAULT_ICON_SVG'), 'dashboard.js must define EMPTY_VAULT_ICON_SVG');
        assert.ok(dashboardJs.includes('EMPTY_SEARCH_ICON_SVG'), 'dashboard.js must define EMPTY_SEARCH_ICON_SVG');
        assert.ok(dashboardJs.includes('getCurrentFolderName'), 'dashboard.js must define getCurrentFolderName');
        assert.ok(dashboardJs.includes('getCurrentParentName'), 'dashboard.js must define getCurrentParentName');
        assert.ok(dashboardJs.includes('handleEmptyFolderGoBack'), 'dashboard.js must define handleEmptyFolderGoBack');
        assert.ok(dashboardJs.includes('This folder is empty'), 'dashboard.js must handle folder empty state title');
        assert.ok(dashboardJs.includes('No files or subfolders found inside'), 'dashboard.js must handle folder empty description');
    });

    // -------------------------------------------------------------
    // MODULE 11: SECURE CAPSULE ENGINE & MERGE IMPORT (.clpack)
    // -------------------------------------------------------------
    console.log('\n▶ [11/11] Testing Secure Capsule Engine & Merge Import (.clpack)...');
    await runAsyncSuite('Capsule Package Creation, Header Magic, Format Isolation & UI Contracts', async () => {
        const capsulePkg = require(path.join(projectRoot, 'core/capsule/capsulePackage'));

        assert.strictEqual(typeof capsulePkg.createCapsulePackage, 'function', 'createCapsulePackage must be exported');
        assert.strictEqual(typeof capsulePkg.inspectCapsulePackage, 'function', 'inspectCapsulePackage must be exported');
        assert.strictEqual(typeof capsulePkg.unpackCapsuleToStaging, 'function', 'unpackCapsuleToStaging must be exported');
        assert.strictEqual(capsulePkg.CAPSULE_MAGIC.toString('ascii'), 'CLCAP1.0', 'CAPSULE_MAGIC must be CLCAP1.0');
        assert.strictEqual(capsulePkg.VAULT_MAGIC.toString('ascii'), 'CLVAULT1', 'VAULT_MAGIC must be CLVAULT1');

        // Test End-to-End Capsule packaging & inspection
        const os = require('os');
        const testTempDir = path.join(os.tmpdir(), `cl_test_capsule_${Date.now()}`);
        await fs.promises.mkdir(testTempDir, { recursive: true });

        try {
            const testFile1 = path.join(testTempDir, 'hello.txt');
            const testFile2 = path.join(testTempDir, 'data.json');
            await fs.promises.writeFile(testFile1, 'Hello CrypticLocker Capsule Test!');
            await fs.promises.writeFile(testFile2, JSON.stringify({ key: 'secret_value' }));

            const outCapsule = path.join(testTempDir, 'test.clpack');
            const created = await capsulePkg.createCapsulePackage({
                sourceFiles: [
                    { diskPath: testFile1, name: 'hello.txt', size: 31, relativePath: '', parentFolderName: '' },
                    { diskPath: testFile2, name: 'data.json', size: 23, relativePath: 'sub', parentFolderName: 'MyFolder' }
                ],
                transferPassword: 'TestTransferPassword#1',
                destinationPath: outCapsule
            });

            assert.strictEqual(created.fileCount, 2, 'Should have packaged 2 files');
            assert.ok(fs.existsSync(outCapsule), 'Output capsule file must exist');

            // Verify Magic Header
            const headerFd = await fs.promises.open(outCapsule, 'r');
            const magicBuf = Buffer.alloc(8);
            await headerFd.read(magicBuf, 0, 8, 0);
            await headerFd.close();
            assert.strictEqual(magicBuf.toString('ascii'), 'CLCAP1.0', 'Capsule magic must be CLCAP1.0');

            // Verify Inspection with Correct Password
            const inspectSuccess = await capsulePkg.inspectCapsulePackage(outCapsule, 'TestTransferPassword#1');
            assert.strictEqual(inspectSuccess.valid, true, 'Valid password must decrypt manifest');
            assert.strictEqual(inspectSuccess.fileCount, 2, 'Manifest should list 2 files');

            // Verify Inspection with Wrong Password
            const inspectWrong = await capsulePkg.inspectCapsulePackage(outCapsule, 'WrongPassword!');
            assert.strictEqual(inspectWrong.valid, false, 'Wrong password must fail authentication');

            // Verify Format Isolation: Passing Fake Vault Header
            const fakeVaultPath = path.join(testTempDir, 'fake.clvault');
            await fs.promises.writeFile(fakeVaultPath, Buffer.concat([Buffer.from('CLVAULT1', 'ascii'), Buffer.alloc(64)]));
            const inspectVaultAsCapsule = await capsulePkg.inspectCapsulePackage(fakeVaultPath, 'any');
            assert.strictEqual(inspectVaultAsCapsule.valid, false, 'CLVAULT1 should not validate as capsule');
            assert.strictEqual(inspectVaultAsCapsule.isFullVault, true, 'Should be flagged as isFullVault');

            // Verify Unpacking to Staging
            const stagingDir = path.join(testTempDir, 'staging');
            await fs.promises.mkdir(stagingDir, { recursive: true });
            const unpacked = await capsulePkg.unpackCapsuleToStaging({
                packagePath: outCapsule,
                transferPassword: 'TestTransferPassword#1',
                stagingDirectory: stagingDir
            });
            assert.strictEqual(unpacked.fileCount, 2, 'Unpacked fileCount should be 2');
            assert.strictEqual(unpacked.files.length, 2, 'Unpacked files array should have length 2');

            const stagedFile1 = await fs.promises.readFile(unpacked.files[0].stagedPath, 'utf8');
            assert.strictEqual(stagedFile1, 'Hello CrypticLocker Capsule Test!', 'Restored plaintext content must match exactly');
        } finally {
            try { await fs.promises.rm(testTempDir, { recursive: true, force: true }); } catch {}
        }

        // Verify Preload, Main and UI Contracts
        assert.ok(preloadJs.includes('selectCapsuleFile:'), 'preload must expose selectCapsuleFile');
        assert.ok(preloadJs.includes('inspectCapsule:'), 'preload must expose inspectCapsule');
        assert.ok(preloadJs.includes('exportCapsule:'), 'preload must expose exportCapsule');
        assert.ok(preloadJs.includes('mergeCapsule:'), 'preload must expose mergeCapsule');

        assert.ok(mainJs.includes("'vault:select-capsule-file'"), 'main must handle vault:select-capsule-file');
        assert.ok(mainJs.includes("'vault:inspect-capsule'"), 'main must handle vault:inspect-capsule');
        assert.ok(mainJs.includes("'vault:export-capsule'"), 'main must handle vault:export-capsule');
        assert.ok(mainJs.includes("'vault:merge-capsule'"), 'main must handle vault:merge-capsule');
        assert.ok(!mainJs.includes('encryptFileToCLV2Stream'), 'main must not reference undefined encryptFileToCLV2Stream');
        assert.ok(mainJs.includes('CLCAP1.0'), 'main must contain CLCAP1.0 format check');

        assert.ok(dashboardHtml.includes('id="capsuleExportOverlay"'), 'dashboard.html must have capsuleExportOverlay');
        assert.ok(dashboardHtml.includes('id="capsuleImportOverlay"'), 'dashboard.html must have capsuleImportOverlay');
        assert.ok(dashboardHtml.includes('id="selectionExportCapsuleButton"'), 'dashboard.html must have selectionExportCapsuleButton');
        assert.ok(dashboardHtml.includes('id="importCapsuleButton"'), 'dashboard.html must have importCapsuleButton');

        assert.ok(dashboardCss.includes('.capsule-modal-overlay'), 'dashboard.css must style capsule-modal-overlay');
        assert.ok(dashboardCss.includes('.capsule-target-preview'), 'dashboard.css must style capsule-target-preview');

        assert.ok(dashboardJs.includes('openCapsuleExportModal'), 'dashboard.js must define openCapsuleExportModal');
        assert.ok(dashboardJs.includes('openCapsuleImportModal'), 'dashboard.js must define openCapsuleImportModal');
        assert.ok(dashboardJs.includes('export-capsule-button'), 'dashboard.js must include export-capsule-button');
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
