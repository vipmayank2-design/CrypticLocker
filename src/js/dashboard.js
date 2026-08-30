
function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );
    const value = bytes / Math.pow(1024, index);
    return `${
        value >= 100
            ? value.toFixed(0)
            : value >= 10
                ? value.toFixed(1)
                : value.toFixed(2)
    } ${units[index]}`;
}

function formatVaultDate(isoDateString) {
    if (!isoDateString) return '—';
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function closeAllDropdownsAndMenus(exceptElement = null) {
    try {
        if (typeof addVaultMenu !== 'undefined' && addVaultMenu && (!exceptElement || !addVaultMenu.contains(exceptElement))) {
            addVaultMenu.classList.remove('open');
            addVaultMenu.style.display = 'none';
        }

        if (typeof fileActionMenu !== 'undefined' && fileActionMenu && (!exceptElement || !fileActionMenu.contains(exceptElement))) {
            fileActionMenu.hidden = true;
        }

        if (typeof folderActionMenu !== 'undefined' && folderActionMenu && (!exceptElement || !folderActionMenu.contains(exceptElement))) {
            folderActionMenu.hidden = true;
        }

        document.querySelectorAll('.file-menu.open').forEach(menu => {
            if (!exceptElement || (menu !== exceptElement && !menu.contains(exceptElement))) {
                menu.classList.remove('open');
                menu.classList.remove('dropup');
                const parentRow = menu.closest('.file-row, .quarantine-row');
                if (parentRow) {
                    parentRow.classList.remove('menu-active');
                    parentRow.style.zIndex = '';
                }
            }
        });

        if (typeof closeAutoLockDropdown === 'function') {
            const autoLockDropdown = document.getElementById('autoLockDropdown');
            if (!exceptElement || (autoLockDropdown && !autoLockDropdown.contains(exceptElement))) {
                closeAutoLockDropdown();
            }
        }
    } catch (e) {
        console.error('Error closing dropdowns:', e);
    }
}
/* =========================================
   APPLICATION VIEW NAVIGATION
========================================= */

const changePasswordView =
    document.getElementById(
        'changePasswordView'
    );

const openChangePasswordModal =
    document.getElementById(
        'openChangePasswordModal'
    );

const cpBackButton =
    document.getElementById(
        'cpBackButton'
    );

const confirmChangePassword =
    document.getElementById(
        'confirmChangePassword'
    );

const currentPasswordInput =
    document.getElementById(
        'currentPasswordInput'
    );

const newPasswordInput =
    document.getElementById(
        'newPasswordInput'
    );

const confirmPasswordInput =
    document.getElementById(
        'confirmPasswordInput'
    );

const changePasswordError =
    document.getElementById(
        'changePasswordError'
    );

const integrityFooter =
    document.getElementById(
        'integrityFooter'
    );

const integrityDetails =
    document.getElementById(
        'integrityDetails'
    );

const integrityDetailsList =
    document.getElementById(
        'integrityDetailsList'
    );

const integrityDetailsButton =
    document.getElementById(
        'integrityDetailsButton'
    );

const changePasswordErrorBox =
    changePasswordError?.closest('.cp-error');

function setChangePasswordError(message) {

    if (!changePasswordError) {
        return;
    }

    changePasswordError.textContent =
        message;

    changePasswordErrorBox?.classList.toggle(
        'has-error',
        Boolean(message)
    );

}

    const vaultTableHeader =
    document.getElementById(
        'vaultTableHeader'
    );

const quarantineTableHeader =
    document.getElementById(
        'quarantineTableHeader'
    );
    
const vaultView =
    document.getElementById(
        'vaultView'
    );

const quarantineView =
    document.getElementById(
        'quarantineView'
    );

const settingsView =
    document.getElementById(
        'settingsView'
    );

const recoveryKeyView =
    document.getElementById(
        'recoveryKeyView'
    );

const aboutView =
    document.getElementById(
        'aboutView'
    );

const aboutNavButton =
    document.getElementById(
        'aboutNavButton'
    );

const aboutAppVersion =
    document.getElementById(
        'aboutAppVersion'
    );

const recoveryKeyNavButton =
    document.getElementById(
        'recoveryKeyNavButton'
    );

const exportView =
    document.getElementById(
        'exportView'
    );

const exportNavButton =
    document.getElementById(
        'exportNavButton'
    );

const exportVaultStorage =
    document.getElementById(
        'exportVaultStorage'
    );

const exportVaultFiles =
    document.getElementById(
        'exportVaultFiles'
    );

const exportVaultFolders =
    document.getElementById(
        'exportVaultFolders'
    );

const exportVaultButton =
    document.getElementById(
        'exportVaultButton'
    );
    
const recoveryKeyValue =
    document.getElementById(
        'recoveryKeyValue'
    );

const toggleRecoveryKeyButton =
    document.getElementById(
        'toggleRecoveryKeyButton'
    );

const copyRecoveryKeyButton =
    document.getElementById(
        'copyRecoveryKeyButton'
    );
    
let recoveryKeyVisible = false;
let recoveryKey = null;

const EYE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M2 12S5.5 5 12 5s10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
<circle cx="12" cy="12" r="3"/>
</svg>
`;

const EYE_OFF_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M3 3L21 21"/>
<path d="M10.5 10.5A2 2 0 0 0 13.5 13.5"/>
<path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16.7 16.7 0 0 1-3.2 4.2"/>
<path d="M6.2 6.2A16.7 16.7 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 2.1-.2"/>
</svg>
`;

/* =========================================
   CHANGE PASSWORD - SHOW / HIDE PASSWORD
========================================= */

document
    .querySelectorAll('.cp-eye, #changePasswordView .toggle-password')
    .forEach(button => {

        const input =
            document.getElementById(
                button.dataset.target
            );

        if (!input) {
            return;
        }

        button.addEventListener(
            'click',
            () => {

                if (input.type === 'password') {
                    input.type = 'text';
                    button.classList.add('visible');
                    button.setAttribute('aria-label', 'Hide password');
                } else {
                    input.type = 'password';
                    button.classList.remove('visible');
                    button.setAttribute('aria-label', 'Show password');
                }

            }
        );

    });
    
    const quarantineNavButton =
    document.getElementById(
        'quarantineNavButton'
    );

const settingsNavButton =
    document.getElementById(
        'settingsNavButton'
    );

const openQuarantineSettingsButton =
    document.getElementById(
        'openQuarantineSettingsButton'
    );

const openVaultStorageButton =
    document.getElementById(
        'openVaultStorageButton'
    );

const vaultStorageLocation =
    document.getElementById(
        'vaultStorageLocation'
    );

const vaultStorageUsed =
    document.getElementById(
        'vaultStorageUsed'
    );

const vaultItemCount =
    document.getElementById(
        'vaultItemCount'
    );

const applicationVersion =
    document.getElementById(
        'applicationVersion'
    );
    
    const autoLockSelect =
    document.getElementById(
        'autoLockSelect'
    );

const lockOnSleepToggle =
    document.getElementById(
        'lockOnSleepToggle'
    );
    
    const launchAtStartupToggle =
    document.getElementById(
        'launchAtStartupToggle'
    );

    const themeOptionSystem =
    document.getElementById(
        'themeOptionSystem'
    );

const themeOptionDark =
    document.getElementById(
        'themeOptionDark'
    );

const themeOptionLight =
    document.getElementById(
        'themeOptionLight'
    );

const autoLockDropdown =
    document.getElementById(
        'autoLockDropdown'
    );

const autoLockDropdownButton =
    document.getElementById(
        'autoLockDropdownButton'
    );

const autoLockDropdownMenu =
    document.getElementById(
        'autoLockDropdownMenu'
    );

const autoLockSelectedText =
    document.getElementById(
        'autoLockSelectedText'
    );
    
    const myVaultNavButton =
    document.querySelector(
        '.sidebar-nav .nav-item.active'
    );
    
    const quarantineList =
    document.getElementById(
        'quarantineList'
    );

const quarantineEmptyState =
    document.getElementById(
        'quarantineEmptyState'
    );

const quarantineSummary =
    document.getElementById(
        'quarantineSummary'
    );

const quarantineTotalCount =
    document.getElementById(
        'quarantineTotalCount'
    );

const quarantinePossibleCount =
    document.getElementById(
        'quarantinePossibleCount'
    );

const quarantineInvalidCount =
    document.getElementById(
        'quarantineInvalidCount'
    );

const quarantineStatusCount =
    document.getElementById(
        'quarantineStatusCount'
    );

const quarantineDeleteInvalidButton =
    document.getElementById(
        'quarantineDeleteInvalidButton'
    );

const quarantineScanButton =
    document.getElementById(
        'quarantineScanButton'
    );

const quarantineEmptyScanButton =
    document.getElementById(
        'quarantineEmptyScanButton'
    );

    function setQuarantineScanState(
    button,
    scanning
) {

    if (!button) {
        return;
    }


    const icon =
        button.querySelector(
            'svg'
        );

    const text =
        button.querySelector(
            'span'
        );


    button.disabled =
        scanning;


    if (icon) {

        icon.classList.toggle(
            'btn-icon-spin',
            scanning
        );

    }


    if (text) {

        text.textContent =
            scanning
                ? 'Scanning...'
                : 'Scan Again';

    }

}
    
/* =========================================
   QUARANTINE — INSPECTION PANEL
========================================= */

const quarantineInspectOverlay =
    document.getElementById(
        'quarantineInspectOverlay'
    );

const quarantineInspectClose =
    document.getElementById(
        'quarantineInspectClose'
    );

const quarantineInspectRecover =
    document.getElementById(
        'quarantineInspectRecover'
    );


let inspectedQuarantineOrphan =
    null;
    
    const quarantineInspectDone =
    document.getElementById(
        'quarantineInspectDone'
    );

const quarantineInspectName =
    document.getElementById(
        'quarantineInspectName'
    );

const quarantineInspectStatus =
    document.getElementById(
        'quarantineInspectStatus'
    );

const quarantineInspectSize =
    document.getElementById(
        'quarantineInspectSize'
    );

const quarantineInspectHeader =
    document.getElementById(
        'quarantineInspectHeader'
    );

const quarantineInspectStructure =
    document.getElementById(
        'quarantineInspectStructure'
    );

const quarantineInspectAuthentication =
    document.getElementById(
        'quarantineInspectAuthentication'
    );

const quarantineInspectRecovery =
    document.getElementById(
        'quarantineInspectRecovery'
    );

const quarantineInspectReason =
    document.getElementById(
        'quarantineInspectReason'
    );

const quarantineInspectContainerName =
    document.getElementById(
        'quarantineInspectContainerName'
    );

function getQuarantineFileIconSvg(fileName, extraClass = '') {
    const name = String(fileName || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    const classAttr = extraClass ? ` class="${extraClass}"` : '';

    // Images
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'raw', 'psd', 'ai'].includes(ext)) {
        return `
            <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
            </svg>
        `;
    }

    // PDF
    if (ext === 'pdf') {
        return `
            <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        `;
    }

    // Audio
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff', 'alac'].includes(ext)) {
        return `
            <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
            </svg>
        `;
    }

    // Video
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm', 'flv', 'm4v', '3gp'].includes(ext)) {
        return `
            <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="17" x2="22" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
        `;
    }

    // Code & Structured Data
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'html', 'css', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'go', 'rs', 'php', 'rb', 'sql', 'xml', 'yaml', 'yml', 'sh', 'bat', 'ps1', 'env', 'vue', 'svelte'].includes(ext)) {
        return `
            <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        `;
    }

    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'tgz'].includes(ext)) {
        return `
            <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
        `;
    }

    // Text & Documents
    if (['txt', 'md', 'doc', 'docx', 'rtf', 'odt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'log', 'tex', 'pages', 'numbers', 'key'].includes(ext)) {
        return `
            <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        `;
    }

    // Generic / Encrypted / Binary Container Fallback
    return `
        <svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 3H14L19 8V21H7Z" />
            <path d="M14 3V8H19" />
        </svg>
    `;
}

const getFileIconSvg = getQuarantineFileIconSvg;

function openQuarantineInspection(
    orphan
) {

    if (!orphan) {
        return;
    }


    const isPossibleValid =
        orphan.valid === true;


    inspectedQuarantineOrphan =
    orphan;


    quarantineInspectRecover.hidden =
        !isPossibleValid;
    
    const displayTitle =
        String(orphan.originalName || orphan.name || 'Unknown container');
    const containerFileName =
        String(orphan.name || 'Unknown container');

    quarantineInspectName.textContent =
        displayTitle;

    if (quarantineInspectContainerName) {
        if (orphan.originalName && orphan.originalName !== orphan.name) {
            quarantineInspectContainerName.textContent = containerFileName;
            quarantineInspectContainerName.hidden = false;
        } else {
            quarantineInspectContainerName.textContent = '';
            quarantineInspectContainerName.hidden = true;
        }
    }

    const inspectIconContainer =
        quarantineInspectOverlay.querySelector('.quarantine-inspect-file-icon');
    if (inspectIconContainer) {
        inspectIconContainer.innerHTML =
            getQuarantineFileIconSvg(displayTitle);
    }


    quarantineInspectStatus.className =
        'quarantine-status';


    if (isPossibleValid) {

        quarantineInspectStatus.classList.add(
            'possible'
        );

        quarantineInspectStatus.textContent =
            'Possible Valid';

    } else {

        quarantineInspectStatus.classList.add(
            'invalid'
        );

        quarantineInspectStatus.textContent =
            'Invalid';

    }


    quarantineInspectSize.textContent =
        formatOperationBytes(
            Number(orphan.size) || 0
        );


    quarantineInspectHeader.textContent =
        isPossibleValid
            ? 'Passed'
            : 'Failed';


    quarantineInspectStructure.textContent =
        isPossibleValid
            ? 'Possible'
            : 'Invalid';


    /*
        The quarantine scan does not perform
        cryptographic authentication.

        Never claim AES-GCM verification until
        the recovery/deep-validation process
        actually performs it.
    */

    quarantineInspectAuthentication.textContent =
        'Not verified';


    quarantineInspectRecovery.innerHTML =
    isPossibleValid
        ? `
            <span class="recovery-availability recovery-available">
                Available
            </span>
        `
        : `
            <span class="recovery-availability recovery-unavailable">
                Unavailable
            </span>
        `;


    quarantineInspectReason.textContent =
        String(
            orphan.reason ||
            (
                isPossibleValid
                    ? 'Container structure appears to be possible.'
                    : 'Container validation failed.'
            )
        );


    quarantineInspectOverlay.hidden =
        false;


    document
        .querySelectorAll(
            '.file-menu.open'
        )
        .forEach(menu => {

            menu.classList.remove(
                'open'
            );

        });


    quarantineInspectClose.focus();

}

function closeQuarantineInspection() {

    quarantineInspectOverlay.hidden =
        true;

}


quarantineInspectClose.addEventListener(
    'click',
    () => {

        closeQuarantineInspection();

    }
);


quarantineInspectDone.addEventListener(
    'click',
    () => {

        closeQuarantineInspection();

    }
);

quarantineInspectRecover.addEventListener(
    'click',
    async () => {

        if (
            !inspectedQuarantineOrphan ||
            inspectedQuarantineOrphan.valid !== true
        ) {
            return;
        }

        const orphan =
            inspectedQuarantineOrphan;

        setButtonLoading(quarantineInspectRecover, true);

        try {

            const check =
                typeof window.crypticLocker?.checkQuarantineOrphan === 'function'
                    ? await window.crypticLocker.checkQuarantineOrphan(orphan.name)
                    : { success: true, recoverable: true, originalName: orphan.name };

            setButtonLoading(quarantineInspectRecover, false, 'Recover');

            if (!check || check.recoverable !== true) {

                quarantineInspectOverlay.hidden = true;

                await showCustomAlert({
                    title: 'Recovery Failed',
                    message: check?.message || 'Unable to recover quarantined container.',
                    type: 'danger'
                });

                return;

            }

            quarantineInspectOverlay.hidden = true;

            const choice =
                await showRestoreConfirm({
                    title:
                        'Recover file?',
                    name:
                        check.originalName || orphan.name,
                    message:
                        'The file will be decrypted to the location you choose.',
                    checkboxLabel:
                        'Also remove the quarantined copy',
                    confirmText:
                        'Recover'
                });

            if (!choice.confirmed) {
                if (inspectedQuarantineOrphan) {
                    openQuarantineInspection(inspectedQuarantineOrphan);
                }
                return;
            }

            closeRestoreConfirm(false);

            try {

                const result =
                    await window
                        .crypticLocker
                        .recoverOrphan(
                            orphan.name,
                            choice.removeFromVault
                        );

                // Close restore confirm modal immediately as soon as recovery call returns
                closeRestoreConfirm(false);

                /*
                    User closed the recovery destination
                    picker without selecting a location.
                */
                if (
                    result?.canceled === true
                ) {
                    if (inspectedQuarantineOrphan) {
                        openQuarantineInspection(inspectedQuarantineOrphan);
                    }
                    return;
                }

                if (
                    !result ||
                    result.success !== true
                ) {
                    throw new Error(
                        result?.message ||
                        'Unable to recover quarantined container.'
                    );
                }

                closeQuarantineInspection();

                await loadQuarantinedOrphans();

                await loadVaultFiles(
                    true
                );

                if (result.removeFromQuarantineError) {
                    await showCustomAlert({
                        title: 'Quarantine Notice',
                        message: result.removeFromQuarantineError,
                        type: 'warning'
                    });
                }

            } catch (error) {

                console.error(
                    'Unable to recover quarantined container:',
                    error
                );

                // Close restore confirm modal before showing error alert
                closeRestoreConfirm(false);

                // Ensure inspect overlay is hidden while showing error alert
                quarantineInspectOverlay.hidden = true;

                await showCustomAlert({
                    title: 'Recovery Failed',
                    message: error.message || 'Unable to recover quarantined container.',
                    type: 'danger'
                });

            } finally {

                closeRestoreConfirm(false);

            }

        } catch (checkError) {

            console.error(checkError);

            setButtonLoading(quarantineInspectRecover, false, 'Recover');

            quarantineInspectOverlay.hidden = true;

            await showCustomAlert({
                title: 'Recovery Failed',
                message: checkError.message || 'Unable to inspect quarantined container.',
                type: 'danger'
            });

        } finally {

            setButtonLoading(quarantineInspectRecover, false, 'Recover');

        }

    }
);

quarantineInspectOverlay.addEventListener(
    'click',
    event => {

        if (
            event.target ===
            quarantineInspectOverlay
        ) {

            closeQuarantineInspection();

        }

    }
);


document.addEventListener(
    'keydown',
    event => {

        if (
            event.key !== 'Escape' ||
            quarantineInspectOverlay.hidden
        ) {

            return;

        }


        closeQuarantineInspection();

    }
);

let quarantinedOrphans = [];
    
    async function loadQuarantinedOrphans() {

    try {

        const result =
            await window
                .crypticLocker
                .getQuarantinedOrphans();


        if (!result.success) {

            throw new Error(
                result.message ||
                'Unable to load quarantined items.'
            );

        }


        quarantinedOrphans =
            Array.isArray(result.orphans)
                ? result.orphans
                : [];


        renderQuarantinedOrphans();


    } catch (error) {

        console.error(
            'Unable to load quarantine:',
            error
        );


        quarantinedOrphans = [];

        renderQuarantinedOrphans();

    }

}


function renderQuarantinedOrphans() {

    quarantineList.innerHTML = '';
    const hasItems =
    quarantinedOrphans.length > 0;


    const total =
        quarantinedOrphans.length;


    const possibleCount =
        quarantinedOrphans.filter(
            orphan =>
                orphan.valid === true
        ).length;


    const invalidCount =
        total - possibleCount;


    quarantineTotalCount.textContent =
        `${total} quarantined ${
            total === 1
                ? 'item'
                : 'items'
        }`;


    quarantinePossibleCount.textContent =
        `${possibleCount} possible valid`;


    quarantineInvalidCount.textContent =
        `${invalidCount} invalid`;


    quarantineStatusCount.textContent =
        `${total} quarantined ${
            total === 1
                ? 'item'
                : 'items'
        }`;


    /*
        Bulk-delete button is only relevant
        when definitely-invalid items exist.
    */

    quarantineDeleteInvalidButton.hidden =
        invalidCount === 0;


    if (total === 0) {

        quarantineList.hidden =
            true;

        quarantineEmptyState.hidden =
            false;

        if (quarantineSummary) {

            quarantineSummary.hidden =
                true;

        }

        if (quarantineTableHeader) {

            quarantineTableHeader.hidden =
                true;

        }

        return;

    }

    quarantineEmptyState.hidden =
        true;

    quarantineList.hidden =
        false;

    if (quarantineSummary) {

        quarantineSummary.hidden =
            false;

    }

    if (quarantineTableHeader) {

        quarantineTableHeader.hidden =
            false;

    }


    quarantinedOrphans.forEach(
        orphan => {

            const row =
                document.createElement(
                    'div'
                );


            row.className =
                'quarantine-row';


            const displayTitle =
                String(orphan.originalName || orphan.name || 'Unknown container');
            const hasOriginalName =
                Boolean(orphan.originalName && orphan.originalName !== orphan.name);

            const isHighlighted = quarantineHighlightedIdentifiers.length > 0 && (() => {
                const lowerName = String(orphan.name || '').toLowerCase().trim();
                const lowerOrig = String(orphan.originalName || '').toLowerCase().trim();
                const lowerId = String(orphan.containerId || '').toLowerCase().trim();
                const nameBase = lowerName.includes('.') ? lowerName.substring(0, lowerName.lastIndexOf('.')) : lowerName;
                const origBase = lowerOrig.includes('.') ? lowerOrig.substring(0, lowerOrig.lastIndexOf('.')) : lowerOrig;
                const uuidFromName = lowerName.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];
                const uuidFromOrig = lowerOrig.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];

                // 1. Direct Name / UUID / Base name matching
                const directMatch = quarantineHighlightedIdentifiers.some(ident => {
                    if (!ident) return false;
                    const lowerIdent = String(ident).toLowerCase().trim();
                    if (!lowerIdent) return false;
                    const identBase = lowerIdent.includes('.') ? lowerIdent.substring(0, lowerIdent.lastIndexOf('.')) : lowerIdent;
                    const uuidFromIdent = lowerIdent.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];

                    if (uuidFromIdent) {
                        if (uuidFromName && uuidFromIdent === uuidFromName) return true;
                        if (uuidFromOrig && uuidFromIdent === uuidFromOrig) return true;
                        if (lowerId && uuidFromIdent === lowerId) return true;
                        if (lowerName.includes(uuidFromIdent) || (lowerOrig && lowerOrig.includes(uuidFromIdent))) return true;
                    }
                    if (lowerId && (lowerIdent === lowerId || lowerIdent.includes(lowerId))) return true;
                    if (uuidFromName && (lowerIdent.includes(uuidFromName) || (lowerOrig && lowerOrig.includes(uuidFromName)))) return true;

                    if (lowerName === lowerIdent || (lowerOrig && lowerOrig === lowerIdent)) return true;
                    if (identBase && identBase.length > 1) {
                        if (identBase === nameBase || (origBase && identBase === origBase)) return true;
                    }
                    if (lowerIdent.length >= 3) {
                        if (lowerName.includes(lowerIdent) || (lowerOrig && lowerOrig.includes(lowerIdent))) return true;
                        if (nameBase && identBase && (nameBase.includes(identBase) || (origBase && origBase.includes(identBase)))) return true;
                    }
                    return false;
                });

                if (directMatch) return true;

                // 2. Size matching
                const sizeMatch = typeof orphan.size === 'number' && orphan.size > 0 &&
                    quarantineMissingSizes.some(s => typeof s === 'number' && (Math.abs(orphan.size - s) < 4096 || Math.abs(orphan.size - (s + 220)) < 2048));

                if (sizeMatch) return true;

                return false;
            })();

            if (isHighlighted) {
                row.classList.add('quarantine-highlighted');
            }

            row.innerHTML = `

                <div class="quarantine-name">

                    <div class="quarantine-file-icon">
                        ${getQuarantineFileIconSvg(displayTitle)}
                    </div>

                    <div class="quarantine-name-container">
                        <span class="quarantine-name-title"></span>
                        ${
                            hasOriginalName
                                ? `<span class="quarantine-name-subtitle"></span>`
                                : ''
                        }
                    </div>

                </div>


                <div>
                    <span
                        class="quarantine-status"
                    ></span>
                </div>


                <div
                    class="quarantine-size"
                ></div>


                <div
                    class="quarantine-reason"
                ></div>


                <div class="quarantine-actions">

                    <button
                        class="file-menu-button quarantine-menu-button"
                        type="button"
                        title="More options"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    <div class="file-menu quarantine-item-menu">

    <button
    class="file-menu-action"
    type="button"
    data-action="inspect"
>
        <svg
    class="file-menu-action-icon"
    viewBox="0 0 24 24"
>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 11V16" />
            <path d="M12 8H12.01" />
        </svg>

        <span>Inspect</span>
    </button>


    ${
        orphan.valid === true
            ? `
                <button
    class="file-menu-action"
    type="button"
    data-action="recover"
>
    <svg class="file-menu-action-icon" viewBox="0 0 24 24">
            <path d="M12 4V16" />
            <path d="M8 8L12 4L16 8" />
            <path d="M5 19H19" />
        </svg>

                    <span>Recover</span>
                </button>
            `
            : ''
    }


    <button
    type="button"
    class="file-menu-action danger"
    data-action="delete"
>
    <svg
        class="file-menu-action-icon"
        viewBox="0 0 24 24"
    >
            <path d="M5 7H19" />
            <path d="M9 7V5H15V7" />
            <path d="M7 7L8 19H16L17 7" />
        </svg>

        <span>Delete Permanently</span>
    </button>

</div>

                </div>

            `;


            const nameTitle =
                row.querySelector(
                    '.quarantine-name-title'
                );
            if (nameTitle) {
                nameTitle.textContent = displayTitle;
            }

            if (hasOriginalName) {
                const nameSubtitle =
                    row.querySelector(
                        '.quarantine-name-subtitle'
                    );
                if (nameSubtitle) {
                    nameSubtitle.textContent = String(orphan.name || '');
                }
            }


            const status =
                row.querySelector(
                    '.quarantine-status'
                );


            if (
                orphan.valid === true
            ) {

                status.classList.add(
                    'possible'
                );

                status.textContent =
                    'Possible Valid';

            } else {

                status.classList.add(
                    'invalid'
                );

                status.textContent =
                    'Invalid';

            }


            row.querySelector(
                '.quarantine-size'
            ).textContent =
                formatOperationBytes(
                    Number(orphan.size) || 0
                );


            row.querySelector(
                '.quarantine-reason'
            ).textContent =
                String(
                    orphan.reason ||
                    (
                        orphan.valid === true
                            ? 'Possible CrypticLocker container'
                            : 'Container validation failed'
                    )
                );


            const menuButton =
    row.querySelector(
        '.quarantine-menu-button'
    );

const itemMenu =
    row.querySelector(
        '.quarantine-item-menu'
    );


const inspectButton =
    itemMenu.querySelector(
        '[data-action="inspect"]'
    );

    const recoverButton =
    itemMenu.querySelector(
        '[data-action="recover"]'
    );

    const deleteButton =
    itemMenu.querySelector(
        '[data-action="delete"]'
    );

inspectButton.addEventListener(
    'click',
    event => {

        event.stopPropagation();


        itemMenu.classList.remove(
            'open'
        );


        openQuarantineInspection(
            orphan
        );

    }
);

if (recoverButton) {

    recoverButton.addEventListener(
        'click',
        async event => {

            event.stopPropagation();

            setButtonLoading(recoverButton, true);

            try {

                const check =
                    typeof window.crypticLocker?.checkQuarantineOrphan === 'function'
                        ? await window.crypticLocker.checkQuarantineOrphan(orphan.name)
                        : (orphan.valid !== true ? { success: false, recoverable: false, message: `This quarantined file is invalid and cannot be recovered (${orphan.reason || 'Container validation failed'}).` } : { success: true, recoverable: true, originalName: orphan.name });

                setButtonLoading(recoverButton, false, 'Recover');
                closeAllDropdownsAndMenus();

                if (!check || check.recoverable !== true) {

                    await showCustomAlert({
                        title: 'Recovery Failed',
                        message: check?.message || `This quarantined file is invalid and cannot be recovered (${orphan.reason || 'Container validation failed'}).`,
                        type: 'danger'
                    });

                    return;

                }

                const choice =
                    await showRestoreConfirm({
                        title:
                            'Recover file?',
                        name:
                            check.originalName || orphan.name,
                        message:
                            'The file will be decrypted to the location you choose.',
                        checkboxLabel:
                            'Also remove the quarantined copy',
                        confirmText:
                            'Recover'
                    });

                if (!choice.confirmed) {
                    return;
                }

                closeRestoreConfirm(false);

                try {

                    const result =
                        await window
                            .crypticLocker
                            .recoverOrphan(
                                orphan.name,
                                choice.removeFromVault
                            );

                    // Close restore confirm modal immediately as soon as recovery returns
                    closeRestoreConfirm(false);
        
                    if (result.canceled) {
                        return;
                    }

                    if (!result.success) {

                        if (
                            result.operationFailed ===
                            true
                        ) {
                            return;
                        }

                        // Close confirm modal before showing error alert
                        closeRestoreConfirm(false);

                        await showCustomAlert({
                            title: 'Recovery Failed',
                            message: result.message || 'Unable to recover quarantined file.',
                            type: 'danger'
                        });

                        return;

                    }

                    await loadQuarantinedOrphans();

                    await loadVaultFiles(
                        true
                    );

                    if (result.removeFromQuarantineError) {

                        await showCustomAlert({
                            title: 'Quarantine Notice',
                            message: result.removeFromQuarantineError,
                            type: 'warning'
                        });

                    }

                } catch (error) {

                    console.error(
                        'Quarantine recovery renderer error:',
                        error
                    );

                    // Close confirm modal before showing error alert
                    closeRestoreConfirm(false);

                    await showCustomAlert({
                        title: 'Recovery Failed',
                        message: error?.message || 'Unable to recover quarantined file.',
                        type: 'danger'
                    });

                } finally {

                    closeRestoreConfirm(false);

                }

            } catch (checkError) {

                console.error(checkError);
                setButtonLoading(recoverButton, false, 'Recover');
                closeAllDropdownsAndMenus();

                await showCustomAlert({
                    title: 'Recovery Failed',
                    message: checkError?.message || 'Unable to inspect quarantined file.',
                    type: 'danger'
                });

            } finally {

                setButtonLoading(recoverButton, false, 'Recover');

            }

        }
    );

}

if (deleteButton) {

    deleteButton.addEventListener(
        'click',
        event => {

            event.stopPropagation();


            itemMenu.classList.remove(
                'open'
            );


            openDeleteConfirmation(
                'quarantine',
                orphan.name,
                orphan.originalName || orphan.name
            );

        }
    );

}

menuButton.addEventListener(
    'click',
    event => {

        event.stopPropagation();

        const wasOpen =
            itemMenu.classList.contains('open');

        closeAllDropdownsAndMenus();

        if (!wasOpen) {
            const rect = menuButton.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 170 && rect.top > 170) {
                itemMenu.classList.add('dropup');
            } else {
                itemMenu.classList.remove('dropup');
            }
            itemMenu.classList.add('open');
            row.classList.add('menu-active');
            row.style.zIndex = '1000';
        }

    }
);

quarantineList.appendChild(
                row
            );

        }
    );

    if (quarantineHighlightedIdentifiers.length > 0) {
        const firstHighlighted =
            quarantineList.querySelector('.quarantine-row.quarantine-highlighted');
        if (firstHighlighted) {
            setTimeout(() => {
                firstHighlighted.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 80);
        }
    }

}

async function toggleRecoveryKey() {

    if (!recoveryKeyVisible) {

        if (!recoveryKey) {

            const result =
                await window
                    .crypticLocker
                    .getRecoveryKey();

            if (!result.success) {

                return;

            }

            recoveryKey =
                result.recoveryKey;

        }

        recoveryKeyValue.textContent =
            recoveryKey;

        copyRecoveryKeyButton.disabled =
            false;

        toggleRecoveryKeyButton.innerHTML =
    EYE_OFF_ICON;

toggleRecoveryKeyButton.title =
    'Hide Recovery Key';
    
    recoveryKeyVisible = true;

    } else {

        recoveryKeyValue.textContent =
            'CKRV-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX';

        copyRecoveryKeyButton.disabled =
            true;

        toggleRecoveryKeyButton.innerHTML =
    EYE_ICON;

toggleRecoveryKeyButton.title =
    'Show Recovery Key';
    
    recoveryKeyVisible = false;

    }

}

/*
    Applies the given theme ('dark' | 'light')
    to the document and updates the visual
    state of the theme switch buttons.

    Does NOT persist anything — callers are
    responsible for saving to settings.
*/
let currentThemeMode = 'system';

function resolveSystemTheme() {
    return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function applyTheme(theme) {

    const mode =
        theme === 'light' ||
        theme === 'dark' ||
        theme === 'system'
            ? theme
            : 'dark';

    currentThemeMode = mode;

    const resolvedTheme =
        mode === 'system'
            ? resolveSystemTheme()
            : mode;

    document.documentElement.dataset.theme =
        resolvedTheme;

    try {

        window.localStorage.setItem(
            'cl-theme',
            mode
        );

    } catch (error) {

        console.error(
            'Unable to persist theme locally:',
            error
        );

    }

    if (themeOptionSystem) {

        themeOptionSystem.classList.toggle(
            'active',
            mode === 'system'
        );

        themeOptionSystem.setAttribute(
            'aria-checked',
            mode === 'system' ? 'true' : 'false'
        );

    }

    if (themeOptionDark) {

        themeOptionDark.classList.toggle(
            'active',
            mode === 'dark'
        );

        themeOptionDark.setAttribute(
            'aria-checked',
            mode === 'dark' ? 'true' : 'false'
        );

    }

    if (themeOptionLight) {

        themeOptionLight.classList.toggle(
            'active',
            mode === 'light'
        );

        themeOptionLight.setAttribute(
            'aria-checked',
            mode === 'light' ? 'true' : 'false'
        );

    }

}

if (window.matchMedia) {

    window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {

            if (currentThemeMode === 'system') {

                document.documentElement.dataset.theme =
                    resolveSystemTheme();

            }

        });

}

async function loadApplicationSettings() {

    try {

        const result =
            await window
                .crypticLocker
                .getSettings();


        if (
            !result ||
            result.success !== true ||
            !result.settings
        ) {

            throw new Error(
                result?.message ||
                'Unable to load application settings.'
            );

        }


        applicationSettings =
            result.settings;


        /*
            Auto-Lock

            Backend:
            0  = Never
            1  = 1 minute
            5  = 5 minutes
            15 = 15 minutes
            30 = 30 minutes
        */

        if (autoLockSelect) {
            autoLockSelect.value =
                String(
                    applicationSettings
                        .autoLockMinutes
                );

            if (typeof updateAutoLockDropdownUI === 'function') {
                updateAutoLockDropdownUI(
                    applicationSettings.autoLockMinutes
                );
            }
        }


        /*
            Security toggles.
        */


        if (lockOnSleepToggle) {

            lockOnSleepToggle.checked =
                applicationSettings
                    .lockOnSleep === true;

        }

        if (launchAtStartupToggle) {

    launchAtStartupToggle.checked =
        applicationSettings
            .launchAtStartup === true;

}


        /*
            Theme.
        */

        applyTheme(
            applicationSettings.theme
        );


    } catch (error) {

        console.error(
            'Unable to load application settings:',
            error
        );

    }

}

async function loadSettingsInformation() {

    try {

        const result =
            await window
                .crypticLocker
                .getVaultSettingsInfo();


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                result?.message ||
                'Unable to load settings information.'
            );

        }


        /*
            Vault storage location.
        */

        vaultStorageLocation.textContent =
            result.storageLocation || '—';

        vaultStorageLocation.title =
            result.storageLocation || '';


        /*
            Total encrypted vault storage.
        */

        vaultStorageUsed.textContent =
            formatOperationBytes(
                Number(
                    result.storageBytes
                ) || 0
            );


        /*
            Authenticated index item counts.
        */

        const fileCount =
            Number(
                result.fileCount
            ) || 0;

        const folderCount =
            Number(
                result.folderCount
            ) || 0;


        vaultItemCount.textContent =
            `${fileCount} ${
                fileCount === 1
                    ? 'file'
                    : 'files'
            } • ${folderCount} ${
                folderCount === 1
                    ? 'folder'
                    : 'folders'
            }`;

        if (exportVaultStorage) {
            exportVaultStorage.textContent =
                formatBytes(Number(result.storageBytes) || 0);
        }

        if (exportVaultFiles) {
            exportVaultFiles.textContent =
                String(fileCount);
        }

        if (exportVaultFolders) {
            exportVaultFolders.textContent =
                String(folderCount);
        }


        /*
            Actual Electron application version.
        */

        applicationVersion.textContent =
            result.appVersion || '—';

        if (aboutAppVersion) {
            aboutAppVersion.textContent =
                `v${result.appVersion || '1.0.0'}`;
        }


    } catch (error) {

        console.error(
            'Unable to load settings information:',
            error
        );


        vaultStorageLocation.textContent =
            'Unavailable';

        vaultStorageLocation.title =
            '';

        vaultStorageUsed.textContent =
            '—';

        vaultItemCount.textContent =
            '—';

        applicationVersion.textContent =
            '—';

        if (aboutAppVersion) {
            aboutAppVersion.textContent =
                'v1.0.0';
        }

    }

}

function showApplicationView(
    view
) {

    const showVault =
        view === 'vault';

    const showQuarantine =
        view === 'quarantine';

    const showRecoveryKey =
    view === 'recovery-key';

    const showExport =
        view === 'export';

    const showAbout =
        view === 'about';

    const showSettings =
        view === 'settings';

    const showChangePassword =
        view === 'change-password';


    /*
    Always hide the Recovery Key
    when leaving the Recovery page.
*/

if (
    recoveryKeyVisible &&
    view !== 'recovery-key'
) {

    recoveryKeyVisible = false;

    recoveryKey = null;

    recoveryKeyValue.textContent =
        'CKRV-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX';

    copyRecoveryKeyButton.disabled =
        true;

    toggleRecoveryKeyButton.innerHTML =
        EYE_ICON;

    toggleRecoveryKeyButton.title =
        'Show Recovery Key';

}

/*
        Application views.

        Exactly one main view should be
        visible at a time.
    */

    vaultView.hidden =
        !showVault;

    quarantineView.hidden =
        !showQuarantine;

    recoveryKeyView.hidden =
        !showRecoveryKey;

    if (exportView) {
        exportView.hidden =
            !showExport;
    }

    if (aboutView) {
        aboutView.hidden =
            !showAbout;
    }

    settingsView.hidden =
        !showSettings;

    if (changePasswordView) {
        changePasswordView.hidden =
            !showChangePassword;
    }


    /*
        Sidebar active state.
    */

    if (myVaultNavButton) {

        myVaultNavButton.classList.toggle(
            'active',
            showVault
        );

    }


    if (quarantineNavButton) {

        quarantineNavButton.classList.toggle(
            'active',
            showQuarantine
        );

    }

    if (recoveryKeyNavButton) {

    recoveryKeyNavButton.classList.toggle(
        'active',
        showRecoveryKey
    );

}

    if (exportNavButton) {

        exportNavButton.classList.toggle(
            'active',
            showExport
        );

    }

    if (aboutNavButton) {

        aboutNavButton.classList.toggle(
            'active',
            showAbout
        );

    }

    if (settingsNavButton) {

        settingsNavButton.classList.toggle(
            'active',
            showSettings || showChangePassword
        );

    }

    if (typeof exitSelectionMode === 'function') {
        exitSelectionMode();
    }

    if (typeof resetSearchState === 'function') {
        resetSearchState();
    }

    if (view !== 'quarantine') {
        quarantineHighlightedIdentifiers = [];
        quarantineMissingSizes = [];
        const highlightedRows = document.querySelectorAll('.quarantine-row.quarantine-highlighted');
        highlightedRows.forEach(r => r.classList.remove('quarantine-highlighted'));
    }


    /*
        Close any open menus when
        changing application views.
    */

    if (addVaultMenu) {

        addVaultMenu.classList.remove(
            'open'
        );

    }


    document
        .querySelectorAll(
            '.file-menu.open'
        )
        .forEach(menu => {

            menu.classList.remove(
                'open'
            );

        });

}

if (myVaultNavButton) {

    myVaultNavButton.addEventListener(
        'click',
        () => {

            showApplicationView(
                'vault'
            );

            if (typeof renderCurrentLocation === 'function') {

                renderCurrentLocation();

            }

        }
    );

}

if (settingsNavButton) {

    settingsNavButton.addEventListener(
        'click',
        async () => {

            showApplicationView(
                'settings'
            );


            await Promise.all([
                loadSettingsInformation(),
                loadApplicationSettings()
            ]);

        }
    );

}

if (quarantineNavButton) {

    quarantineNavButton.addEventListener(
        'click',
        async () => {

            quarantineHighlightedIdentifiers = [];
            quarantineMissingSizes = [];

            showApplicationView(
                'quarantine'
            );


            await loadQuarantinedOrphans();

        }
    );

}

if (toggleRecoveryKeyButton) {

    if (copyRecoveryKeyButton) {

    copyRecoveryKeyButton.addEventListener(
        'click',
        async () => {

            if (!recoveryKeyVisible) {
                return;
            }

            await window.crypticLocker.copyText(
                recoveryKey
            );

            const label =
                copyRecoveryKeyButton.querySelector(
                    'span'
                );

            label.textContent =
                'Copied ✓';

            setTimeout(() => {

                label.textContent =
                    'Copy Recovery Key';

            }, 2000);

        }
    );

}

    toggleRecoveryKeyButton.addEventListener(
        'click',
        toggleRecoveryKey
    );

}

if (recoveryKeyNavButton) {

    recoveryKeyNavButton.addEventListener(
        'click',
        async () => {

            showApplicationView(
                'recovery-key'
            );

        }
    );

}

if (exportNavButton) {

    exportNavButton.addEventListener(
        'click',
        async () => {

            showApplicationView(
                'export'
            );

            await updateExportViewStats();

        }
    );

}

if (aboutNavButton) {

    aboutNavButton.addEventListener(
        'click',
        async () => {

            showApplicationView(
                'about'
            );

        }
    );

}

if (openQuarantineSettingsButton) {

    openQuarantineSettingsButton.addEventListener(
        'click',
        async () => {

            quarantineHighlightedIdentifiers = [];
            quarantineMissingSizes = [];

            showApplicationView(
                'quarantine'
            );


            await loadQuarantinedOrphans();

        }
    );

}

if (openVaultStorageButton) {

    const platform =
        window.crypticLocker?.platform || 'win32';

    const explorerLabel =
        platform === 'win32'
            ? 'Open in File Explorer'
            : platform === 'darwin'
                ? 'Open in Finder'
                : 'Open in File Manager';

    openVaultStorageButton.title =
        explorerLabel;

    openVaultStorageButton.setAttribute(
        'aria-label',
        explorerLabel
    );

    openVaultStorageButton.addEventListener(
        'click',
        async () => {

            try {

                if (
                    typeof window.crypticLocker?.openVaultStorageLocation ===
                    'function'
                ) {

                    const result =
                        await window.crypticLocker
                            .openVaultStorageLocation();

                    if (
                        result &&
                        result.success === false &&
                        result.message
                    ) {

                        await showCustomAlert({
                            title: 'Storage Location',
                            message: `Unable to open storage location: ${result.message}`,
                            type: 'danger'
                        });

                    }

                }

            } catch (error) {

                console.error(
                    'Failed to open vault storage location:',
                    error
                );

            }

        }
    );

}

/* =========================================
   SETTINGS — SECURITY CONTROLS
========================================= */



/* =========================================
   CUSTOM AUTO-LOCK DROPDOWN CONTROLLER
========================================= */

function updateAutoLockDropdownUI(value) {

    const valStr = String(value);

    const labels = {
        '0': 'Never',
        '1': '1 minute',
        '5': '5 minutes',
        '15': '15 minutes',
        '30': '30 minutes'
    };

    if (autoLockSelectedText) {

        autoLockSelectedText.textContent =
            labels[valStr] || (valStr + ' minutes');

    }

    if (autoLockDropdownMenu) {

        autoLockDropdownMenu
            .querySelectorAll('.custom-dropdown-item')
            .forEach(item => {

                item.classList.toggle(
                    'active',
                    item.dataset.value === valStr
                );

            });

    }

}

function closeAutoLockDropdown() {

    if (autoLockDropdown && autoLockDropdownMenu) {

        autoLockDropdown.classList.remove('open');
        autoLockDropdownMenu.hidden = true;

        if (autoLockDropdownButton) {

            autoLockDropdownButton.setAttribute(
                'aria-expanded',
                'false'
            );

        }

    }

}

if (autoLockDropdownButton && autoLockDropdownMenu) {

    autoLockDropdownButton.addEventListener(
        'click',
        (e) => {

            e.stopPropagation();

            const isHidden =
                autoLockDropdownMenu.hidden;

            closeAllDropdownsAndMenus();

            if (isHidden) {

                autoLockDropdown.classList.add('open');
                autoLockDropdownMenu.hidden = false;
                autoLockDropdownButton.setAttribute(
                    'aria-expanded',
                    'true'
                );

            } else {

                closeAutoLockDropdown();

            }

        }
    );

    autoLockDropdownMenu
        .querySelectorAll('.custom-dropdown-item')
        .forEach(item => {

            item.addEventListener('click', () => {

                const val = item.dataset.value;

                if (autoLockSelect) {

                    autoLockSelect.value = val;
                    autoLockSelect.dispatchEvent(
                        new Event('change')
                    );

                }

                updateAutoLockDropdownUI(val);
                closeAutoLockDropdown();

            });

        });

}

/*
    AUTO-LOCK

    This step only saves the selected value.
    Actual inactivity locking will be
    implemented separately.
*/

if (autoLockSelect) {

    autoLockSelect.addEventListener(
        'change',
        async () => {

            const previousValue =
                applicationSettings
                    ?.autoLockMinutes ?? 1;


            const nextValue =
                Number(
                    autoLockSelect.value
                );


            autoLockSelect.disabled =
                true;


            try {

                const result =
                    await window
                        .crypticLocker
                        .updateSettings({

                            autoLockMinutes:
                                nextValue

                        });


                if (
                    !result ||
                    result.success !== true
                ) {

                    throw new Error(
                        result?.message ||
                        'Unable to save Auto-Lock setting.'
                    );

                }


                applicationSettings =
                    result.settings;

                if (typeof updateAutoLockDropdownUI === 'function') {
                    updateAutoLockDropdownUI(
                        applicationSettings.autoLockMinutes
                    );
                }

                /*
    Apply the new timeout immediately.
*/

resetAutoLockTimer();


                autoLockSelect.value =
                    String(
                        applicationSettings
                            .autoLockMinutes
                    );


            } catch (error) {

                console.error(
                    'Unable to save Auto-Lock setting:',
                    error
                );


                autoLockSelect.value =
                    String(
                        previousValue
                    );

            } finally {

                autoLockSelect.disabled =
                    false;

            }

        }
    );

}


/*
    LOCK WHEN COMPUTER SLEEPS

    This step only saves the toggle state.
    Actual Windows sleep detection is handled
    by Electron powerMonitor in main.js.
*/

if (lockOnSleepToggle) {

    lockOnSleepToggle.addEventListener(
        'change',
        async () => {

            const previousValue =
                applicationSettings
                    ?.lockOnSleep ?? true;


            const nextValue =
                lockOnSleepToggle.checked;


            lockOnSleepToggle.disabled =
                true;


            try {

                const result =
                    await window
                        .crypticLocker
                        .updateSettings({

                            lockOnSleep:
                                nextValue

                        });


                if (
                    !result ||
                    result.success !== true
                ) {

                    throw new Error(
                        result?.message ||
                        'Unable to save Lock on Sleep setting.'
                    );

                }


                applicationSettings =
                    result.settings;


                lockOnSleepToggle.checked =
                    applicationSettings
                        .lockOnSleep === true;


            } catch (error) {

                console.error(
                    'Unable to save Lock on Sleep setting:',
                    error
                );


                lockOnSleepToggle.checked =
                    previousValue;

            } finally {

                lockOnSleepToggle.disabled =
                    false;

            }

        }
    );

}


/*
    THEME SWITCH

    Applies instantly (via applyTheme) for a
    snappy feel, then persists to settings.json.
    Reverts on failure.
*/

function setupThemeSwitchOption(
    button,
    themeValue
) {

    if (!button) {
        return;
    }

    button.addEventListener(
        'click',
        async () => {

            const previousTheme =
                applicationSettings
                    ?.theme ?? 'dark';


            if (previousTheme === themeValue) {
                return;
            }


            applyTheme(themeValue);

            themeOptionDark.disabled = true;
            themeOptionLight.disabled = true;


            try {

                const result =
                    await window
                        .crypticLocker
                        .updateSettings({

                            theme:
                                themeValue

                        });


                if (
                    !result ||
                    result.success !== true
                ) {

                    throw new Error(
                        result?.message ||
                        'Unable to save theme setting.'
                    );

                }


                applicationSettings =
                    result.settings;


                applyTheme(
                    applicationSettings.theme
                );


            } catch (error) {

                console.error(
                    'Unable to save theme setting:',
                    error
                );


                applyTheme(previousTheme);

            } finally {

                themeOptionDark.disabled = false;
                themeOptionLight.disabled = false;

            }

        }
    );

}

setupThemeSwitchOption(
    themeOptionSystem,
    'system'
);

setupThemeSwitchOption(
    themeOptionDark,
    'dark'
);

setupThemeSwitchOption(
    themeOptionLight,
    'light'
);

/*
    LAUNCH AT STARTUP

    Controls whether CrypticLocker
    starts automatically when the
    user signs into Windows.
*/

if (launchAtStartupToggle) {

    launchAtStartupToggle.addEventListener(
        'change',
        async () => {

            const previousValue =
                applicationSettings
                    ?.launchAtStartup ?? false;

            const nextValue =
                launchAtStartupToggle.checked;

            launchAtStartupToggle.disabled =
                true;

            try {

                const result =
                    await window
                        .crypticLocker
                        .updateSettings({

                            launchAtStartup:
                                nextValue

                        });

                if (
                    !result ||
                    result.success !== true
                ) {

                    throw new Error(
                        result?.message ||
                        'Unable to save Launch at Startup setting.'
                    );

                }

                applicationSettings =
                    result.settings;

                launchAtStartupToggle.checked =
                    applicationSettings
                        .launchAtStartup === true;

            } catch (error) {

                console.error(
                    'Unable to save Launch at Startup setting:',
                    error
                );

                launchAtStartupToggle.checked =
                    previousValue;

            } finally {

                launchAtStartupToggle.disabled =
                    false;

            }

        }
    );

}

if (quarantineScanButton) {

    quarantineScanButton.addEventListener(
        'click',
        async () => {

            setQuarantineScanState(
                quarantineScanButton,
                true
            );


            try {

                await loadQuarantinedOrphans();

            } finally {

                setQuarantineScanState(
                    quarantineScanButton,
                    false
                );

            }

        }
    );

}


if (quarantineEmptyScanButton) {

    quarantineEmptyScanButton.addEventListener(
        'click',
        async () => {

            setQuarantineScanState(
                quarantineEmptyScanButton,
                true
            );


            try {

                await loadQuarantinedOrphans();

            } finally {

                setQuarantineScanState(
                    quarantineEmptyScanButton,
                    false
                );

            }

        }
    );

}

if (quarantineDeleteInvalidButton) {

    quarantineDeleteInvalidButton.addEventListener(
        'click',
        () => {

            const invalidCount =
                quarantinedOrphans.filter(
                    orphan =>
                        orphan.valid === false
                ).length;


            if (invalidCount === 0) {
                return;
            }


            openDeleteConfirmation(
                'quarantine-invalid-all',
                'all-invalid',
                `${invalidCount} invalid ${
                    invalidCount === 1
                        ? 'container'
                        : 'containers'
                }`
            );

        }
    );

}

const addVaultMenu =
    document.getElementById(
        'addVaultMenu'
    );
    
    const addVaultButton =
    document.getElementById(
        'addVaultButton'
    );

const emptyAddFileButton =
    document.getElementById(
        'emptyAddFileButton'
    );

const emptyAddFolderButton =
    document.getElementById(
        'emptyAddFolderButton'
    );

const fileActionMenu =
    document.getElementById(
        'fileActionMenu'
    );

const folderActionMenu =
    document.getElementById(
        'folderActionMenu'
    );

const moveFileButton =
    document.getElementById(
        'moveFileButton'
    );

const copyFileButton =
    document.getElementById(
        'copyFileButton'
    );

const moveFolderButton =
    document.getElementById(
        'moveFolderButton'
    );

const copyFolderButton =
    document.getElementById(
        'copyFolderButton'
    );
    
const lockVaultButton =
    document.getElementById(
        'lockVaultButton'
    );

const lockVaultShortcutLabel =
    document.getElementById(
        'lockVaultShortcutLabel'
    );

const isMacPlatform =
    window.crypticLocker.platform ===
    'darwin';

if (lockVaultShortcutLabel) {

    lockVaultShortcutLabel.textContent =
        isMacPlatform
            ? 'Cmd + L'
            : 'Ctrl + L';

}

const vaultIntegrityCheckButton =
    document.getElementById(
        'vaultIntegrityCheckButton'
    );


const vaultBreadcrumb =
    document.getElementById(
        'vaultBreadcrumb'
    );

    const operationOverlay =
    document.getElementById(
        'operationOverlay'
    );

const integrityOverlay =
    document.getElementById(
        'integrityOverlay'
    );

const integrityIcon =
    document.getElementById(
        'integrityIcon'
    );

const integrityTitle =
    document.getElementById(
        'integrityTitle'
    );

const integrityMessage =
    document.getElementById(
        'integrityMessage'
    );

const integritySpinner =
    document.getElementById(
        'integritySpinner'
    );

const integrityStatus =
    document.getElementById(
        'integrityStatus'
    );

const integrityDoneButton =
    document.getElementById(
        'integrityDoneButton'
    );
    
    const operationProcessing =
    document.getElementById(
        'operationProcessing'
    );

const operationSuccess =
    document.getElementById(
        'operationSuccess'
    );

const operationResultIcon =
    document.getElementById(
        'operationResultIcon'
    );
    
    const operationTitle =
    document.getElementById(
        'operationTitle'
    );

const operationItemName =
    document.getElementById(
        'operationItemName'
    );

const operationCurrentFile =
    document.getElementById(
        'operationCurrentFile'
    );

const operationStatusText =
    document.getElementById(
        'operationStatusText'
    );

const operationPercentage =
    document.getElementById(
        'operationPercentage'
    );

const operationPercentageValue =
    document.getElementById(
        'operationPercentageValue'
    );

const operationFinalizingSpinner =
    document.getElementById(
        'operationFinalizingSpinner'
    );
    
const operationProgressFill =
    document.getElementById(
        'operationProgressFill'
    );

const operationSize =
    document.getElementById(
        'operationSize'
    );

const operationFiles =
    document.getElementById(
        'operationFiles'
    );

const operationSpeed =
    document.getElementById(
        'operationSpeed'
    );

const operationEta =
    document.getElementById(
        'operationEta'
    );

const operationSuccessTitle =
    document.getElementById(
        'operationSuccessTitle'
    );

const operationSuccessName =
    document.getElementById(
        'operationSuccessName'
    );

const operationSuccessMessage =
    document.getElementById(
        'operationSuccessMessage'
    );

const operationOkButton =
    document.getElementById(
        'operationOkButton'
    );

const operationCancelButton =
    document.getElementById(
        'operationCancelButton'
    );

    function showIntegrityOverlay() {

    integrityOverlay.hidden = false;

}


function hideIntegrityOverlay() {

    integrityOverlay.hidden = true;

}


function setIntegrityLoadingState() {

    integrityFooter.hidden =
    true;

integrityDetails.hidden =
    true;

integrityDetailsList.innerHTML =
    '';

integrityDetailsButton.textContent =
    'View Details';
    
    integrityIcon.className =
        'integrity-icon';

    integrityTitle.textContent =
        'Checking Vault Integrity';

    integrityMessage.textContent =
        'Please wait while CrypticLocker verifies your encrypted vault.';

    integrityStatus.textContent =
        'Verifying vault structure...';

    integrityStatus.hidden =
        false;

    integritySpinner.hidden =
        false;

    integrityDoneButton.hidden =
        true;

}

function setIntegrityResultState(
    result
) {

    integrityDetailsList.innerHTML =
    '';

for (
    const file of
    (result?.report?.containers?.missing || [])
) {

    const item =
        document.createElement(
            'div'
        );

    item.className =
        'integrity-detail-item';

    const fileName =
        typeof file === 'string'
            ? file
            : (file?.name || file?.id || 'Missing container');

    item.innerHTML = `
        ${getFileIconSvg(fileName, 'integrity-detail-icon')}
        <span>${fileName}</span>
    `;

    integrityDetailsList.appendChild(
        item
    );

}

    integritySpinner.hidden =
        true;

    integrityDoneButton.hidden =
        false;

    integrityStatus.textContent =
        '';

    integrityStatus.hidden =
        true;

    if (result.passed) {

        integrityIcon.className =
            'integrity-icon success';

        integrityTitle.textContent =
            'Vault Healthy';

        integrityMessage.textContent =
            'No integrity issues were detected. Your encrypted vault passed all security checks.';

        integrityFooter.hidden =
    false;

integrityDetailsButton.hidden =
    true;
    }

    else {

        integrityIcon.className =
            'integrity-icon warning';

        integrityTitle.textContent =
            'Integrity Issues Detected';

        integrityMessage.textContent =
            result.summary.message;

        integrityFooter.hidden =
    false;

integrityDetailsButton.hidden =
    false;

    }

}

function showOperationResult({
    type = 'success',
    title = 'Successfully completed',
    name = '',
    message = ''
} = {}) {

    /*
        Supported result types:

        success
        failure
        attention
    */

    const safeType =
        (
            type === 'failure' ||
            type === 'attention'
        )
            ? type
            : 'success';


    operationProcessing.hidden =
        true;

    operationSuccess.hidden =
        false;

    operationOverlay.hidden =
        false;


    operationResultIcon.classList.remove(
        'success',
        'failure',
        'attention'
    );

    operationResultIcon.classList.add(
        safeType
    );


    operationSuccessTitle.textContent =
        title;

    operationSuccessName.textContent =
        name;

    operationSuccessMessage.textContent =
        message;

}


/* =========================================
   BUTTON LOADING SPINNER HELPER
========================================= */

function setButtonLoading(button, isLoading, fallbackText = '') {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
        }
        button.innerHTML = `
            <svg class="btn-icon-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; margin: auto; display: block;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
        `;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        } else if (fallbackText) {
            const span = button.querySelector('span');
            if (span) {
                span.textContent = fallbackText;
            } else {
                button.textContent = fallbackText;
            }
        }
    }
}

/* =========================================
   CUSTOM ALERT / NOTIFICATION MODAL
========================================= */

const customAlertOverlay =
    document.getElementById(
        'customAlertOverlay'
    );

const customAlertIcon =
    document.getElementById(
        'customAlertIcon'
    );

const customAlertTitle =
    document.getElementById(
        'customAlertTitle'
    );

const customAlertMessage =
    document.getElementById(
        'customAlertMessage'
    );

const customAlertDetails =
    document.getElementById(
        'customAlertDetails'
    );

const customAlertDetailsList =
    document.getElementById(
        'customAlertDetailsList'
    );

const customAlertOkButton =
    document.getElementById(
        'customAlertOkButton'
    );

let resolveCustomAlert = null;

function showCustomAlert(
    messageOrOptions,
    optionalTitle = 'Notice',
    optionalType = 'warning'
) {

    return new Promise(resolve => {

        resolveCustomAlert = resolve;

        let title = optionalTitle;
        let message = '';
        let type = optionalType;
        let details = null;
        let buttonText = 'OK';

        if (
            typeof messageOrOptions === 'object' &&
            messageOrOptions !== null
        ) {
            title = messageOrOptions.title || optionalTitle;
            message = messageOrOptions.message || '';
            type = messageOrOptions.type || optionalType;
            details = messageOrOptions.details || null;
            buttonText = messageOrOptions.buttonText || 'OK';
        } else {
            message = String(messageOrOptions || '');
        }

        if (customAlertTitle) {
            customAlertTitle.textContent = title;
        }

        if (customAlertMessage) {
            customAlertMessage.textContent = message;
        }

        if (customAlertOkButton) {
            const span =
                customAlertOkButton.querySelector('span');
            if (span) {
                span.textContent = buttonText;
            } else {
                customAlertOkButton.textContent = buttonText;
            }
        }

        if (customAlertIcon) {
            customAlertIcon.className =
                'custom-alert-icon ' + type;

            if (type === 'danger') {
                customAlertIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                `;
            } else if (type === 'success') {
                customAlertIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                `;
            } else if (type === 'info') {
                customAlertIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                `;
            } else {
                customAlertIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                `;
            }
        }

        if (customAlertDetails && customAlertDetailsList) {
            if (Array.isArray(details) && details.length > 0) {
                customAlertDetailsList.innerHTML = '';
                for (const item of details) {
                    const div =
                        document.createElement('div');
                    div.className =
                        'custom-alert-detail-item';
                    div.textContent =
                        typeof item === 'string'
                            ? item
                            : `• ${item.name || item.id}: ${item.message || item.reason || ''}`;
                    customAlertDetailsList.appendChild(div);
                }
                customAlertDetails.hidden = false;
            } else {
                customAlertDetails.hidden = true;
                customAlertDetailsList.innerHTML = '';
            }
        }

        if (customAlertOverlay) {
            customAlertOverlay.hidden = false;
        }

        if (customAlertOkButton) {
            customAlertOkButton.focus();
        }

    });

}

function closeCustomAlert() {

    if (customAlertOverlay) {
        customAlertOverlay.hidden = true;
    }

    if (resolveCustomAlert) {
        resolveCustomAlert(true);
        resolveCustomAlert = null;
    }

}

if (customAlertOkButton) {

    customAlertOkButton.addEventListener(
        'click',
        () => {
            closeCustomAlert();
        }
    );

}

if (customAlertOverlay) {

    customAlertOverlay.addEventListener(
        'click',
        event => {
            if (event.target === customAlertOverlay) {
                closeCustomAlert();
            }
        }
    );

}

document.addEventListener(
    'keydown',
    event => {

        if (
            event.key === 'Escape' &&
            customAlertOverlay &&
            customAlertOverlay.hidden === false
        ) {
            closeCustomAlert();
        }

    }
);

window.alert = function (message) {
    return showCustomAlert(message);
};

/*
    Delete confirmation panel.
*/

const deleteConfirmOverlay =
    document.getElementById(
        'deleteConfirmOverlay'
    );

const deleteConfirmTitle =
    document.getElementById(
        'deleteConfirmTitle'
    );

const deleteConfirmName =
    document.getElementById(
        'deleteConfirmName'
    );

const deleteConfirmMessage =
    document.getElementById(
        'deleteConfirmMessage'
    );

const deleteCancelButton =
    document.getElementById(
        'deleteCancelButton'
    );

const deleteConfirmButton =
    document.getElementById(
        'deleteConfirmButton'
    );

const restoreWarningOverlay =
    document.getElementById(
        'restoreWarningOverlay'
    );

const restoreWarningTitle =
    document.getElementById(
        'restoreWarningTitle'
    );

const restoreWarningMessage =
    document.getElementById(
        'restoreWarningMessage'
    );

const restoreWarningSubmessage =
    document.getElementById(
        'restoreWarningSubmessage'
    );

const restoreWarningDetails =
    document.getElementById(
        'restoreWarningDetails'
    );

const restoreWarningDetailsList =
    document.getElementById(
        'restoreWarningDetailsList'
    );

const restoreWarningDetailsButton =
    document.getElementById(
        'restoreWarningDetailsButton'
    );

const restoreWarningCancelButton =
    document.getElementById(
        'restoreWarningCancelButton'
    );

const restoreWarningCheckQuarantineButton =
    document.getElementById(
        'restoreWarningCheckQuarantineButton'
    );

const restoreWarningContinueButton =
    document.getElementById(
        'restoreWarningContinueButton'
    );

let resolveRestoreWarning = null;
let quarantineHighlightedIdentifiers = [];
let quarantineMissingSizes = [];

function extractMissingIdentifiers(status) {
    const ids = new Set();
    const sizes = [];
    if (!status) return [];

    function addEntry(item) {
        if (!item) return;
        if (item.id) ids.add(String(item.id).toLowerCase().trim());
        if (item.encryptedFile) {
            const enc = String(item.encryptedFile).toLowerCase().trim();
            ids.add(enc);
            const encBase = enc.includes('.') ? enc.substring(0, enc.lastIndexOf('.')) : enc;
            if (encBase) ids.add(encBase);
        }
        if (item.name) {
            const strName = String(item.name).toLowerCase().trim();
            ids.add(strName);
            const base = strName.includes('.') ? strName.substring(0, strName.lastIndexOf('.')) : strName;
            if (base && base.length > 1) ids.add(base);
        }
        if (typeof item.size === 'number' && item.size > 0) {
            sizes.push(item.size);
        }
        const rawStr = `${item.id || ''} ${item.encryptedFile || ''} ${item.name || ''}`;
        const uuidMatches = rawStr.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi);
        if (uuidMatches) {
            uuidMatches.forEach(u => ids.add(u.toLowerCase().trim()));
        }
    }

    if (Array.isArray(status.issueItems)) {
        status.issueItems.forEach(addEntry);
    }
    if (Array.isArray(status.rootFileIssues)) {
        status.rootFileIssues.forEach(addEntry);
    }
    if (Array.isArray(status.folderIssues)) {
        status.folderIssues.forEach(f => {
            addEntry(f);
            if (Array.isArray(f.missingFiles)) {
                f.missingFiles.forEach(addEntry);
            }
        });
    }
    quarantineMissingSizes = sizes;
    return Array.from(ids);
}

function highlightQuarantinedOrphans(identifiers) {
    quarantineHighlightedIdentifiers = Array.isArray(identifiers) ? identifiers : [];
    showApplicationView('quarantine');
    if (quarantineNavButton) {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
        quarantineNavButton.classList.add('active');
    }
    loadQuarantinedOrphans();
}

function showRestoreWarning(status) {

    return new Promise(resolve => {

        resolveRestoreWarning = resolve;

        const totalFiles =
            typeof status.totalFilesCount === 'number'
                ? status.totalFilesCount
                : status.totalFiles || status.totalItems || 0;

        const missingFiles =
            typeof status.missingFilesCount === 'number'
                ? status.missingFilesCount
                : status.issueCount || (status.issueItems ? status.issueItems.length : 0);

        const verifiedFiles =
            typeof status.verifiedFilesCount === 'number'
                ? status.verifiedFilesCount
                : Math.max(0, totalFiles - missingFiles);

        const foldersCount =
            typeof status.selectedFoldersCount === 'number'
                ? status.selectedFoldersCount
                : 0;

        const filesCount =
            typeof status.selectedFilesCount === 'number'
                ? status.selectedFilesCount
                : 0;

        restoreWarningTitle.textContent =
            'Restore Warning';

        // Precise human-friendly summary text
        if (foldersCount > 0 && filesCount > 0) {
            const folderPart = `${foldersCount} ${foldersCount === 1 ? 'folder' : 'folders'}`;
            const filePart = `${filesCount} root ${filesCount === 1 ? 'file' : 'files'}`;
            if (missingFiles === totalFiles) {
                restoreWarningMessage.textContent =
                    `All ${totalFiles} files in your selection (${folderPart}, ${filePart}) cannot be restored because encrypted containers are missing.`;
            } else {
                restoreWarningMessage.textContent =
                    `${missingFiles} of ${totalFiles} files across ${folderPart} and ${filePart} cannot be restored because encrypted containers are missing.`;
            }
        } else if (foldersCount === 1 && filesCount === 0) {
            const folderName =
                status.folderIssues && status.folderIssues[0]
                    ? `in "${status.folderIssues[0].name}"`
                    : 'in folder';
            if (missingFiles === totalFiles) {
                restoreWarningMessage.textContent =
                    `All ${totalFiles} files ${folderName} cannot be restored because encrypted containers are missing.`;
            } else {
                restoreWarningMessage.textContent =
                    `${missingFiles} of ${totalFiles} files ${folderName} cannot be restored because encrypted containers are missing.`;
            }
        } else if (foldersCount > 1 && filesCount === 0) {
            if (missingFiles === totalFiles) {
                restoreWarningMessage.textContent =
                    `All ${totalFiles} files across ${foldersCount} selected folders cannot be restored because encrypted containers are missing.`;
            } else {
                restoreWarningMessage.textContent =
                    `${missingFiles} of ${totalFiles} files across ${foldersCount} selected folders cannot be restored because encrypted containers are missing.`;
            }
        } else {
            // Root files only
            const filePart = `${totalFiles} root ${totalFiles === 1 ? 'file' : 'files'}`;
            if (missingFiles === totalFiles) {
                restoreWarningMessage.textContent =
                    `All ${totalFiles} selected root ${totalFiles === 1 ? 'file' : 'files'} cannot be restored because encrypted containers are missing.`;
            } else {
                restoreWarningMessage.textContent =
                    `${missingFiles} of ${filePart} cannot be restored because encrypted containers are missing.`;
            }
        }

        if (verifiedFiles > 0) {

            restoreWarningSubmessage.textContent =
                `Only ${verifiedFiles} verified ${
                    verifiedFiles === 1 ? 'file' : 'files'
                } with intact containers will be restored. Missing files will be skipped.`;

            restoreWarningContinueButton.hidden =
                false;

            restoreWarningContinueButton.disabled =
                false;

        } else {

            restoreWarningSubmessage.textContent =
                'None of the selected items can be restored because their encrypted containers are missing.';

            restoreWarningContinueButton.hidden =
                true;

            restoreWarningContinueButton.disabled =
                true;

        }

        restoreWarningDetailsList.innerHTML =
            '';

        // 1. Render Folder Issues (Hierarchical & Grouped)
        if (Array.isArray(status.folderIssues) && status.folderIssues.length > 0) {

            for (const f of status.folderIssues) {

                const group =
                    document.createElement('div');

                group.className =
                    'restore-warning-group' + (f.allMissing ? ' entire-missing' : '');

                const header =
                    document.createElement('div');

                header.className =
                    'restore-warning-group-header';

                const badgeClass =
                    f.allMissing ? 'danger' : 'warning';

                const badgeText =
                    f.allMissing
                        ? `All ${f.totalFiles} files missing`
                        : `${f.missingCount} of ${f.totalFiles} files missing`;

                header.innerHTML = `
                    <svg class="restore-warning-folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
                        <path d="M4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20Z" />
                    </svg>
                    <span class="restore-warning-group-title">${f.name}</span>
                    <span class="restore-warning-badge ${badgeClass}">${badgeText}</span>
                `;

                group.appendChild(header);

                // If only partial files missing, list the specific missing child files
                if (!f.allMissing && Array.isArray(f.missingFiles) && f.missingFiles.length > 0) {

                    const subfiles =
                        document.createElement('div');

                    subfiles.className =
                        'restore-warning-subfiles';

                    for (const sub of f.missingFiles) {

                        const subItem =
                            document.createElement('div');

                        subItem.className =
                            'restore-warning-subfile-item';

                        subItem.innerHTML = `
                            ${getFileIconSvg(sub.name, 'restore-warning-subfile-icon')}
                            <span>${sub.name}</span>
                        `;

                        subfiles.appendChild(subItem);

                    }

                    group.appendChild(subfiles);

                }

                restoreWarningDetailsList.appendChild(group);

            }

        }

        // 2. Render Root Standalone File Issues
        if (Array.isArray(status.rootFileIssues) && status.rootFileIssues.length > 0) {

            for (const item of status.rootFileIssues) {

                const row =
                    document.createElement('div');

                row.className =
                    'restore-warning-item';

                row.innerHTML = `
                    ${getFileIconSvg(item.name, 'restore-warning-item-icon')}
                    <span class="restore-warning-item-name">${item.name}</span>
                    <span class="restore-warning-badge danger">Missing</span>
                `;

                restoreWarningDetailsList.appendChild(row);

            }

        }

        // 3. Fallback for flat issueItems if neither folderIssues nor rootFileIssues were provided
        if (
            (!status.folderIssues || status.folderIssues.length === 0) &&
            (!status.rootFileIssues || status.rootFileIssues.length === 0) &&
            Array.isArray(status.issueItems) &&
            status.issueItems.length > 0
        ) {

            for (const item of status.issueItems) {

                const row =
                    document.createElement('div');

                row.className =
                    'restore-warning-item';

                row.innerHTML = `
                    <svg class="restore-warning-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
                        <path d="M8 3H15L20 8V21H8Z" />
                        <path d="M15 3V8H20" />
                    </svg>
                    <span class="restore-warning-item-name">${item.name || item.id}</span>
                    <span class="restore-warning-badge danger">Missing</span>
                `;

                restoreWarningDetailsList.appendChild(row);

            }

        }

        restoreWarningDetails.hidden =
            true;

        restoreWarningDetailsButton.textContent =
            'View Details';

        restoreWarningOverlay.hidden =
            false;

        if (verifiedFiles > 0) {
            restoreWarningContinueButton.focus();
        } else {
            restoreWarningCancelButton.focus();
        }

    });

}

function closeRestoreWarning(action) {

    restoreWarningOverlay.hidden =
        true;

    if (resolveRestoreWarning) {

        resolveRestoreWarning(action);

        resolveRestoreWarning = null;

    }

}

if (restoreWarningDetailsButton) {

    restoreWarningDetailsButton.addEventListener(
        'click',
        () => {

            const expanded =
                !restoreWarningDetails.hidden;

            restoreWarningDetails.hidden =
                expanded;

            restoreWarningDetailsButton.textContent =
                expanded
                    ? 'View Details'
                    : 'Hide Details';

        }
    );

}

if (restoreWarningCancelButton) {

    restoreWarningCancelButton.addEventListener(
        'click',
        () => {

            closeRestoreWarning('cancel');

        }
    );

}

if (restoreWarningCheckQuarantineButton) {

    restoreWarningCheckQuarantineButton.addEventListener(
        'click',
        () => {

            closeRestoreWarning('check-quarantine');

        }
    );

}

if (restoreWarningContinueButton) {

    restoreWarningContinueButton.addEventListener(
        'click',
        () => {

            closeRestoreWarning('continue');

        }
    );

}

if (restoreWarningOverlay) {

    restoreWarningOverlay.addEventListener(
        'click',
        event => {

            if (event.target === restoreWarningOverlay) {

                closeRestoreWarning('cancel');

            }

        }
    );

}

const restoreConfirmOverlay =
    document.getElementById(
        'restoreConfirmOverlay'
    );

const restoreConfirmTitle =
    document.getElementById(
        'restoreConfirmTitle'
    );

const restoreConfirmName =
    document.getElementById(
        'restoreConfirmName'
    );

const restoreConfirmMessage =
    document.getElementById(
        'restoreConfirmMessage'
    );

const restoreConfirmCheckbox =
    document.getElementById(
        'restoreConfirmCheckbox'
    );

const restoreConfirmCheckboxLabel =
    document.getElementById(
        'restoreConfirmCheckboxLabel'
    );

const restoreCancelButton =
    document.getElementById(
        'restoreCancelButton'
    );

const restoreConfirmButton =
    document.getElementById(
        'restoreConfirmButton'
    );


/*
    RESTORE / RECOVER CONFIRMATION

    Promise-based helper so call sites can
    simply:

        const choice =
            await showRestoreConfirm({...});

        if (!choice.confirmed) return;

    Only one confirmation can be open at a
    time, which matches how the rest of the
    app's modals behave.
*/

let resolveRestoreConfirm = null;

function showRestoreConfirm({
    title,
    name,
    message,
    checkboxLabel,
    confirmText = 'Restore'
}) {

    return new Promise(resolve => {

        resolveRestoreConfirm = resolve;

        restoreConfirmTitle.textContent =
            title ||
            'Restore file?';

        restoreConfirmName.textContent =
            name ||
            '';

        restoreConfirmMessage.textContent =
            message ||
            'The file will be decrypted to the location you choose.';

        restoreConfirmCheckboxLabel.textContent =
            checkboxLabel ||
            'Also remove the encrypted copy from the vault';

        restoreConfirmCheckbox.checked =
            false;

        // Reset button state and text
        setButtonLoading(restoreConfirmButton, false, confirmText);

        restoreConfirmOverlay.hidden =
            false;

        restoreConfirmButton.focus();

    });

}

function closeRestoreConfirm(confirmed) {

    restoreConfirmOverlay.hidden =
        true;

    setButtonLoading(restoreConfirmButton, false, 'Restore');

    if (resolveRestoreConfirm) {

        resolveRestoreConfirm({

            confirmed,

            removeFromVault:
                confirmed &&
                restoreConfirmCheckbox.checked ===
                true

        });

        resolveRestoreConfirm = null;

    }

}

restoreCancelButton.addEventListener(
    'click',
    () => {

        closeRestoreConfirm(false);

    }
);

restoreConfirmButton.addEventListener(
    'click',
    () => {

        if (!resolveRestoreConfirm) return;

        setButtonLoading(restoreConfirmButton, true);

        const resolve = resolveRestoreConfirm;
        resolveRestoreConfirm = null;

        resolve({
            confirmed: true,
            removeFromVault:
                restoreConfirmCheckbox.checked === true
        });

    }
);

restoreConfirmOverlay.addEventListener(
    'click',
    event => {

        if (event.target === restoreConfirmOverlay) {

            closeRestoreConfirm(false);

        }

    }
);

document.addEventListener(
    'keydown',
    event => {

        if (
            event.key === 'Escape' &&
            restoreConfirmOverlay.hidden === false
        ) {

            closeRestoreConfirm(false);

        }

    }
);


let vaultFiles = [];
let vaultFolders = [];
let applicationSettings = null;


/* =========================================
   AUTO LOCK
========================================= */

let autoLockTimer =
    null;


/*
    Number of operations currently running.

    Auto-Lock will never trigger while
    protected vault operations are active.
*/

let activeVaultOperations =
    0;
    
    /*
    Tracks every active vault operation.

    Using a Set allows multiple protected
    operations to run safely in the future.
*/

const activeOperationIds =
    new Set();

let currentOperationId =
    null;
    
    /*
    Currently selected item waiting for
    permanent deletion confirmation.

    Shape:

    {
        type: 'file' | 'folder' | 'quarantine',
        id: string,
        name: string
    }
*/

let pendingDeleteTarget =
    null;
    
    /*
    null = root My Vault

    otherwise:
    {
        folderId,
        relativePath
    }
*/

let currentLocation = null;

function openDeleteConfirmation(
    type,
    id,
    name,
    items
) {

    if (
    type !== 'file' &&
    type !== 'folder' &&
    type !== 'quarantine' &&
    type !== 'quarantine-invalid-all' &&
    type !== 'bulk'
) {

    return;

}


    if (
        type === 'bulk'
    ) {

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return;

        }


        pendingDeleteTarget = {
            type,
            items
        };


        deleteConfirmTitle.textContent =
            `Delete ${items.length} ${
                items.length === 1
                    ? 'item'
                    : 'items'
            }?`;

        deleteConfirmName.textContent =
            `${items.length} ${
                items.length === 1
                    ? 'item'
                    : 'items'
            } selected`;

        deleteConfirmMessage.textContent =
            'These files and folders will be permanently removed from your encrypted vault. This action cannot be undone.';


        deleteConfirmOverlay.hidden =
            false;


        return;

    }


    if (
        typeof id !== 'string' ||
        !id
    ) {

        return;

    }


    pendingDeleteTarget = {
        type,
        id,
        name:
            String(
                name ||
                (
                    type === 'folder'
                        ? 'Folder'
                        : type === 'quarantine'
                            ? 'Quarantined container'
                            : 'File'
                )
            )
    };


    const isFolder =
        type === 'folder';

    const isQuarantine =
        type === 'quarantine';


    const isBulkInvalid =
    type === 'quarantine-invalid-all';
    
    deleteConfirmTitle.textContent =
    isBulkInvalid
        ? 'Delete all invalid containers?'
        : isFolder
            ? 'Delete folder?'
            : isQuarantine
                ? 'Delete quarantined container?'
                : 'Delete file?';


    deleteConfirmName.textContent =
        pendingDeleteTarget.name;


    deleteConfirmMessage.textContent =
    isBulkInvalid
        ? 'All invalid quarantined containers will be permanently deleted. Possible Valid containers will not be affected. This action cannot be undone.'
        : isFolder
            ? 'This folder and all encrypted files inside it will be permanently removed from your encrypted vault.'
            : isQuarantine
                ? 'This quarantined encrypted container will be permanently deleted. This action cannot be undone.'
                : 'This file will be permanently removed from your encrypted vault.';


    deleteConfirmOverlay.hidden =
        false;

}

function closeDeleteConfirmation() {

    deleteConfirmOverlay.hidden =
        true;


    pendingDeleteTarget =
        null;


    deleteCancelButton.disabled =
        false;

    deleteConfirmButton.disabled =
        false;


    const deleteButtonText =
        deleteConfirmButton.querySelector(
            'span'
        );


    if (deleteButtonText) {

        deleteButtonText.textContent =
            'Delete';

    }

}

deleteCancelButton.addEventListener(
    'click',
    () => {

        closeDeleteConfirmation();

    }
);

deleteConfirmButton.addEventListener(
    'click',
    async () => {

        if (!pendingDeleteTarget) {
            return;
        }


        /*
            Snapshot the target before closing
            or changing confirmation state.
        */

        const target = {
            ...pendingDeleteTarget
        };


        deleteCancelButton.disabled =
            true;

        deleteConfirmButton.disabled =
            true;


        const deleteButtonText =
            deleteConfirmButton.querySelector(
                'span'
            );


        if (deleteButtonText) {

            deleteButtonText.textContent =
                'Deleting...';

        }


        /*
    Confirmation is complete.

    From this point the centralized operation
    panel owns the operation UI.
*/

deleteConfirmOverlay.hidden =
    true;
    
    try {

            let result;


            if (
    target.type ===
    'folder'
) {

    result =
        await window
            .crypticLocker
            .deleteFolder(
                target.id
            );

} else if (
    target.type ===
    'quarantine'
) {

    result =
        await window
            .crypticLocker
            .deleteQuarantinedOrphan(
                target.id
            );


    closeDeleteConfirmation();


    /*
        Single quarantine deletion does not
        use the normal vault delete progress
        flow, so show its terminal result here.
    */

    if (
        result?.success === true
    ) {

        await loadQuarantinedOrphans();


        showOperationResult({

            type:
                'success',

            title:
                'Container deleted successfully',

            name:
                target.name,

            message:
                'The quarantined container was permanently deleted.'

        });


        return;

    }


    showOperationResult({

        type:
            'failure',

        title:
            'Container deletion failed',

        name:
            target.name,

        message:
            result?.message ||
            'The quarantined container could not be deleted.'

    });


    return;

} else if (
    target.type ===
    'quarantine-invalid-all'
) {

    result =
        await window
            .crypticLocker
            .deleteAllInvalidQuarantinedOrphans();


    /*
        Bulk invalid-container deletion does
        not use the normal progress-event flow.

        Handle its structured terminal result
        here using the reusable operation panel.
    */

    closeDeleteConfirmation();


    const deletedCount =
        Number(
            result?.deletedCount
        ) || 0;


    const failedCount =
        Number(
            result?.failedCount
        ) || 0;


    /*
        Always refresh quarantine from the
        backend after a bulk-delete attempt.

        This also handles partial deletion.
    */

    await loadQuarantinedOrphans();


    if (
        result?.success === true &&
        failedCount === 0
    ) {

        showOperationResult({

            type:
                'success',

            title:
                'Invalid containers deleted',

            name:
                `${deletedCount} ${
                    deletedCount === 1
                        ? 'container'
                        : 'containers'
                } deleted`,

            message:
                deletedCount === 1
                    ? 'The invalid quarantined container was permanently deleted.'
                    : 'The invalid quarantined containers were permanently deleted.'

        });


        return;

    }


    if (
        deletedCount > 0 &&
        failedCount > 0
    ) {

        showOperationResult({

            type:
                'attention',

            title:
                'Deletion partially completed',

            name:
                `${deletedCount} deleted • ${failedCount} failed`,

            message:
                'Some invalid quarantined containers could not be deleted.'

        });


        return;

    }


    showOperationResult({

        type:
            'failure',

        title:
            'Invalid containers could not be deleted',

        name:
            failedCount === 1
                ? '1 container failed'
                : `${failedCount} containers failed`,

        message:
            result?.message ||
            'No invalid quarantined containers were deleted.'

    });


    return;

} else if (
    target.type ===
    'bulk'
) {

    result =
        await window
            .crypticLocker
            .bulkDeleteItems(
                target.items
            );


    closeDeleteConfirmation();


    const deletedCount =
        Number(
            result?.deletedCount
        ) || 0;


    const failedCount =
        Array.isArray(
            result?.failures
        )
            ? result.failures.length
            : 0;


    /*
        Always refresh the vault view and
        exit selection mode after a bulk
        delete attempt, success or not.
    */

    exitSelectionMode();

    await loadVaultFiles();


    if (
        result?.success === true &&
        failedCount === 0
    ) {

        showOperationResult({

            type:
                'success',

            title:
                'Items deleted successfully',

            name:
                `${deletedCount} ${
                    deletedCount === 1
                        ? 'item'
                        : 'items'
                } deleted`,

            message:
                'The selected items were permanently removed from your encrypted vault.'

        });


        return;

    }


    if (
        deletedCount > 0 &&
        failedCount > 0
    ) {

        showOperationResult({

            type:
                'attention',

            title:
                'Deletion partially completed',

            name:
                `${deletedCount} deleted • ${failedCount} failed`,

            message:
                'Some selected items could not be deleted.'

        });


        return;

    }


    showOperationResult({

        type:
            'failure',

        title:
            'Items could not be deleted',

        name:
            failedCount === 1
                ? '1 item failed'
                : `${failedCount} items failed`,

        message:
            result?.message ||
            'No selected items were deleted.'

    });


    return;

} else {

    result =
        await window
            .crypticLocker
            .deleteFile(
                target.id
            );

}


            /*
                Once the IPC operation has been
                accepted, the confirmation panel
                is no longer needed.

                The centralized operation panel
                owns success/failure UI.
            */

            closeDeleteConfirmation();


            if (!result.success) {

                /*
                    If operationId exists, main.js
                    already started the operation
                    and sent a standardized failed
                    progress event.

                    Do not show a duplicate alert.
                */

                if (
    result.operationFailed ===
    true
) {

    return;

}


                await showCustomAlert({
                    title: 'Delete Failed',
                    message: result.message || (
                        target.type === 'folder'
                            ? 'Unable to delete folder.'
                            : target.type === 'quarantine'
                                ? 'Unable to delete quarantined container.'
                                : 'Unable to delete file.'
                    ),
                    type: 'danger'
                });

                return;

            }


            /*
                Reload the authenticated index.

                Never manually remove the row from
                DOM because index.clm remains the
                source of truth.
            */

            if (
                target.type === 'quarantine' ||
                target.type === 'quarantine-invalid-all'
            ) {

                await loadQuarantinedOrphans();

            } else {

                await loadVaultFiles(
                    true
                );

            }


        } catch (error) {

            console.error(
                'Delete renderer error:',
                error
            );


            closeDeleteConfirmation();


            await showCustomAlert({
                title: 'Delete Failed',
                message: target.type === 'folder'
                    ? 'Unable to delete folder.'
                    : target.type === 'quarantine'
                        ? 'Unable to delete quarantined container.'
                        : 'Unable to delete file.',
                type: 'danger'
            });

        }

    }
);

deleteConfirmOverlay.addEventListener(
    'click',
    event => {

        if (
            event.target ===
            deleteConfirmOverlay
        ) {

            closeDeleteConfirmation();

        }

    }
);

document.addEventListener(
    'keydown',
    event => {

        if (
            event.key !== 'Escape' ||
            deleteConfirmOverlay.hidden
        ) {

            return;

        }


        closeDeleteConfirmation();

    }
);

/* =========================================
   SMOOTH SCROLL ENGINE
========================================= */

function enableSmoothScrolling(container) {

    if (!container) {

        return;

    }

    let targetScroll =
        container.scrollTop;

    let animationFrame =
        null;

    let isAnimating =
        false;

    const animate = () => {

        const current =
            container.scrollTop;

        const difference =
            targetScroll - current;

        const maxScroll =
            Math.max(
                0,
                container.scrollHeight -
                container.clientHeight
            );

        if (
            Math.abs(difference) < 0.5 ||
            (difference < 0 && targetScroll === 0 && current <= 6) ||
            (difference > 0 && targetScroll === maxScroll && current >= maxScroll - 6)
        ) {

            isAnimating = true;

            container.scrollTop =
                targetScroll;

            isAnimating = false;

            animationFrame = null;

            return;

        }

        isAnimating = true;

        container.scrollTop =
            current + difference * 0.18;

        isAnimating = false;

        animationFrame =
            requestAnimationFrame(
                animate
            );

    };

    container.addEventListener(
        'wheel',
        event => {

            const maxScroll =
                Math.max(
                    0,
                    container.scrollHeight -
                    container.clientHeight
                );

            if (maxScroll <= 0) {

                return;

            }

            event.preventDefault();

            if (!animationFrame) {

                targetScroll =
                    container.scrollTop;

            }

            targetScroll +=
                event.deltaY;

            /*
                Near-edge snapping threshold (50px).
                Guarantees the scroll target reaches 0 at top
                and maxScroll at bottom, completely preventing
                any fractional row clipping.
            */
            if (event.deltaY < 0 && targetScroll < 50) {

                targetScroll = 0;

            } else if (event.deltaY > 0 && targetScroll > maxScroll - 50) {

                targetScroll = maxScroll;

            } else {

                targetScroll =
                    Math.max(
                        0,
                        Math.min(
                            targetScroll,
                            maxScroll
                        )
                    );

            }

            if (!animationFrame) {

                animationFrame =
                    requestAnimationFrame(
                        animate
                    );

            }

        },
        {
            passive: false
        }
    );

    container.addEventListener(
        'scroll',
        () => {

            if (!isAnimating && !animationFrame) {

                targetScroll =
                    container.scrollTop;

            }

        },
        {
            passive: true
        }
    );

}

/* =========================================
   CHECK VAULT SESSION
========================================= */

async function initializeDashboard() {

    try {

        const session =
            await window.crypticLocker
                .getSessionStatus();


        if (!session.unlocked) {

            window.location.replace(
                'index.html'
            );

            return;

        }


        /*
            Session valid.
            Load encrypted vault metadata.
        */

        await loadApplicationSettings();
        await loadVaultFiles();

        /*
    User successfully entered the vault.

    Start inactivity protection.
*/

resetAutoLockTimer();

    } catch (error) {

        console.error(
            'Dashboard initialization failed:',
            error
        );


        window.location.replace(
            'index.html'
        );

    }

}


async function loadVaultFiles(
    preserveLocation = false
) {

    const result =
        await window.crypticLocker
            .getFiles();


    if (!result.success) {

        throw new Error(
            result.message ||
            'Unable to load vault.'
        );

    }


    vaultFiles =
        Array.isArray(result.files)
            ? result.files
            : [];


    vaultFolders =
        Array.isArray(result.folders)
            ? result.folders
            : [];


    /*
    Initial load starts at root.

    Refresh operations may preserve the
    folder currently being viewed.
*/

if (!preserveLocation) {

    currentLocation = null;

}


renderCurrentLocation();

}

function formatOperationBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {
        return '0 B';
    }


    const units = [
        'B',
        'KB',
        'MB',
        'GB',
        'TB'
    ];


    const index =
        Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            index
        );


    return `${
        value >= 100
            ? value.toFixed(0)
            : value >= 10
                ? value.toFixed(1)
                : value.toFixed(2)
    } ${units[index]}`;

}


function formatOperationEta(
    seconds
) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return '—';
    }


    if (seconds < 1) {
        return '< 1 sec';
    }


    if (seconds < 60) {

        return `${Math.ceil(seconds)} sec`;

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        Math.ceil(
            seconds % 60
        );


    if (minutes < 60) {

        return remainingSeconds > 0
            ? `${minutes}m ${remainingSeconds}s`
            : `${minutes}m`;

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remainingMinutes =
        minutes % 60;


    return `${hours}h ${remainingMinutes}m`;

}

function openChangePasswordDialog() {

    showApplicationView(
        'change-password'
    );

    currentPasswordInput.value =
        '';

    newPasswordInput.value =
        '';

    confirmPasswordInput.value =
        '';

    setChangePasswordError('');

    currentPasswordInput.focus();

    document
    .querySelectorAll('.cp-eye, #changePasswordView .toggle-password')
    .forEach(button => {

        const input =
            document.getElementById(
                button.dataset.target
            );

        if (!input) {
            return;
        }

        input.type = 'password';
        button.classList.remove('visible');
        button.setAttribute('aria-label', 'Show password');

    });

}

async function closeChangePasswordDialog() {

    showApplicationView(
        'settings'
    );

    await Promise.all([
        loadSettingsInformation(),
        loadApplicationSettings()
    ]);

    document
    .querySelectorAll('.cp-eye, #changePasswordView .toggle-password')
    .forEach(button => {

        const input =
            document.getElementById(
                button.dataset.target
            );

        if (!input) {
            return;
        }

        input.type = 'password';
        button.classList.remove('visible');
        button.setAttribute('aria-label', 'Show password');

    });

}

async function submitChangePassword() {

    setChangePasswordError('');

    const currentPassword =
        currentPasswordInput.value;

    const newPassword =
        newPasswordInput.value;

    const confirmPassword =
        confirmPasswordInput.value;


    if (!currentPassword) {

        setChangePasswordError(
            'Enter your current password.'
        );

        currentPasswordInput.focus();

        return;

    }


    const validPassword =
        newPassword.length >= 8 &&
        /[A-Z]/.test(newPassword) &&
        /[a-z]/.test(newPassword) &&
        /[0-9]/.test(newPassword);


    if (!validPassword) {

        setChangePasswordError(
            'Password does not meet the requirements.'
        );

        newPasswordInput.focus();

        return;

    }


    if (
        newPassword !==
        confirmPassword
    ) {

        setChangePasswordError(
            'Passwords do not match.'
        );

        confirmPasswordInput.focus();

        return;

    }


    if (
        currentPassword ===
        newPassword
    ) {

        setChangePasswordError(
            'New password must be different from your current password.'
        );

        newPasswordInput.focus();

        return;

    }


    confirmChangePassword.disabled =
        true;

    confirmChangePassword.textContent =
        'Changing...';


    try {

        const result =
            await window
                .crypticLocker
                .changePassword(
                    currentPassword,
                    newPassword
                );


        if (!result?.success) {

            setChangePasswordError(
                result?.message ||
                'Unable to change password.'
            );

            return;

        }

        window.location.href =
    'index.html';


    } catch (error) {

        console.error(error);

        setChangePasswordError(
            'Unable to change password.'
        );

    } finally {

        confirmChangePassword.disabled =
            false;

        confirmChangePassword.textContent =
            'Change Password';

    }

}

function stopAutoLockTimer() {

    if (autoLockTimer) {

        clearTimeout(
            autoLockTimer
        );

        autoLockTimer =
            null;

    }

}

function startAutoLockTimer() {

    stopAutoLockTimer();


    if (!applicationSettings) {
        return;
    }


    const minutes =
        Number(
            applicationSettings
                .autoLockMinutes
        );


    /*
        Never
    */

    if (
        !Number.isFinite(minutes) ||
        minutes <= 0
    ) {

        return;

    }


    if (
        activeVaultOperations > 0
    ) {

        return;

    }


    autoLockTimer =
        setTimeout(
            triggerAutoLock,
            minutes *
            60 *
            1000
        );

}

function resetAutoLockTimer() {

    startAutoLockTimer();

}

async function triggerAutoLock() {

    stopAutoLockTimer();


    /*
        Safety check.

        Timer may expire exactly when an
        operation starts.
    */

    if (
        activeVaultOperations > 0
    ) {

        return;

    }


    try {

        const result =
            await window
                .crypticLocker
                .lockVault();


        if (
            result?.success ===
            true
        ) {

            window.location.replace(
                'index.html'
            );

            return;

        }

    } catch (error) {

        console.error(
            'Auto-Lock failed:',
            error
        );

    }


    /*
        Retry later if locking failed.
    */

    startAutoLockTimer();

}

function renderCurrentLocation() {

    if (
        typeof exitSelectionMode ===
        'function'
    ) {

        exitSelectionMode();

    }


    const emptyState =
        document.getElementById(
            'emptyState'
        );

    const fileList =
        document.getElementById(
            'fileList'
        );


    fileList.innerHTML = '';


    if (!currentLocation) {

        renderRootLocation();

    } else {

        renderFolderLocation(
            currentLocation.folderId,
            currentLocation.relativePath
        );

    }


    const count =
        fileList.children.length;


    if (count === 0) {

    fileList.hidden = true;

    emptyState.hidden = false;

    if (vaultTableHeader) {

        vaultTableHeader.hidden = true;

    }

    const emptyTitle =
        emptyState.querySelector('h2');

    const emptyDesc =
        emptyState.querySelector('p');

    const emptyButtons =
        emptyState.querySelector('.empty-add-buttons');


    if (activeSearchQuery) {

        if (emptyTitle) {
            emptyTitle.textContent =
                'No matching items found';
        }

        if (emptyDesc) {
            const rawQuery =
                vaultSearchInput?.value?.trim() ||
                activeSearchQuery;

            emptyDesc.textContent =
                `No files or folders matched "${rawQuery}".`;
        }

        if (emptyButtons) {
            emptyButtons.hidden = true;
        }

    } else {

        if (emptyTitle) {
            emptyTitle.textContent =
                'Your vault is empty';
        }

        if (emptyDesc) {
            emptyDesc.textContent =
                'Add files or folders to securely store them inside CrypticLocker.';
        }

        if (emptyButtons) {
            emptyButtons.hidden = false;
        }

    }

} else {

    emptyState.hidden = true;

    fileList.hidden = false;

    if (vaultTableHeader) {

        vaultTableHeader.hidden = false;

    }

}


    document.querySelector(
        '.item-count'
    ).textContent =
        `${count} ${
            count === 1
                ? 'item'
                : 'items'
        }`;


    renderBreadcrumb();

    fileList.scrollTop = 0;

}

enableSmoothScrolling(
    document.querySelector(
        '.file-list'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.quarantine-list'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.settings-content'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.recovery-key-content'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.export-content'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.about-content'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.change-password-content'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.integrity-details-list'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.restore-warning-details-list'
    )
);

enableSmoothScrolling(
    document.querySelector(
        '.custom-alert-details-list'
    )
);

openChangePasswordModal
?.addEventListener(
    'click',
    openChangePasswordDialog
);

if (cpBackButton) {
    cpBackButton.addEventListener(
        'click',
        closeChangePasswordDialog
    );
}

confirmChangePassword
?.addEventListener(

    'click',

    submitChangePassword

);

if (changePasswordView) {
    changePasswordView.addEventListener(
        'keydown',
        event => {
            if (
                event.key ===
                'Enter'
            ) {
                event.preventDefault();
                submitChangePassword();
            }
        }
    );
}

document.addEventListener(

    'keydown',

    event => {

        if (

            event.key === 'Escape' &&
            changePasswordView &&
            !changePasswordView.hidden

        ) {

            closeChangePasswordDialog();

        }

    }

);

initializeDashboard();


/* =========================================
   AUTO LOCK ACTIVITY
========================================= */

/*
    Any meaningful user interaction resets
    the inactivity timer.

    Do not reset the timer if protected
    vault operations are currently active.
*/

[
    'mousemove',
    'mousedown',
    'keydown',
    'wheel',
    'touchstart'
].forEach(eventName => {

    document.addEventListener(
        eventName,
        () => {

            if (
                activeVaultOperations > 0
            ) {

                return;

            }

            resetAutoLockTimer();

        },
        {
            passive: true
        }
    );

});

/* =========================================
   ADD TO VAULT
========================================= */

function getAddVaultTriggerButtons() {

    return [
        addVaultButton,
        emptyAddFileButton,
        emptyAddFolderButton
    ].filter(Boolean);

}

async function handleAddToVault(
    type,
    mode,
    triggerButton = null
) {

    const buttons =
        getAddVaultTriggerButtons();


    buttons.forEach(button => {

        button.disabled = true;

    });


    if (triggerButton) {

        const label =
            triggerButton.querySelector(
                'span'
            );

        if (label) {

            label.textContent =
                type === 'folder'
                    ? 'Adding Folder(s)...'
                    : 'Adding...';

        }

    }


    try {

        let result;


        if (type === 'folder') {

            result =
                await window
                    .crypticLocker
                    .addFolder(mode);

        } else {

            result =
                await window
                    .crypticLocker
                    .addFile(mode);

        }


        if (result.canceled) {
            return;
        }

        if (!result.success) {

    /*
        The actual vault operation had already
        started and main.js has already sent
        the terminal failure event.

        The centralized operation panel owns
        the error UI, so do not show a second
        Windows alert.
    */

    if (
        result.operationFailed ===
        true
    ) {

        return;

    }


    /*
        VAULT_COMMIT_UNCERTAIN is handled by
        status: 'attention'.

        The attention panel is already visible,
        so do not show a duplicate alert.
    */

    if (
        result.errorCode ===
        'VAULT_COMMIT_UNCERTAIN'
    ) {

        await loadVaultFiles();

        return;

    }


    /*
        Storage failure before the operation
        actually started.

        No progress/failure panel exists yet,
        so show the dedicated storage message.
    */

    if (
        result.errorCode ===
        'INSUFFICIENT_STORAGE'
    ) {

        await showCustomAlert({
            title: 'Insufficient Storage',
            message: `Not enough storage space.\n\nRequired: ${formatOperationBytes(result.requiredBytes)}\nAvailable: ${formatOperationBytes(result.availableBytes)}`,
            type: 'warning'
        });

        return;

    }


    /*
        Any other error that happened before
        an operation started.
    */

    await showCustomAlert({
        title: 'Unable to Add',
        message: result.message || 'Unable to add item.',
        type: 'danger'
    });

    return;

}


        /*
            Reload encrypted metadata instead
            of manually constructing the UI.

            This keeps dashboard state in sync
            with index.clm.
        */

        await loadVaultFiles();


        const items =
            type === 'folder'
                ? (result.folders || [])
                : (result.files || []);


        if (
            mode === 'move'
        ) {

            const notRemoved =
                items.filter(
                    item =>
                        item.sourceRemoved ===
                        false
                );


            if (notRemoved.length > 0) {

                await showCustomAlert({
                    title: 'Notice',
                    message: notRemoved.length === 1
                        ? (
                            notRemoved[0].sourceRemoveError ||
                            'The item was added, but the original could not be removed.'
                        )
                        : `${notRemoved.length} of ${items.length} items were added, but their originals could not be removed.`,
                    details: notRemoved.length > 1 ? notRemoved.map(item => `• ${item.name}`) : null,
                    type: 'warning'
                });

            }

        }


        /*
            Some items in the batch may have
            failed while others succeeded.
        */

        if (
            Array.isArray(result.failures) &&
            result.failures.length > 0
        ) {

            await showCustomAlert({
                title: 'Partial Completion',
                message: `${items.length} of ${
                    items.length + result.failures.length
                } ${
                    type === 'folder'
                        ? 'folders'
                        : 'files'
                } were added successfully. Some items could not be added.`,
                details: result.failures.map(
                    failure => `• ${failure.name}: ${failure.message}`
                ),
                type: 'warning'
            });

        }


        if (result.uncertainCommit === true) {

            await showCustomAlert({
                title: 'Vault Verification Notice',
                message: result.message || 'A folder was encrypted, but CrypticLocker could not verify the final vault commit.',
                type: 'warning'
            });

        }


    } catch (error) {

    console.error(
        'ADD TO VAULT RENDERER ERROR:',
        error
    );


    await showCustomAlert({
        title: 'Operation Failed',
        message: `Unable to add item to the vault.\n\n${error?.message || String(error)}`,
        type: 'danger'
    });


} finally {

        buttons.forEach(button => {

            button.disabled = false;

        });


        if (addVaultButton) {

            const headerLabel =
                addVaultButton.querySelector(
                    'span'
                );

            if (headerLabel) {

                headerLabel.textContent =
                    'Add to Vault';

            }

        }

        if (emptyAddFileButton) {

            const fileLabel =
                emptyAddFileButton.querySelector(
                    'span'
                );

            if (fileLabel) {

                fileLabel.textContent =
                    'Add File(s)';

            }

        }

        if (emptyAddFolderButton) {

            const folderLabel =
                emptyAddFolderButton.querySelector(
                    'span'
                );

            if (folderLabel) {

                folderLabel.textContent =
                    'Add Folder(s)';

            }

        }

    }

}

function addFileRow(
    file,
    updateCount = true
) {

    const emptyState =
        document.getElementById(
            'emptyState'
        );

    const fileList =
        document.getElementById(
            'fileList'
        );


    emptyState.hidden =
        true;

    fileList.hidden =
        false;


    const row =
        document.createElement(
            'div'
        );


    row.className =
        'file-row';

        row.dataset.fileId =
    file.id;

    row.dataset.itemType =
        'file';


    const added =
        formatVaultDate(
            file.addedAt || file.createdAt || file.modifiedAt
        );

    const modeText =
        (file.mode === 'move' || file.sourceRemoved)
            ? 'MOVE'
            : 'COPY';


    row.innerHTML = `

        <div class="file-row-checkbox">
            <input
                type="checkbox"
                class="row-select-checkbox"
                aria-label="Select item"
            >
        </div>

        <div class="file-name">

            <div class="file-icon">
                ${getFileIconSvg(file.name)}
            </div>

            <span class="file-name-text"></span>

        </div>


        <div class="file-meta file-type"></div>

        <div class="file-meta file-size"></div>
        <div class="file-meta file-mode"></div>
        <div class="file-meta file-added"></div>

        <div class="file-actions">

    <button
        class="file-menu-button"
        type="button"
        title="More options"
    >
        <span></span>
        <span></span>
        <span></span>
    </button>

    <div class="file-menu">

    <button
        class="restore-file-button file-menu-action"
        type="button"
    >

        <svg
            class="file-menu-action-icon"
            viewBox="0 0 24 24"
        >
            <path d="M12 4V15" />
            <path d="M8 11L12 15L16 11" />
            <path d="M5 19H19" />
        </svg>

        <span>Restore</span>

    </button>


    <button
        class="select-row-button file-menu-action"
        type="button"
    >

        <svg
            class="file-menu-action-icon"
            viewBox="0 0 24 24"
        >
            <path d="M9 11L12 14L22 4" />
            <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" />
        </svg>

        <span>Select</span>

    </button>


    <button
        class="delete-file-button file-menu-action danger"
        type="button"
    >

        <svg
            class="file-menu-action-icon"
            viewBox="0 0 24 24"
        >
            <path d="M5 7H19" />
            <path d="M9 7V5H15V7" />
            <path d="M7 7L8 19H16L17 7" />
            <path d="M10 10V16" />
            <path d="M14 10V16" />
        </svg>

        <span>Delete Permanently</span>

    </button>

</div>

</div>
    `;


    /*
        Use textContent for file-controlled
        values instead of injecting them
        through HTML.
    */

    row.querySelector(
        '.file-name-text'
    ).textContent =
        file.name;


    row.querySelector(
        '.file-type'
    ).textContent =
        String(file.type || '').toUpperCase();


    row.querySelector(
        '.file-size'
    ).textContent =
        file.formattedSize;


    row.querySelector(
        '.file-mode'
    ).textContent =
        modeText;

    row.querySelector(
        '.file-added'
    ).textContent =
        added;


    const firstFileRow = fileList.querySelector('.file-row:not(.folder-row)');
    if (firstFileRow) {
        fileList.insertBefore(row, firstFileRow);
    } else {
        fileList.appendChild(row);
    }


    const isRootFile =
        !file.parentFolderId &&
        !currentLocation;

    const fileActions =
        row.querySelector(
            '.file-actions'
        );

    if (isRootFile) {

        const menuButton =
            row.querySelector(
                '.file-menu-button'
            );

        const menu =
            row.querySelector(
                '.file-menu'
            );

        const restoreButton =
            row.querySelector(
                '.restore-file-button'
            );

        const selectButton =
            row.querySelector(
                '.select-row-button'
            );

        const deleteButton =
            row.querySelector(
                '.delete-file-button'
            );

        if (selectButton) {
            selectButton.addEventListener('click', event => {
                event.stopPropagation();
                menu.classList.remove('open');
                if (!selectionModeActive) {
                    enterSelectionMode(row);
                } else {
                    toggleRowSelection(row, true);
                }
            });
        }


        menuButton.addEventListener(
            'click',
            event => {

                event.stopPropagation();

                const wasOpen =
                    menu.classList.contains('open');

                closeAllDropdownsAndMenus();

                if (!wasOpen) {
                    const rect = menuButton.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 170 && rect.top > 170) {
                        menu.classList.add('dropup');
                    } else {
                        menu.classList.remove('dropup');
                    }
                    menu.classList.add('open');
                    row.classList.add('menu-active');
                    row.style.zIndex = '1000';
                }

            }
        );


        restoreButton.addEventListener(
            'click',
            async event => {

                event.stopPropagation();

                setButtonLoading(restoreButton, true);

                try {

                    if (
                        typeof window.crypticLocker?.checkItemsStatus ===
                        'function'
                    ) {

                        const status =
                            await window.crypticLocker
                                .checkItemsStatus([
                                    {
                                        id: file.id,
                                        type: 'file',
                                        name: file.name
                                    }
                                ]);

                        setButtonLoading(restoreButton, false, 'Restore');
                        closeAllDropdownsAndMenus();

                        if (
                            status &&
                            status.success &&
                            status.hasIssues
                        ) {

                            let warningActive = true;

                            while (warningActive) {

                                const warningAction =
                                    await showRestoreWarning(
                                        status
                                    );

                                if (warningAction === 'check-quarantine') {
                                    highlightQuarantinedOrphans(
                                        extractMissingIdentifiers(status)
                                    );
                                    return;
                                }

                                if (warningAction !== 'continue') {
                                    return;
                                }

                                if ((status.verifiedFilesCount || 0) === 0) {
                                    return;
                                }

                                const choice =
                                    await showRestoreConfirm({
                                        title:
                                            'Restore file?',
                                        name:
                                            file.name,
                                        message:
                                            'The file will be decrypted to the location you choose.',
                                        checkboxLabel:
                                            'Also remove the encrypted copy from the vault',
                                        confirmText:
                                            'Restore'
                                    });

                                if (!choice.confirmed) {
                                    continue;
                                }

                                closeRestoreConfirm(false);
                                warningActive = false;

                                try {

                                    const result =
                                        await window
                                            .crypticLocker
                                            .restoreFile(
                                                file.id,
                                                choice.removeFromVault
                                            );

                                    if (result.canceled) {
                                        return;
                                    }

                                    if (!result.success) {

                                        if (
                                            result.operationFailed ===
                                            true
                                        ) {
                                            return;
                                        }

                                        if (
                                            result.errorCode ===
                                            'INSUFFICIENT_STORAGE'
                                        ) {

                                            await showCustomAlert({
                                                title: 'Insufficient Storage',
                                                message: `Not enough storage space.\n\nRequired: ${formatOperationBytes(result.requiredBytes)}\nAvailable: ${formatOperationBytes(result.availableBytes)}`,
                                                type: 'warning'
                                            });

                                            return;

                                        }

                                        await showCustomAlert({
                                            title: 'Restore Failed',
                                            message: result.message || 'Unable to restore file.',
                                            type: 'danger'
                                        });

                                        return;

                                    }

                                    if (result.removedFromVault === true) {
                                        await loadVaultFiles();
                                    }

                                    if (result.removeFromVaultError) {
                                        await showCustomAlert({
                                            title: 'Vault Notice',
                                            message: result.removeFromVaultError,
                                            type: 'warning'
                                        });
                                    }

                                    return;

                                } finally {

                                    closeRestoreConfirm(false);

                                }

                            }

                            return;

                        }

                    }

                    setButtonLoading(restoreButton, false, 'Restore');
                    closeAllDropdownsAndMenus();

                    const choice =
                        await showRestoreConfirm({
                            title:
                                'Restore file?',
                            name:
                                file.name,
                            message:
                                'The file will be decrypted to the location you choose.',
                            checkboxLabel:
                                'Also remove the encrypted copy from the vault',
                            confirmText:
                                'Restore'
                        });

                    if (!choice.confirmed) {
                        return;
                    }

                    closeRestoreConfirm(false);

                    try {

                        const result =
                            await window
                                .crypticLocker
                                .restoreFile(
                                    file.id,
                                    choice.removeFromVault
                                );

                        if (result.canceled) {
                            return;
                        }

                        if (!result.success) {

                            if (
                                result.operationFailed ===
                                true
                            ) {
                                return;
                            }

                            if (
                                result.errorCode ===
                                'INSUFFICIENT_STORAGE'
                            ) {

                                await showCustomAlert({
                                    title: 'Insufficient Storage',
                                    message: `Not enough storage space.\n\nRequired: ${formatOperationBytes(result.requiredBytes)}\nAvailable: ${formatOperationBytes(result.availableBytes)}`,
                                    type: 'warning'
                                });

                                return;

                            }

                            await showCustomAlert({
                                title: 'Restore Failed',
                                message: result.message || 'Unable to restore file.',
                                type: 'danger'
                            });

                            return;

                        }

                        if (result.removedFromVault === true) {
                            await loadVaultFiles();
                        }

                        if (result.removeFromVaultError) {
                            await showCustomAlert({
                                title: 'Vault Notice',
                                message: result.removeFromVaultError,
                                type: 'warning'
                            });
                        }

                    } finally {

                        closeRestoreConfirm(false);

                    }

                } catch (error) {

                    console.error(error);
                    setButtonLoading(restoreButton, false, 'Restore');
                    closeAllDropdownsAndMenus();

                    await showCustomAlert({
                        title: 'Restore Error',
                        message: error?.message || 'Unable to restore file.',
                        type: 'danger'
                    });

                } finally {

                    setButtonLoading(restoreButton, false, 'Restore');

                }

            }
        );

        deleteButton.addEventListener(
            'click',
            event => {

                event.stopPropagation();


                menu.classList.remove(
                    'open'
                );


                openDeleteConfirmation(
                    'file',
                    file.id,
                    file.name
                );

            }
        );

    } else {

        if (fileActions) {
            fileActions.style.visibility =
                'hidden';
        }

        const checkboxWrapper = row.querySelector('.file-row-checkbox');
        if (checkboxWrapper) {
            checkboxWrapper.style.visibility = 'hidden';
            checkboxWrapper.style.pointerEvents = 'none';
        }

    }

if (updateCount) {
    updateItemCount();
}

}

function updateItemCount() {

    const count =
        document.querySelectorAll(
            '.file-row'
        ).length;


    document.querySelector(
        '.item-count'
    ).textContent =
        `${count} ${
            count === 1
                ? 'item'
                : 'items'
        }`;

}


addVaultButton.addEventListener(
    'click',
    event => {

        event.stopPropagation();

        const wasOpen =
            addVaultMenu.classList.contains('open');

        closeAllDropdownsAndMenus();

        if (!wasOpen) {
            addVaultMenu.classList.add('open');
            addVaultMenu.style.display = 'block';
        }

    }
);

addVaultMenu
    .querySelectorAll(
        'button[data-mode][data-type]'
    )
    .forEach(button => {

        button.addEventListener(
            'click',
            async event => {

                event.stopPropagation();


                const mode =
                    button.dataset.mode;

                const type =
                    button.dataset.type;


                addVaultMenu.classList.remove(
                    'open'
                );


                await handleAddToVault(
                    type,
                    mode,
                    addVaultButton
                );

            }
        );

    });


emptyAddFileButton.addEventListener(
    'click',
    event => {

        event.stopPropagation();

        const isHidden =
            fileActionMenu.hidden;

        closeAllDropdownsAndMenus();

        if (isHidden) {
            fileActionMenu.hidden = false;
        }

    }
);

emptyAddFolderButton.addEventListener(
    'click',
    event => {

        event.stopPropagation();

        const isHidden =
            folderActionMenu.hidden;

        closeAllDropdownsAndMenus();

        if (isHidden) {
            folderActionMenu.hidden = false;
        }

    }
);

moveFileButton.addEventListener(
    'click',
    async event => {

        event.stopPropagation();


        fileActionMenu.hidden =
            true;


        await handleAddToVault(
            'file',
            'move',
            emptyAddFileButton
        );

    }
);


copyFileButton.addEventListener(
    'click',
    async event => {

        event.stopPropagation();


        fileActionMenu.hidden =
            true;


        await handleAddToVault(
            'file',
            'copy',
            emptyAddFileButton
        );

    }
);

moveFolderButton.addEventListener(
    'click',
    async event => {

        event.stopPropagation();


        folderActionMenu.hidden =
            true;


        await handleAddToVault(
            'folder',
            'move',
            emptyAddFolderButton
        );

    }
);


copyFolderButton.addEventListener(
    'click',
    async event => {

        event.stopPropagation();


        folderActionMenu.hidden =
            true;


        await handleAddToVault(
            'folder',
            'copy',
            emptyAddFolderButton
        );

    }
);

/* =========================================
   LOCK VAULT
========================================= */

/*
    MAIN PROCESS SESSION LOCK

    The main process can invalidate the
    in-memory vault session independently
    of the renderer.

    Example:
    Windows enters sleep and the
    "Lock when computer sleeps" setting
    is enabled.

    Once the session is invalidated,
    immediately leave the dashboard.
*/

const removeSessionLockedListener =
    window.crypticLocker.onSessionLocked(
        data => {

            console.log(
                'Vault session locked:',
                data?.reason ||
                'unknown'
            );

            recoveryKeyVisible = false;

recoveryKey = null;

recoveryKeyValue.textContent =
    'CKRV-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX';

copyRecoveryKeyButton.disabled =
    true;

toggleRecoveryKeyButton.innerHTML =
    EYE_ICON;

toggleRecoveryKeyButton.title =
    'Show Recovery Key';

            window.location.replace(
                'index.html'
            );

        }
    );
    
    lockVaultButton.addEventListener(
    'click',
    async () => {

        lockVaultButton.disabled =
            true;


        try {

            const result =
                await window.crypticLocker
                    .lockVault();


            if (!result.success) {

                lockVaultButton.disabled =
                    false;

                return;

            }

            recoveryKeyVisible = false;

recoveryKey = null;

recoveryKeyValue.textContent =
    'CKRV-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX';

copyRecoveryKeyButton.disabled =
    true;

toggleRecoveryKeyButton.innerHTML =
    EYE_ICON;

toggleRecoveryKeyButton.title =
    'Show Recovery Key';

            window.location.replace(
                'index.html'
            );


        } catch (error) {

            console.error(
                'Unable to lock vault:',
                error
            );


            lockVaultButton.disabled =
                false;

        }

    }
);

document.addEventListener(
    'keydown',
    event => {

        const shortcutModifierPressed =
            isMacPlatform
                ? event.metaKey
                : event.ctrlKey;

        if (
            shortcutModifierPressed &&
            event.key.toLowerCase() === 'l'
        ) {

            event.preventDefault();

            if (
                lockVaultButton.disabled
            ) {

                return;

            }

            lockVaultButton.click();

        }

    }
);

vaultIntegrityCheckButton.addEventListener(
    'click',
    async () => {

        showIntegrityOverlay();

setIntegrityLoadingState();

const result =
            await window.crypticLocker
                .checkVaultIntegrity();

        setIntegrityResultState(
            result
        );

    }
);

integrityDoneButton.addEventListener(
    'click',
    () => {

        hideIntegrityOverlay();

    }
);

integrityDetailsButton.addEventListener(
    'click',
    () => {

        const expanded =
            !integrityDetails.hidden;

        integrityDetails.hidden =
            expanded;

        integrityDetailsButton.textContent =
            expanded
                ? 'View Details'
                : 'Hide Details';

    }
);

document.addEventListener(
    'click',
    (e) => {
        if (e.target && (
            e.target.closest('#addVaultButton') ||
            e.target.closest('#emptyAddFileButton') ||
            e.target.closest('#emptyAddFolderButton') ||
            e.target.closest('#autoLockDropdownButton') ||
            e.target.closest('.file-menu-button') ||
            e.target.closest('.add-vault-menu') ||
            e.target.closest('.vault-action-menu') ||
            e.target.closest('.custom-dropdown-menu') ||
            e.target.closest('.file-menu')
        )) {
            return;
        }
        closeAllDropdownsAndMenus();
    }
);

window.addEventListener('blur', () => {
    closeAllDropdownsAndMenus();
});

function renderRootLocation() {

    /*
        Root folders
    */

    let sortedFolders =
        [...vaultFolders].sort(
            (a, b) =>
                new Date(b.addedAt || b.createdAt || b.modifiedAt || 0) -
        new Date(a.addedAt || a.createdAt || a.modifiedAt || 0)
        );

    if (activeSearchQuery) {

        sortedFolders =
            sortedFolders.filter(folder =>
                folder.name
                    .toLowerCase()
                    .includes(activeSearchQuery)
            );

    }


    sortedFolders.forEach(folder => {

        addFolderRow({
            folderId:
                folder.id,

            name:
                folder.name,

            relativePath:
                '',

            formattedSize:
                folder.formattedSize,

            addedAt:
                folder.addedAt,

            mode:
                folder.mode || (folder.sourceRemoved ? 'move' : 'copy') || 'copy'
        });

    });


    /*
        Only standalone files should appear
        at root.

        Files belonging to folders stay
        inside their logical folder.
    */

    let rootFiles =
        vaultFiles
            .filter(
                file =>
                    !file.parentFolderId
            )
            .sort(
                (a, b) =>
                    new Date(b.addedAt || b.createdAt || b.modifiedAt || 0) -
        new Date(a.addedAt || a.createdAt || a.modifiedAt || 0)
            );

    if (activeSearchQuery) {

        rootFiles =
            rootFiles.filter(file =>
                file.name
                    .toLowerCase()
                    .includes(activeSearchQuery)
            );

    }


    rootFiles.forEach(file => {

        addFileRow(
            file,
            false
        );

    });

}

function renderFolderLocation(
    folderId,
    relativePath
) {

    const folder =
        vaultFolders.find(
            item =>
                item.id === folderId
        );


    if (!folder) {

        currentLocation = null;

        renderCurrentLocation();

        return;

    }


    const normalizedCurrent =
        relativePath || '';


    /*
        Direct child folders only.
    */

    let childFolders =
        (folder.structure || [])
            .filter(item => {

                const parent =
                    pathParent(
                        item.relativePath
                    );

                return (
                    parent ===
                    normalizedCurrent
                );

            });

    if (activeSearchQuery) {

        childFolders =
            childFolders.filter(item =>
                item.name
                    .toLowerCase()
                    .includes(activeSearchQuery)
            );

    }


    childFolders.forEach(item => {

        addFolderRow({

            folderId,

            name:
                item.name,

            relativePath:
                item.relativePath,

            formattedSize:
                'Folder',

            addedAt:
                folder.addedAt,

            mode:
                folder.mode || (folder.sourceRemoved ? 'move' : 'copy') || 'copy'
        });

    });


    /*
        Direct child files only.
    */

    let childFiles =
        vaultFiles.filter(file => {

            if (
                file.parentFolderId !==
                folderId
            ) {
                return false;
            }


            const parent =
                pathParent(
                    file.relativePath || ''
                );


            return (
                parent ===
                normalizedCurrent
            );

        });

    if (activeSearchQuery) {

        childFiles =
            childFiles.filter(file =>
                file.name
                    .toLowerCase()
                    .includes(activeSearchQuery)
            );

    }


    childFiles.forEach(file => {

        addFileRow(
            file,
            false
        );

    });

}

function normalizeVaultPath(value) {

    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');

}


function pathParent(value) {

    const normalized =
        normalizeVaultPath(
            value
        );


    if (!normalized) {
        return '';
    }


    const parts =
        normalized.split('/');


    parts.pop();


    return parts.join('/');

}

function addFolderRow(folder) {

    const isRootFolder =
        !currentLocation &&
        !normalizeVaultPath(
            folder.relativePath
        );
    
    const fileList =
        document.getElementById(
            'fileList'
        );


    const row =
        document.createElement(
            'div'
        );


    row.className =
        'file-row folder-row';

    row.dataset.folderId =
        folder.folderId;

    row.dataset.itemType =
        'folder';


    const added =
        formatVaultDate(
            folder.addedAt || folder.createdAt || folder.modifiedAt
        );

    const modeText =
        (String(folder.mode).toLowerCase() === 'move' || folder.sourceRemoved === true)
            ? 'MOVE'
            : 'COPY';


    row.innerHTML = `

        <div class="file-row-checkbox">
            <input
                type="checkbox"
                class="row-select-checkbox"
                aria-label="Select item"
            >
        </div>

        <div class="file-name">

            <div class="file-icon">

                <svg viewBox="0 0 24 24">

                    <path
                        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10L12 7H17.5A2.5 2.5 0 0 1 20 9.5V17A2 2 0 0 1 18 19H6A2 2 0 0 1 4 17Z"
                    />

                </svg>

            </div>

            <span
                class="file-name-text"
            ></span>

        </div>


        <div class="file-meta">
            FOLDER
        </div>


        <div class="file-meta folder-size"></div>
        <div class="file-meta folder-mode"></div>
        <div class="file-meta folder-added">${added}</div>


        <div class="file-actions">

    <button
        class="file-menu-button"
        type="button"
        title="More options"
    >
        <span></span>
        <span></span>
        <span></span>
    </button>


    <div class="file-menu">

    <button
        class="restore-folder-button file-menu-action"
        type="button"
    >

        <svg
            class="file-menu-action-icon"
            viewBox="0 0 24 24"
        >
            <path d="M12 4V15" />
            <path d="M8 11L12 15L16 11" />
            <path d="M5 19H19" />
        </svg>

        <span>Restore</span>

    </button>


    <button
        class="select-row-button file-menu-action"
        type="button"
    >

        <svg
            class="file-menu-action-icon"
            viewBox="0 0 24 24"
        >
            <path d="M9 11L12 14L22 4" />
            <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" />
        </svg>

        <span>Select</span>

    </button>


    <button
        class="delete-folder-button file-menu-action danger"
        type="button"
    >

        <svg
            class="file-menu-action-icon"
            viewBox="0 0 24 24"
        >
            <path d="M5 7H19" />
            <path d="M9 7V5H15V7" />
            <path d="M7 7L8 19H16L17 7" />
            <path d="M10 10V16" />
            <path d="M14 10V16" />
        </svg>

        <span>Delete Permanently</span>

    </button>

</div>

</div>
    `;


    row.querySelector(
        '.file-name-text'
    ).textContent =
        folder.name;


    row.querySelector(
        '.folder-size'
    ).textContent =
        folder.formattedSize ||
        '—';

    row.querySelector(
        '.folder-mode'
    ).textContent =
        modeText;

        const fileActions =
    row.querySelector(
        '.file-actions'
    );


if (isRootFolder) {

    const menuButton =
        row.querySelector(
            '.file-menu-button'
        );


    const menu =
        row.querySelector(
            '.file-menu'
        );


    const restoreButton =
        row.querySelector(
            '.restore-folder-button'
        );

    const selectButton =
        row.querySelector(
            '.select-row-button'
        );

    const deleteButton =
    row.querySelector(
        '.delete-folder-button'
    );

    if (selectButton) {
        selectButton.addEventListener('click', event => {
            event.stopPropagation();
            menu.classList.remove('open');
            if (!selectionModeActive) {
                enterSelectionMode(row);
            } else {
                toggleRowSelection(row, true);
            }
        });
    }
    
    menuButton.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            const wasOpen =
                menu.classList.contains('open');

            closeAllDropdownsAndMenus();

            if (!wasOpen) {
                const rect = menuButton.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                if (spaceBelow < 170 && rect.top > 170) {
                    menu.classList.add('dropup');
                } else {
                    menu.classList.remove('dropup');
                }
                menu.classList.add('open');
                row.classList.add('menu-active');
                row.style.zIndex = '1000';
            }

        }
    );


    restoreButton.addEventListener(
        'click',
        async event => {

            event.stopPropagation();

            setButtonLoading(restoreButton, true);

            try {

                const folderId =
                    folder.folderId || folder.id;

                if (
                    typeof window.crypticLocker?.checkItemsStatus ===
                    'function'
                ) {

                    const status =
                        await window.crypticLocker
                            .checkItemsStatus([
                                {
                                    id: folderId,
                                    type: 'folder',
                                    name: folder.name
                                }
                            ]);

                    setButtonLoading(restoreButton, false, 'Restore');
                    closeAllDropdownsAndMenus();

                    if (
                        status &&
                        status.success &&
                        status.hasIssues
                    ) {

                        let warningActive = true;

                        while (warningActive) {

                            const warningAction =
                                await showRestoreWarning(
                                    status
                                );

                            if (warningAction === 'check-quarantine') {
                                highlightQuarantinedOrphans(
                                    extractMissingIdentifiers(status)
                                );
                                return;
                            }

                            if (warningAction !== 'continue') {
                                return;
                            }

                            if ((status.verifiedFilesCount || 0) === 0) {
                                return;
                            }

                            const choice =
                                await showRestoreConfirm({
                                    title:
                                        'Restore folder?',
                                    name:
                                        folder.name,
                                    message:
                                        'The folder will be decrypted to the location you choose.',
                                    checkboxLabel:
                                        'Also remove the encrypted copy from the vault',
                                    confirmText:
                                        'Restore'
                                });

                            if (!choice.confirmed) {
                                continue;
                            }

                            closeRestoreConfirm(false);
                            warningActive = false;

                            try {

                                const result =
                                    await window
                                        .crypticLocker
                                        .restoreFolder(
                                            folderId,
                                            choice.removeFromVault
                                        );

                                if (result.canceled) {
                                    return;
                                }

                                if (!result.success) {

                                    if (result.operationFailed === true) {
                                        return;
                                    }

                                    if (result.errorCode === 'INSUFFICIENT_STORAGE') {
                                        await showCustomAlert({
                                            title: 'Insufficient Storage',
                                            message: `Not enough storage space.\n\nRequired: ${formatOperationBytes(result.requiredBytes)}\nAvailable: ${formatOperationBytes(result.availableBytes)}`,
                                            type: 'warning'
                                        });
                                        return;
                                    }

                                    await showCustomAlert({
                                        title: 'Restore Failed',
                                        message: result.message || 'Unable to restore folder.',
                                        type: 'danger'
                                    });

                                    return;

                                }

                                await loadVaultFiles();

                                return;

                            } finally {

                                closeRestoreConfirm(false);

                            }

                        }

                        return;

                    }

                }

                setButtonLoading(restoreButton, false, 'Restore');
                closeAllDropdownsAndMenus();

                const choice =
                    await showRestoreConfirm({
                        title:
                            'Restore folder?',
                        name:
                            folder.name,
                        message:
                            'The folder will be decrypted to the location you choose.',
                        checkboxLabel:
                            'Also remove the encrypted copy from the vault',
                        confirmText:
                            'Restore'
                    });

                if (!choice.confirmed) {
                    return;
                }

                closeRestoreConfirm(false);

                try {

                    const result =
                        await window
                            .crypticLocker
                            .restoreFolder(
                                folder.folderId || folder.id,
                                choice.removeFromVault
                            );

                    if (result.canceled) {
                        return;
                    }

                    if (!result.success) {

                        if (
                            result.operationFailed ===
                            true
                        ) {
                            return;
                        }

                        if (
                            result.errorCode ===
                            'INSUFFICIENT_STORAGE'
                        ) {

                            await showCustomAlert({
                                title: 'Insufficient Storage',
                                message: `Not enough storage space.\n\nRequired: ${formatOperationBytes(result.requiredBytes)}\nAvailable: ${formatOperationBytes(result.availableBytes)}`,
                                type: 'warning'
                            });

                            return;

                        }

                        await showCustomAlert({
                            title: 'Restore Failed',
                            message: result.message || 'Unable to restore folder.',
                            type: 'danger'
                        });

                        return;

                    }

                    if (result.removedFromVault === true) {
                        await loadVaultFiles();
                    }

                    if (result.removeFromVaultError) {
                        await showCustomAlert({
                            title: 'Vault Notice',
                            message: result.removeFromVaultError,
                            type: 'warning'
                        });
                    }

                } finally {

                    closeRestoreConfirm(false);

                }

            } catch (error) {

                console.error(
                    error
                );
                setButtonLoading(restoreButton, false, 'Restore');
                closeAllDropdownsAndMenus();

                await showCustomAlert({
                    title: 'Restore Error',
                    message: error?.message || 'Unable to restore folder.',
                    type: 'danger'
                });

            } finally {

                setButtonLoading(restoreButton, false, 'Restore');

            }

        }
    );


deleteButton.addEventListener(
    'click',
    event => {

        event.stopPropagation();


        menu.classList.remove(
            'open'
        );


        openDeleteConfirmation(
            'folder',
            folder.folderId,
            folder.name
        );

    }
);

} else {

    /*
        Nested folders currently do not have
        their own Restore action.

        Root-folder restore will restore the
        complete folder tree.
    */

    fileActions.style.visibility =
        'hidden';

    const checkboxWrapper = row.querySelector('.file-row-checkbox');
    if (checkboxWrapper) {
        checkboxWrapper.style.visibility = 'hidden';
        checkboxWrapper.style.pointerEvents = 'none';
    }

}


    /*
        Double-click opens folder.
    */

    row.addEventListener(
        'dblclick',
        () => {

            currentLocation = {

                folderId:
                    folder.folderId,

                relativePath:
                    normalizeVaultPath(
                        folder.relativePath
                    )

            };


            renderCurrentLocation();

        }
    );


    const firstFolderRow = fileList.querySelector('.folder-row');
    const firstFileRow = fileList.querySelector('.file-row:not(.folder-row)');
    if (firstFolderRow) {
        fileList.insertBefore(row, firstFolderRow);
    } else if (firstFileRow) {
        fileList.insertBefore(row, firstFileRow);
    } else {
        fileList.appendChild(row);
    }
}

function renderBreadcrumb() {

    vaultBreadcrumb.innerHTML =
        '';


    const rootButton =
        document.createElement(
            'button'
        );


    rootButton.type =
        'button';

    rootButton.textContent =
        'My Vault';


    rootButton.addEventListener(
        'click',
        () => {

            currentLocation =
                null;

            renderCurrentLocation();

        }
    );


    vaultBreadcrumb.appendChild(
        rootButton
    );


    if (!currentLocation) {
        return;
    }


    const folder =
        vaultFolders.find(
            item =>
                item.id ===
                currentLocation.folderId
        );


    if (!folder) {
        return;
    }


    addBreadcrumbSeparator();


    /*
        Root folder itself
    */

    const folderButton =
        document.createElement(
            'button'
        );


    folderButton.type =
        'button';

    folderButton.textContent =
        folder.name;


    folderButton.addEventListener(
        'click',
        () => {

            currentLocation = {

                folderId:
                    folder.id,

                relativePath:
                    ''

            };


            renderCurrentLocation();

        }
    );


    vaultBreadcrumb.appendChild(
        folderButton
    );


    const relative =
        normalizeVaultPath(
            currentLocation.relativePath
        );


    if (!relative) {
        return;
    }


    const parts =
        relative.split('/');


    let builtPath = '';


    parts.forEach(part => {

        builtPath =
            builtPath
                ? `${builtPath}/${part}`
                : part;


        addBreadcrumbSeparator();


        const button =
            document.createElement(
                'button'
            );


        button.type =
            'button';

        button.textContent =
            part;


        const targetPath =
            builtPath;


        button.addEventListener(
            'click',
            () => {

                currentLocation = {

                    folderId:
                        folder.id,

                    relativePath:
                        targetPath

                };


                renderCurrentLocation();

            }
        );


        vaultBreadcrumb.appendChild(
            button
        );

    });

}


function addBreadcrumbSeparator() {

    const separator =
        document.createElement(
            'span'
        );


    separator.className =
        'breadcrumb-separator';

    separator.textContent =
        '›';


    vaultBreadcrumb.appendChild(
        separator
    );

}

window.crypticLocker
    .onOperationProgress(
        progress => {

            /*
    AUTO-LOCK OPERATION TRACKING

    Suspend inactivity locking while a vault
    operation is active.
*/

if (
    progress.status === 'started'
) {

    if (
        progress.operationId &&
        !activeOperationIds.has(
            progress.operationId
        )
    ) {

        activeOperationIds.add(
            progress.operationId
        );

        activeVaultOperations =
            activeOperationIds.size;

        stopAutoLockTimer();

    }

}
else if (
    progress.status === 'completed' ||
    progress.status === 'failed' ||
    progress.status === 'attention' ||
    progress.status === 'cancelled'
) {

    if (
        progress.operationId
    ) {

        activeOperationIds.delete(
            progress.operationId
        );

        activeVaultOperations =
            activeOperationIds.size;

    }

    /*
        If every protected operation has
        finished, restart inactivity timing.
    */

    if (
        activeVaultOperations === 0
    ) {

        resetAutoLockTimer();

    }

}

/*
                Start / processing state
            */

            if (
                progress.status === 'started' ||
                progress.status === 'file-started' ||
                progress.status === 'progress' ||
                progress.status === 'file-completed'
            ) {

                if (
    progress.operationId
) {

    currentOperationId =
        progress.operationId;

}

operationCancelButton.disabled =
    false;

operationCancelButton.hidden =
    false;

const cancelButtonText =
    operationCancelButton
        .querySelector('span');

if (cancelButtonText) {

    cancelButtonText.textContent =
        'Cancel';

}

                operationOverlay.hidden =
                    false;

                operationProcessing.hidden =
                    false;

                operationSuccess.hidden =
                    true;


                const isExport =
                    progress.operation ===
                    'export';

                const isRestore =
                    progress.operation ===
                    'restore';

                const isRecover =
                    progress.operation ===
                    'recover';

                const isDelete =
                    progress.operation ===
                    'delete';

                operationCancelButton.hidden = false;
                operationCancelButton.disabled = false;

    /*
    If recovery was started from the
    Container Inspection panel, close
    inspection as soon as the actual
    recovery operation begins.

    If the user cancels the destination
    picker, no operation progress event
    is received, so inspection stays open.
*/

if (
    isRecover &&
    !quarantineInspectOverlay.hidden
) {

    closeQuarantineInspection();

}

if (
    !restoreConfirmOverlay.hidden
) {

    closeRestoreConfirm(false);

}


operationTitle.textContent =
    isExport
        ? 'Exporting Vault'
        : isRecover
            ? 'Recovering file'
            : isDelete
                ? (
                    progress.itemType === 'folder'
                        ? 'Deleting folder'
                        : 'Deleting file'
                )
                : isRestore
                    ? (
                        progress.itemType === 'folder'
                            ? 'Restoring folder'
                            : 'Restoring file'
                    )
                    : (
                        progress.itemType === 'folder'
                            ? 'Securing folder'
                            : 'Securing file'
                    );


                operationItemName.textContent =
                    progress.name ||
                    'CrypticLocker';

                    operationCurrentFile.textContent =
    progress.currentFile ||
    (
        isExport
            ? (
                progress.status === 'started'
                    ? 'Preparing backup package...'
                    : 'Streaming encrypted files...'
            )
            : isDelete
                ? (
                    progress.status ===
                    'started'
                        ? 'Preparing deletion...'
                        : 'Removing from vault...'
                )
                : (
                    progress.status ===
                    'started'
                        ? 'Preparing...'
                        : 'Finalizing...'
                )
    );

                const totalBytes =
                    Number(
                        progress.totalBytes
                    ) || 0;


                const processedBytes =
                    Math.min(
                        Number(
                            progress.processedBytes
                        ) || 0,
                        totalBytes || Infinity
                    );


                const percentage =
                    totalBytes > 0
                        ? Math.min(
                            100,
                            Math.max(
                                0,
                                (
                                    processedBytes /
                                    totalBytes
                                ) * 100
                            )
                        )
                        : 0;


                const displayPercentage =
    Math.floor(
        percentage
    );


if (
    displayPercentage >= 99
) {

    operationPercentageValue.textContent =
        '';

    operationFinalizingSpinner.hidden =
        false;

    operationCancelButton.hidden =
        true;

    operationStatusText.textContent =
        'Finalizing...';

    operationProgressFill.style.width =
        '100%';

} else {

    operationPercentageValue.textContent =
        `${displayPercentage}%`;

    operationFinalizingSpinner.hidden =
        true;

    operationCancelButton.hidden =
        false;

    operationProgressFill.style.width =
        `${percentage}%`;

}


                if (
    progress.status ===
    'started'
) {

    operationStatusText.textContent =
        isDelete
            ? 'Preparing deletion...'
            : 'Preparing...';

} else if (isRecover) {

    operationStatusText.textContent =
        'Recovering and verifying...';

} else if (isDelete) {

    operationStatusText.textContent =
        'Deleting securely from vault...';

} else if (isRestore) {

    operationStatusText.textContent =
        'Decrypting and verifying...';

} else if (isExport) {

    operationStatusText.textContent =
        'Exporting and packaging...';

} else {

    operationStatusText.textContent =
        'Encrypting and securing...';

}


                operationSize.textContent =
                    totalBytes > 0
                        ? `${
                            formatOperationBytes(
                                processedBytes
                            )
                        } / ${
                            formatOperationBytes(
                                totalBytes
                            )
                        }`
                        : 'Preparing...';


                const completedFiles =
                    Number(
                        progress.completedFiles
                    ) || 0;


                const totalFiles =
                    Number(
                        progress.totalFiles
                    ) || 0;


                operationFiles.textContent =
                    totalFiles > 0
                        ? `${completedFiles} / ${totalFiles}`
                        : '—';


                const speed =
                    Number(
                        progress.speedBytesPerSecond
                    ) || 0;


                operationSpeed.textContent =
                    speed > 0
                        ? `${
                            formatOperationBytes(
                                speed
                            )
                        }/s`
                        : '—';


                operationEta.textContent =
                    formatOperationEta(
                        Number(
                            progress.etaSeconds
                        )
                    );


                return;

            }


            /*
    Failed operation.

    The main process sends one standardized
    terminal failure event for add / restore /
    recover / delete operations.

    Reuse the terminal result panel so the
    progress UI cannot remain stuck after
    an operation fails.
*/

/*
    Cancelled operation.
*/

if (
    progress.status ===
    'cancelled'
) {

    operationOverlay.hidden =
        false;

    operationProcessing.hidden =
        true;

    operationSuccess.hidden =
        false;


    operationFinalizingSpinner.hidden =
        true;


    operationPercentageValue.textContent =
        '0%';


    operationResultIcon.className =
        'operation-result-icon attention';


    const isFolder =
        progress.itemType ===
        'folder';


    const isRestore =
        progress.operation ===
        'restore';


    const isRecover =
        progress.operation ===
        'recover';


    const isDelete =
        progress.operation ===
        'delete';


    const isExport =
        progress.operation ===
        'export';

    operationSuccessTitle.textContent =
        isExport
            ? 'Vault export cancelled'
            : 'Operation cancelled';


    operationSuccessName.textContent =
        progress.name ||
        'CrypticLocker';


    operationSuccessMessage.textContent =
        isExport
            ? 'The vault export was cancelled. No files were created.'
            : isRecover
                ? 'The recovery operation was cancelled.'
                : isDelete
                    ? (
                        isFolder
                            ? 'The folder deletion was cancelled.'
                            : 'The file deletion was cancelled.'
                    )
                    : isRestore
                        ? (
                            isFolder
                                ? 'The folder restore was cancelled.'
                                : 'The file restore was cancelled.'
                        )
                        : (
                            isFolder
                                ? 'The folder encryption was cancelled.'
                                : 'The file encryption was cancelled.'
                        );


    operationSpeed.textContent =
        '—';

    operationEta.textContent =
        '—';

    return;

}

if (
    progress.status ===
    'failed'
) {

    operationOverlay.hidden =
        false;

    operationProcessing.hidden =
        true;

    operationSuccess.hidden =
        false;

    operationResultIcon.className =
    'operation-result-icon failed';


    const isRestore =
        progress.operation ===
        'restore';

    const isRecover =
        progress.operation ===
        'recover';

    const isDelete =
    progress.operation ===
    'delete';
    
    const isFolder =
        progress.itemType ===
        'folder';


    operationSuccessTitle.textContent =
    isRecover
        ? 'File recovery failed'
        : isDelete
            ? (
                isFolder
                    ? 'Folder deletion failed'
                    : 'File deletion failed'
            )
            : isRestore
                ? (
                    isFolder
                        ? 'Folder restore failed'
                        : 'File restore failed'
                )
                : (
                    isFolder
                        ? 'Folder could not be secured'
                        : 'File could not be secured'
                );


    operationSuccessName.textContent =
        progress.name ||
        'CrypticLocker';


    operationSuccessMessage.textContent =
        progress.message ||
        'The operation could not be completed.';


    /*
        A failed operation is terminal.

        Do not keep stale speed / ETA values
        from the last progress event.
    */

    operationSpeed.textContent =
        '—';

    operationEta.textContent =
        '—';


    return;

}

/*
    Attention / uncertain operation.

    Encryption completed, but CrypticLocker
    could not safely confirm the final vault
    metadata commit.

    This is intentionally NOT treated as
    success or failure because the encrypted
    containers may already exist and the
    original source has been preserved.
*/

if (
    progress.status ===
    'attention'
) {

    operationOverlay.hidden =
        false;

    operationProcessing.hidden =
        true;

    operationSuccess.hidden =
        false;

    operationResultIcon.className =
    'operation-result-icon attention';


    const isFolder =
        progress.itemType ===
        'folder';


    operationSuccessTitle.textContent =
        isFolder
            ? 'Folder needs attention'
            : 'File needs attention';


    operationSuccessName.textContent =
        progress.name ||
        'CrypticLocker';


    operationSuccessMessage.textContent =
        progress.message ||
        (
            isFolder
                ? 'The folder was encrypted, but CrypticLocker could not verify the final vault commit. Your original folder has not been removed.'
                : 'The file was encrypted, but CrypticLocker could not verify the final vault commit. Your original file has not been removed.'
        );


    /*
        Attention is a terminal state.

        Clear stale performance information
        left by the previous progress event.
    */

    operationSpeed.textContent =
        '—';

    operationEta.textContent =
        '—';


    return;

}

/*
                Successful operation.

                Same panel switches into
                success state and waits for OK.
            */

            if (
                progress.status ===
                'completed'
            ) {

                operationOverlay.hidden =
                    false;

                operationProcessing.hidden =
                    true;

                operationSuccess.hidden =
                    false;

                    operationFinalizingSpinner.hidden =
    true;

operationCancelButton.hidden =
    false;

operationPercentageValue.textContent =
    '100%';

                operationResultIcon.className =
    'operation-result-icon success';


                const isExport =
                    progress.operation ===
                    'export';

                const isRestore =
                    progress.operation ===
                    'restore';

                const isRecover =
                progress.operation ===
                'recover';

                const isDelete =
    progress.operation ===
    'delete';

                const isFolder =
                    progress.itemType ===
                    'folder';


                operationSuccessTitle.textContent =
    isExport
        ? 'Vault exported successfully'
        : isRecover
            ? 'File recovered successfully'
            : isDelete
                ? (
                    isFolder
                        ? 'Folder deleted successfully'
                        : 'File deleted successfully'
                    )
                : isRestore
                    ? (
                        isFolder
                            ? 'Folder restored successfully'
                            : 'File restored successfully'
                    )
                    : (
                        isFolder
                            ? 'Folder secured successfully'
                            : (
                                progress.totalFiles > 1
                                    ? 'Files secured successfully'
                                    : 'File secured successfully'
                            )
                    );


                operationSuccessName.textContent =
                    progress.name || '';

            if (isExport) {

    operationSuccessMessage.textContent =
        `Your encrypted vault backup (.clvault) with ${progress.totalFiles || 0} items was saved successfully.`;

} else if (isRecover) {

    operationSuccessMessage.textContent =
        'The orphan file was recovered and verified successfully.';

} else if (isDelete) {

    operationSuccessMessage.textContent =
        isFolder
            ? `${progress.totalFiles || 0} encrypted files were permanently removed from the vault.`
            : 'The encrypted file was permanently removed from the vault.';

} else if (isRestore) {

    operationSuccessMessage.textContent =
        isFolder
            ? `${progress.totalFiles || 0} files were restored and verified successfully.`
            : 'The file was restored and verified successfully.';

} else {

    operationSuccessMessage.textContent =
        isFolder
            ? `${progress.totalFiles || 0} files were encrypted successfully.`
            : (
                progress.totalFiles > 1
                    ? `${progress.totalFiles} files were encrypted successfully.`
                    : 'The file was encrypted successfully.'
            );

}
    

            }

        }
    );

    operationCancelButton.addEventListener(
    'click',
    async () => {

        if (
            !currentOperationId
        ) {

            return;

        }


        operationCancelButton.disabled =
            true;


        const buttonText =
            operationCancelButton
                .querySelector('span');


        if (buttonText) {

            buttonText.textContent =
                'Cancelling...';

        }


        try {

            const result =
                await window
                    .crypticLocker
                    .cancelOperation(
                        currentOperationId
                    );


            if (
                !result ||
                result.success !== true
            ) {

                throw new Error(
                    'Unable to cancel the operation.'
                );

            }

        } catch (error) {

            console.error(
                'Unable to cancel vault operation:',
                error
            );


            operationCancelButton.disabled =
                false;


            if (buttonText) {

                buttonText.textContent =
                    'Cancel';

            }

        }

    }
);

operationOkButton.addEventListener(
    'click',
    () => {

        operationCancelButton.disabled =
    false;

const cancelButtonText =
    operationCancelButton
        .querySelector('span');

if (cancelButtonText) {

    cancelButtonText.textContent =
        'Cancel';

}

        currentOperationId =
            null;

        operationOverlay.hidden =
            true;

        operationProcessing.hidden =
            false;

        operationSuccess.hidden =
            true;

        operationResultIcon.className =
    'operation-result-icon success';

        operationProgressFill.style.width =
            '0%';


       operationPercentageValue.textContent =
    '0%';

operationFinalizingSpinner.hidden =
    true;

    }
);

/* =========================================
   MULTI-SELECT (Ctrl+A / Cmd+A)

   Entry point is ONLY Ctrl+A (or Cmd+A on
   macOS) — it selects every item currently
   shown in "My Vault" and reveals a checkbox
   on each row. Individual checkboxes can
   then be unchecked to narrow the selection.

   Exits (clears selection, hides checkboxes)
   on: Escape, clicking empty space, or the
   selection count reaching zero.
========================================= */

const selectedVaultItems =
    new Map();

let selectionModeActive =
    false;

const selectionBar =
    document.getElementById(
        'selectionBar'
    );

const selectionBarCount =
    document.getElementById(
        'selectionBarCount'
    );

const selectionRestoreButton =
    document.getElementById(
        'selectionRestoreButton'
    );

const selectionDeleteButton =
    document.getElementById(
        'selectionDeleteButton'
    );

const selectionCancelButton =
    document.getElementById(
        'selectionCancelButton'
    );

const vaultContentSection =
    document.querySelector(
        '.vault-content'
    );

function getRowItemInfo(row) {

    if (!row) {
        return null;
    }


    const type =
        row.dataset.itemType;


    if (type === 'folder') {

        return {
            id: row.dataset.folderId,
            type: 'folder',
            name:
                row.querySelector(
                    '.file-name-text'
                )?.textContent ||
                ''
        };

    }


    if (type === 'file') {

        return {
            id: row.dataset.fileId,
            type: 'file',
            name:
                row.querySelector(
                    '.file-name-text'
                )?.textContent ||
                ''
        };

    }


    return null;

}

function updateSelectionBar() {

    const count =
        selectedVaultItems.size;


    if (count === 0) {

        exitSelectionMode();

        return;

    }


    selectionBarCount.textContent =
        `${count} ${
            count === 1
                ? 'item'
                : 'items'
        } selected`;


    selectionBar.hidden =
        false;

}

function enterSelectionMode(singleRow = null) {

    if (currentLocation !== null) {
        return;
    }

    const fileList =
        document.getElementById(
            'fileList'
        );

    const rows =
        fileList.querySelectorAll(
            '.file-row'
        );


    if (rows.length === 0) {
        return;
    }


    selectionModeActive =
        true;


    if (vaultContentSection) {

        vaultContentSection.classList.add(
            'selection-mode'
        );

    }


    selectedVaultItems.clear();


    if (singleRow) {

        rows.forEach(row => {

            const checkbox =
                row.querySelector(
                    '.row-select-checkbox'
                );

            if (row === singleRow) {

                const info =
                    getRowItemInfo(row);

                if (info && info.id) {

                    selectedVaultItems.set(
                        `${info.type}:${info.id}`,
                        info
                    );

                }

                if (checkbox) {

                    checkbox.checked =
                        true;

                }

                row.classList.add(
                    'selected'
                );

            } else {

                if (checkbox) {

                    checkbox.checked =
                        false;

                }

                row.classList.remove(
                    'selected'
                );

            }

        });

    } else {

        rows.forEach(row => {

            const info =
                getRowItemInfo(row);


            if (!info || !info.id) {
                return;
            }


            selectedVaultItems.set(
                `${info.type}:${info.id}`,
                info
            );


            const checkbox =
                row.querySelector(
                    '.row-select-checkbox'
                );


            if (checkbox) {

                checkbox.checked =
                    true;

            }


            row.classList.add(
                'selected'
            );

        });

    }


    updateSelectionBar();

}

function exitSelectionMode() {

    selectionModeActive =
        false;


    if (vaultContentSection) {

        vaultContentSection.classList.remove(
            'selection-mode'
        );

    }


    selectedVaultItems.clear();


    if (selectionBar) {

        selectionBar.hidden =
            true;

    }


    const fileList =
        document.getElementById(
            'fileList'
        );


    if (fileList) {

        fileList
            .querySelectorAll(
                '.row-select-checkbox'
            )
            .forEach(checkbox => {

                checkbox.checked =
                    false;

            });


        fileList
            .querySelectorAll(
                '.file-row.selected'
            )
            .forEach(row => {

                row.classList.remove(
                    'selected'
                );

            });

    }

}

function toggleRowSelection(
    row,
    checked
) {

    if (currentLocation !== null) {
        return;
    }

    const info =
        getRowItemInfo(row);


    if (!info || !info.id) {
        return;
    }


    const key =
        `${info.type}:${info.id}`;


    if (checked) {

        selectedVaultItems.set(
            key,
            info
        );

        row.classList.add(
            'selected'
        );

    } else {

        selectedVaultItems.delete(
            key
        );

        row.classList.remove(
            'selected'
        );

    }


    if (selectedVaultItems.size === 0) {

        exitSelectionMode();

    } else {

        updateSelectionBar();

    }

}

/*
    Delegated checkbox listener — rows are
    re-created on every render, so a single
    listener on the (stable) container avoids
    re-binding per row.
*/

document.getElementById(
    'fileList'
).addEventListener(
    'change',
    event => {

        if (currentLocation !== null) {
            return;
        }

        if (
            !event.target.classList ||
            !event.target.classList.contains(
                'row-select-checkbox'
            )
        ) {

            return;

        }


        const row =
            event.target.closest(
                '.file-row'
            );


        toggleRowSelection(
            row,
            event.target.checked
        );

    }
);

/*
    Clicking anywhere outside the selection bar,
    checkboxes, dropdown menus, or active modals
    exits selection mode cleanly.
*/

document.addEventListener(
    'click',
    event => {

        if (!selectionModeActive) {
            return;
        }

        // Keep selection if clicking inside selectionBar
        if (
            selectionBar &&
            selectionBar.contains(event.target)
        ) {
            return;
        }

        // Keep selection if clicking a checkbox
        if (
            event.target.closest &&
            event.target.closest('.row-select-checkbox')
        ) {
            return;
        }

        // Keep selection if clicking a row menu or action
        if (
            event.target.closest &&
            (
                event.target.closest('.file-actions') ||
                event.target.closest('.file-menu') ||
                event.target.closest('.file-menu-button')
            )
        ) {
            return;
        }

        // Keep selection if clicking inside an active modal overlay
        if (
            event.target.closest &&
            (
                event.target.closest('.operation-overlay') ||
                event.target.closest('.delete-confirm-overlay') ||
                event.target.closest('.restore-confirm-overlay') ||
                event.target.closest('.quarantine-inspect-overlay')
            )
        ) {
            return;
        }

        exitSelectionMode();

    }
);

document.addEventListener(
    'keydown',
    event => {

        const activeElement =
            document.activeElement;

        const isTypingContext =
            activeElement &&
            (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA'
            );


        const modifierPressed =
            isMacPlatform
                ? event.metaKey
                : event.ctrlKey;


        if (
            modifierPressed &&
            event.key.toLowerCase() === 'a' &&
            !isTypingContext
        ) {

            if (currentLocation !== null) {
                return;
            }

            const fileList =
                document.getElementById(
                    'fileList'
                );

            if (
                !fileList ||
                fileList.hidden ||
                fileList.children.length === 0
            ) {

                return;

            }


            event.preventDefault();

            enterSelectionMode();

            return;

        }


        if (
            event.key === 'Escape' &&
            selectionModeActive
        ) {

            exitSelectionMode();

            return;

        }


        if (
            event.key === 'Delete' &&
            selectionModeActive &&
            selectedVaultItems.size > 0 &&
            !isTypingContext
        ) {

            event.preventDefault();

            openDeleteConfirmation(
                'bulk',
                null,
                null,
                Array.from(
                    selectedVaultItems.values()
                )
            );

        }

    }
);

if (selectionDeleteButton) {

    selectionDeleteButton.addEventListener(
        'click',
        () => {

            if (selectedVaultItems.size === 0) {
                return;
            }

            openDeleteConfirmation(
                'bulk',
                null,
                null,
                Array.from(
                    selectedVaultItems.values()
                )
            );

        }
    );

}

if (selectionCancelButton) {

    selectionCancelButton.addEventListener(
        'click',
        () => {
            exitSelectionMode();
        }
    );

}

if (selectionRestoreButton) {

    selectionRestoreButton.addEventListener(
        'click',
        async () => {

            if (selectedVaultItems.size === 0) {
                return;
            }


            const items =
                Array.from(
                    selectedVaultItems.values()
                );


            selectionRestoreButton.disabled =
                true;


            try {

                let itemsToRestore = items;

                if (
                    typeof window.crypticLocker?.checkItemsStatus ===
                    'function'
                ) {

                    const status =
                        await window.crypticLocker
                            .checkItemsStatus(items);

                    if (
                        status &&
                        status.success &&
                        status.hasIssues
                    ) {

                        let warningActive = true;

                        while (warningActive) {

                            const warningAction =
                                await showRestoreWarning(
                                    status
                                );

                            if (warningAction === 'check-quarantine') {
                                highlightQuarantinedOrphans(
                                    extractMissingIdentifiers(status)
                                );
                                return;
                            }

                            if (warningAction !== 'continue') {
                                return;
                            }

                            const verifiedCount =
                                typeof status.verifiedFilesCount === 'number'
                                    ? status.verifiedFilesCount
                                    : (status.validCount || 0);

                            const choice =
                                await showRestoreConfirm({
                                    title:
                                        `Restore ${verifiedCount} ${
                                            verifiedCount === 1
                                                ? 'file'
                                                : 'files'
                                        }?`,
                                    name:
                                        `${verifiedCount} verified ${
                                            verifiedCount === 1
                                                ? 'file'
                                                : 'files'
                                        } will be restored`,
                                    message:
                                        'You will be asked to choose a folder where these items will be decrypted.',
                                    checkboxLabel:
                                        'Also remove the encrypted copies from the vault'
                                });

                            if (!choice.confirmed) {
                                continue;
                            }

                            closeRestoreConfirm(false);
                            warningActive = false;

                            itemsToRestore =
                                status.validItems &&
                                status.validItems.length > 0
                                    ? status.validItems
                                    : items;

                            const result =
                                await window.crypticLocker
                                    .bulkRestoreItems(
                                        itemsToRestore,
                                        choice.removeFromVault
                                    );

                            if (result.canceled) {
                                return;
                            }

                            if (!result.success) {

                                if (result.operationFailed) {
                                    return;
                                }

                                await showCustomAlert({
                                    title: 'Restore Failed',
                                    message: result.message || 'Unable to restore items.',
                                    type: 'danger'
                                });

                                return;

                            }

                            exitSelectionMode();

                            await loadVaultFiles();

                            return;

                        }

                        return;

                    }

                }


                const choice =
                    await showRestoreConfirm({
                        title:
                            `Restore ${items.length} ${
                                items.length === 1
                                    ? 'item'
                                    : 'items'
                            }?`,
                        name:
                            `${items.length} ${
                                items.length === 1
                                    ? 'item'
                                    : 'items'
                            } selected`,
                        message:
                            'You will be asked to choose a folder where these items will be decrypted.',
                        checkboxLabel:
                            'Also remove the encrypted copies from the vault'
                    });


                if (!choice.confirmed) {
                    return;
                }

                closeRestoreConfirm(false);


                const result =
                    await window
                        .crypticLocker
                        .bulkRestoreItems(
                            items,
                            choice.removeFromVault
                        );


                if (result.canceled) {
                    return;
                }


                if (!result.success) {

                    if (result.operationFailed) {
                        return;
                    }

                    await showCustomAlert({
                        title: 'Restore Failed',
                        message: result.message || 'Unable to restore items.',
                        type: 'danger'
                    });

                    return;

                }


                exitSelectionMode();

                await loadVaultFiles();


                if (
                    Array.isArray(result.failures) &&
                    result.failures.length > 0
                ) {

                    await showCustomAlert({
                        title: 'Partial Completion',
                        message: `${result.restoredItems.length} of ${
                            result.restoredItems.length +
                            result.failures.length
                        } items were restored. Some items could not be restored.`,
                        details: result.failures.map(
                            failure => `• ${failure.name}: ${failure.message}`
                        ),
                        type: 'warning'
                    });

                }


            } catch (error) {

                console.error(
                    'Bulk restore renderer error:',
                    error
                );


                await showCustomAlert({
                    title: 'Restore Error',
                    message: error?.message || 'Unable to restore items.',
                    type: 'danger'
                });

            } finally {

                closeRestoreConfirm(false);

                selectionRestoreButton.disabled =
                    false;

            }

        }
    );

}


/* =========================================
   LIVE EXPANDABLE SEARCH ENGINE
========================================= */

let activeSearchQuery = '';

const vaultSearchWrapper =
    document.getElementById(
        'vaultSearchWrapper'
    );

const vaultSearchButton =
    document.getElementById(
        'vaultSearchButton'
    );

const vaultSearchBox =
    document.getElementById(
        'vaultSearchBox'
    );

const vaultSearchInput =
    document.getElementById(
        'vaultSearchInput'
    );

const vaultSearchClearButton =
    document.getElementById(
        'vaultSearchClearButton'
    );


function openSearchBox() {

    if (
        !vaultSearchBox ||
        !vaultSearchButton
    ) {
        return;
    }

    vaultSearchButton.hidden =
        true;

    vaultSearchBox.hidden =
        false;

    if (vaultSearchInput) {

        vaultSearchInput.focus();

        if (vaultSearchClearButton) {

            vaultSearchClearButton.hidden =
                !vaultSearchInput.value;

        }

    }

}


function closeSearchBox() {

    if (
        !vaultSearchBox ||
        !vaultSearchButton
    ) {
        return;
    }

    vaultSearchBox.hidden =
        true;

    vaultSearchButton.hidden =
        false;

    vaultSearchButton.classList.toggle(
        'has-query',
        Boolean(activeSearchQuery)
    );

}


function resetSearchState() {

    activeSearchQuery = '';

    if (vaultSearchInput) {

        vaultSearchInput.value = '';

    }

    if (vaultSearchClearButton) {

        vaultSearchClearButton.hidden =
            true;

    }

    closeSearchBox();

    if (vaultSearchButton) {

        vaultSearchButton.classList.remove(
            'has-query'
        );

    }

    if (typeof renderCurrentLocation === 'function') {

        renderCurrentLocation();

    }

}


if (vaultSearchButton) {

    vaultSearchButton.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            openSearchBox();

        }
    );

}


if (vaultSearchInput) {

    vaultSearchInput.addEventListener(
        'input',
        () => {

            activeSearchQuery =
                vaultSearchInput.value
                    .trim()
                    .toLowerCase();

            if (vaultSearchClearButton) {

                vaultSearchClearButton.hidden =
                    !vaultSearchInput.value;

            }

            renderCurrentLocation();

        }
    );

    vaultSearchInput.addEventListener(
        'keydown',
        event => {

            if (event.key === 'Escape') {

                closeSearchBox();

            }

        }
    );

}


if (vaultSearchClearButton) {

    vaultSearchClearButton.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            activeSearchQuery = '';

            if (vaultSearchInput) {

                vaultSearchInput.value = '';

                vaultSearchInput.focus();

            }

            vaultSearchClearButton.hidden =
                true;

            renderCurrentLocation();

        }
    );

}


/*
    Clicking anywhere outside the search box collapses
    it back to the compact icon while keeping the
    filter active and text preserved.
*/

document.addEventListener(
    'click',
    event => {

        if (!vaultSearchWrapper) {
            return;
        }

        if (
            !vaultSearchWrapper.contains(
                event.target
            )
        ) {

            closeSearchBox();

        }

    }
);


/* =========================================
   DELETE VAULT — 3-STEP CONFIRMATION
========================================= */

const deleteVaultButton =
    document.getElementById(
        'deleteVaultButton'
    );

const deleteVaultOverlay =
    document.getElementById(
        'deleteVaultOverlay'
    );

const deleteVaultStep1 =
    document.getElementById(
        'deleteVaultStep1'
    );

const deleteVaultStep2 =
    document.getElementById(
        'deleteVaultStep2'
    );

const deleteVaultStep3 =
    document.getElementById(
        'deleteVaultStep3'
    );

const deleteVaultPasswordInput =
    document.getElementById(
        'deleteVaultPasswordInput'
    );

const deleteVaultPasswordError =
    document.getElementById(
        'deleteVaultPasswordError'
    );

const deleteVaultConfirmInput =
    document.getElementById(
        'deleteVaultConfirmInput'
    );

const deleteVaultFinalButton =
    document.getElementById(
        'deleteVaultFinalButton'
    );

let deleteVaultVerifiedPassword =
    null;


function openDeleteVaultOverlay() {

    if (!deleteVaultOverlay) {
        return;
    }

    /*
        Reset all steps to initial state.
    */

    if (deleteVaultStep1) {
        deleteVaultStep1.hidden = false;
    }

    if (deleteVaultStep2) {
        deleteVaultStep2.hidden = true;
    }

    if (deleteVaultStep3) {
        deleteVaultStep3.hidden = true;
    }

    if (deleteVaultPasswordInput) {
        deleteVaultPasswordInput.value = '';
        deleteVaultPasswordInput.type =
            'password';
    }

    if (deleteVaultPasswordError) {
        deleteVaultPasswordError.hidden =
            true;
        deleteVaultPasswordError.textContent =
            '';
    }

    if (deleteVaultConfirmInput) {
        deleteVaultConfirmInput.value = '';
    }

    if (deleteVaultFinalButton) {
        deleteVaultFinalButton.disabled =
            true;
    }

    deleteVaultVerifiedPassword = null;

    deleteVaultOverlay.hidden = false;

}


function closeDeleteVaultOverlay() {

    if (!deleteVaultOverlay) {
        return;
    }

    deleteVaultOverlay.hidden = true;

    /*
        Clear sensitive inputs.
    */

    if (deleteVaultPasswordInput) {
        deleteVaultPasswordInput.value = '';
    }

    if (deleteVaultConfirmInput) {
        deleteVaultConfirmInput.value = '';
    }

    deleteVaultVerifiedPassword = null;

}


/*
    Step 1: Warning — "Delete Vault" button
    in Settings Danger Zone opens overlay.
*/

if (deleteVaultButton) {

    deleteVaultButton.addEventListener(
        'click',
        () => {

            if (activeVaultOperations > 0) {

                if (
                    typeof showCustomAlert ===
                    'function'
                ) {

                    showCustomAlert(
                        'Operation in Progress',
                        'Please wait for the current vault operation to finish before deleting the vault.',
                        'warning'
                    );

                }

                return;

            }

            openDeleteVaultOverlay();

        }
    );

}


/*
    Step 1: Cancel
*/

const deleteVaultCancelStep1 =
    document.getElementById(
        'deleteVaultCancelStep1'
    );

if (deleteVaultCancelStep1) {

    deleteVaultCancelStep1.addEventListener(
        'click',
        closeDeleteVaultOverlay
    );

}


/*
    Step 1: "I Understand, Continue"
    → go to Step 2 (Password).
*/

const deleteVaultContinueStep1 =
    document.getElementById(
        'deleteVaultContinueStep1'
    );

if (deleteVaultContinueStep1) {

    deleteVaultContinueStep1.addEventListener(
        'click',
        () => {

            if (deleteVaultStep1) {
                deleteVaultStep1.hidden =
                    true;
            }

            if (deleteVaultStep2) {
                deleteVaultStep2.hidden =
                    false;
            }

            if (deleteVaultPasswordInput) {
                deleteVaultPasswordInput
                    .focus();
            }

        }
    );

}


/*
    Step 2: Cancel
*/

const deleteVaultCancelStep2 =
    document.getElementById(
        'deleteVaultCancelStep2'
    );

if (deleteVaultCancelStep2) {

    deleteVaultCancelStep2.addEventListener(
        'click',
        closeDeleteVaultOverlay
    );

}


/*
    Step 2: Verify Password
*/

const deleteVaultVerifyPassword =
    document.getElementById(
        'deleteVaultVerifyPassword'
    );

if (deleteVaultVerifyPassword) {

    deleteVaultVerifyPassword.addEventListener(
        'click',
        async () => {

            const password =
                deleteVaultPasswordInput
                    ?.value || '';

            if (password.length === 0) {

                if (
                    deleteVaultPasswordError
                ) {

                    deleteVaultPasswordError
                        .textContent =
                        'Please enter your master password.';

                    deleteVaultPasswordError
                        .hidden = false;

                }

                return;

            }


            /*
                Disable button while verifying.
            */

            deleteVaultVerifyPassword
                .disabled = true;

            const originalText =
                deleteVaultVerifyPassword
                    .querySelector('span');

            if (originalText) {
                originalText.textContent =
                    'Verifying...';
            }


            try {

                const verifyResult =
                    await window
                        .crypticLocker
                        .verifyPassword(
                            password
                        );

                if (
                    !verifyResult ||
                    !verifyResult.success
                ) {

                    if (
                        deleteVaultPasswordError
                    ) {
                        deleteVaultPasswordError
                            .textContent =
                            verifyResult?.message ||
                            'Incorrect password. Please try again.';
                        deleteVaultPasswordError
                            .hidden = false;
                    }

                    if (
                        deleteVaultPasswordInput
                    ) {
                        deleteVaultPasswordInput
                            .focus();
                        deleteVaultPasswordInput
                            .select();
                    }

                    return;

                }

                deleteVaultVerifiedPassword =
                    password;

                if (
                    deleteVaultPasswordError
                ) {
                    deleteVaultPasswordError
                        .hidden = true;
                    deleteVaultPasswordError
                        .textContent = '';
                }

                if (deleteVaultStep2) {
                    deleteVaultStep2.hidden =
                        true;
                }

                if (deleteVaultStep3) {
                    deleteVaultStep3.hidden =
                        false;
                }

                if (
                    deleteVaultConfirmInput
                ) {
                    deleteVaultConfirmInput
                        .focus();
                }

            } catch (verifyErr) {

                console.error(
                    'Password verify error:',
                    verifyErr
                );

                if (
                    deleteVaultPasswordError
                ) {
                    deleteVaultPasswordError
                        .textContent =
                        'Failed to verify password. Please try again.';
                    deleteVaultPasswordError
                        .hidden = false;
                }

            } finally {

                deleteVaultVerifyPassword
                    .disabled = false;

                if (originalText) {
                    originalText.textContent =
                        'Verify Password';
                }

            }

        }
    );

}


/*
    Step 2: Enter key in password input
    triggers Verify Password click.
*/

if (deleteVaultPasswordInput) {

    deleteVaultPasswordInput.addEventListener(
        'keydown',
        (event) => {

            if (event.key === 'Enter') {

                event.preventDefault();

                if (
                    deleteVaultVerifyPassword
                ) {

                    deleteVaultVerifyPassword
                        .click();

                }

            }

        }
    );

    deleteVaultPasswordInput.addEventListener(
        'input',
        () => {

            if (deleteVaultPasswordError) {
                deleteVaultPasswordError.hidden = true;
                deleteVaultPasswordError.textContent = '';
            }

        }
    );

}


/*
    Step 3: Cancel
*/

const deleteVaultCancelStep3 =
    document.getElementById(
        'deleteVaultCancelStep3'
    );

if (deleteVaultCancelStep3) {

    deleteVaultCancelStep3.addEventListener(
        'click',
        closeDeleteVaultOverlay
    );

}


/*
    Step 3: Enable/disable final
    button based on typed text.
*/

if (deleteVaultConfirmInput) {

    deleteVaultConfirmInput.addEventListener(
        'input',
        () => {

            const typed =
                deleteVaultConfirmInput
                    .value
                    .trim()
                    .toUpperCase();

            if (deleteVaultFinalButton) {

                deleteVaultFinalButton
                    .disabled =
                    typed !== 'DELETE MY VAULT';

            }

        }
    );

}


/*
    Step 3: Final — "Delete Vault
    Permanently" button.
*/

if (deleteVaultFinalButton) {

    deleteVaultFinalButton.addEventListener(
        'click',
        async () => {

            if (
                !deleteVaultVerifiedPassword
            ) {
                return;
            }

            const confirmText =
                deleteVaultConfirmInput
                    ?.value
                    ?.trim()
                    ?.toUpperCase() || '';

            if (
                confirmText !==
                'DELETE MY VAULT'
            ) {
                return;
            }


            /*
                Disable button and show
                deleting state.
            */

            deleteVaultFinalButton
                .disabled = true;

            const btnSpan =
                deleteVaultFinalButton
                    .querySelector('span');

            if (btnSpan) {
                btnSpan.textContent =
                    'Deleting...';
            }


            try {

                const result =
                    await window
                        .crypticLocker
                        .deleteVault(
                            deleteVaultVerifiedPassword
                        );


                if (
                    result &&
                    result.success
                ) {

                    /*
                        Vault deleted
                        successfully.

                        The backend already
                        redirects to
                        index.html, so we
                        just close the
                        overlay as cleanup.
                    */

                    closeDeleteVaultOverlay();

                } else {

                    /*
                        Deletion failed.
                        Show error.
                    */

                    const errorMessage =
                        result?.message ||
                        'Failed to delete vault.';

                    if (
                        typeof showCustomAlert ===
                        'function'
                    ) {

                        closeDeleteVaultOverlay();

                        showCustomAlert(
                            'Delete Vault Failed',
                            errorMessage,
                            'error'
                        );

                    }

                }

            } catch (error) {

                console.error(
                    'Delete vault error:',
                    error
                );

                if (
                    typeof showCustomAlert ===
                    'function'
                ) {

                    closeDeleteVaultOverlay();

                    showCustomAlert(
                        'Delete Vault Error',
                        'An unexpected error occurred while deleting the vault.',
                        'error'
                    );

                }

            } finally {

                deleteVaultFinalButton
                    .disabled = false;

                if (btnSpan) {
                    btnSpan.textContent =
                        'Delete Vault Permanently';
                }

            }

        }
    );

}


/* =========================================
   EXPORT VAULT
========================================= */

async function updateExportViewStats() {

    try {

        const info =
            await window
                .crypticLocker
                .getVaultSettingsInfo();

        if (info && info.success) {

            if (exportVaultStorage) {
                exportVaultStorage.textContent =
                    formatBytes(info.storageBytes || 0);
            }

            if (exportVaultFiles) {
                exportVaultFiles.textContent =
                    String(info.fileCount || 0);
            }

            if (exportVaultFolders) {
                exportVaultFolders.textContent =
                    String(info.folderCount || 0);
            }

        }

    } catch (err) {
        console.error('Failed to load export stats:', err);
    }

}

if (exportVaultButton) {

    exportVaultButton.addEventListener(
        'click',
        async () => {

            if (activeVaultOperations > 0) {

                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        title: 'Operation in Progress',
                        message: 'Please wait for the current vault operation to finish before exporting the vault.',
                        type: 'warning'
                    });
                }
                return;

            }

            exportVaultButton.disabled = true;
            const btnSpan = exportVaultButton.querySelector('span');
            const originalText = btnSpan ? btnSpan.textContent : 'Export Vault (.clvault)';
            if (btnSpan) {
                btnSpan.textContent = 'Exporting...';
            }

            try {

                const result =
                    await window
                        .crypticLocker
                        .exportVault();

                if (result && result.success) {

                    // The #operationOverlay handles displaying the official success checkmark panel.
                    // No duplicate popup alert needed.

                } else if (result && result.errorCode === 'INSUFFICIENT_STORAGE') {

                    if (typeof showCustomAlert === 'function') {
                        await showCustomAlert({
                            title: 'Insufficient Storage',
                            message: `Not enough storage space on the selected destination drive.\n\nRequired: ${formatOperationBytes(result.requiredBytes)}\nAvailable: ${formatOperationBytes(result.availableBytes)}`,
                            type: 'warning'
                        });
                    }

                } else if (result && result.canceled) {
                    // User canceled file dialog or clicked cancel during export
                } else {

                    const errorMsg = result?.message || 'Failed to export vault.';
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({
                            title: 'Export Failed',
                            message: errorMsg,
                            type: 'error'
                        });
                    }

                }

            } catch (error) {

                console.error('Export error:', error);
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        title: 'Export Error',
                        message: error.message || 'An unexpected error occurred during export.',
                        type: 'error'
                    });
                }

            } finally {

                exportVaultButton.disabled = false;
                if (btnSpan) {
                    btnSpan.textContent = originalText;
                }

            }

        }
    );

}
