/* =========================================
   ELEMENTS
========================================= */

const forgotPasswordSubmitButton =
    document.getElementById(
        'forgotPasswordSubmitButton'
    );

const password =
    document.getElementById('password');

const confirmPassword =
    document.getElementById('confirmPassword');

const lengthRule =
    document.getElementById('lengthRule');

const caseRule =
    document.getElementById('caseRule');

const numberRule =
    document.getElementById('numberRule');

const strengthText =
    document.getElementById('strengthText');

const strengthBars =
    document.querySelectorAll(
        '.strength-bars span'
    );

const form =
    document.getElementById('vaultForm');

const formError =
    document.getElementById('formError');

const screenTitle =
    document.getElementById('screenTitle');

const screenDescription =
    document.getElementById(
        'screenDescription'
    );

const confirmPasswordGroup =
    document.getElementById(
        'confirmPasswordGroup'
    );

const strengthSection =
    document.getElementById(
        'strengthSection'
    );

const requirementsSection =
    document.getElementById(
        'requirementsSection'
    );

const submitButton =
    document.getElementById(
        'submitButton'
    );

const submitButtonText =
    document.getElementById(
        'submitButtonText'
    );

const securityText =
    document.getElementById(
        'securityText'
    );

const importVaultOption =
    document.getElementById(
        'importVaultOption'
    );

const importVaultButton =
    document.getElementById(
        'importVaultButton'
    );

const importProgressCard =
    document.getElementById(
        'importProgressCard'
    );

const importProgressTitle =
    document.getElementById(
        'importProgressTitle'
    );

const importProgressPercent =
    document.getElementById(
        'importProgressPercent'
    );

const importProgressBarFill =
    document.getElementById(
        'importProgressBarFill'
    );

const importProgressDetails =
    document.getElementById(
        'importProgressDetails'
    );

const importCancelButton =
    document.getElementById(
        'importCancelButton'
    );

const importBoostDropdown =
    document.getElementById(
        'importBoostDropdown'
    );

const importBoostButton =
    document.getElementById(
        'importBoostButton'
    );

const importBoostMenu =
    document.getElementById(
        'importBoostMenu'
    );

const importBoostSelectedText =
    document.getElementById(
        'importBoostSelectedText'
    );

/* =========================================
FORGOT PASSWORD ELEMENTS
========================================= */

const authScreen =
    document.getElementById(
        'authScreen'
    );

const forgotPasswordScreen =
    document.getElementById(
        'forgotPasswordScreen'
    );

const recoveryKeyInput =
    document.getElementById(
        'recoveryKey'
    );

recoveryKeyInput.addEventListener(
    'input',
    () => {

        let value =
            recoveryKeyInput.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');

        value =
            value.substring(0, 56);

        let formatted = '';

        for (
            let i = 0;
            i < value.length;
            i++
        ) {

            if (
                i > 0 &&
                i % 4 === 0
            ) {

                formatted += '-';

            }

            formatted += value[i];

        }

        recoveryKeyInput.value =
            formatted;

    }
);

const forgotPasswordInput =
    document.getElementById(
        'forgotPassword'
    );

const forgotConfirmPasswordInput =
    document.getElementById(
        'forgotConfirmPassword'
    );

const forgotPasswordError =
    document.getElementById(
        'forgotPasswordError'
    );

const backToLoginButton =
    document.getElementById(
        'backToLoginButton'
    );

const forgotPasswordSubmitButtonText =
    document.getElementById(
        'forgotPasswordSubmitButtonText'
    );

const forgotPasswordLink =
    document.getElementById(
        'forgotPasswordLink'
    );

const forgotPasswordContainer =
    document.getElementById(
        'forgotPasswordContainer'
    );


/* =========================================
   CURRENT SCREEN MODE
========================================= */

let screenMode = 'loading';

/*
    Stores the REAL recovery key.

    The input field will later display
    only a masked version.
*/

/* =========================================
   INITIALIZE APP
========================================= */

async function initializeApp() {

    submitButton.disabled = true;

    try {

        const settingsResult =
            await window
                .crypticLocker
                .getSettings();

        if (
            settingsResult &&
            settingsResult.success === true &&
            settingsResult.settings
        ) {

            const rawTheme =
                settingsResult.settings.theme || 'dark';

            let theme = 'dark';

            if (rawTheme === 'light' || rawTheme === 'dark') {

                theme = rawTheme;

            } else if (rawTheme === 'system') {

                const isDark =
                    window.matchMedia &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches;

                theme = isDark ? 'dark' : 'light';

            }

            document.documentElement.dataset.theme =
                theme;

            try {

                window.localStorage.setItem(
                    'cl-theme',
                    rawTheme
                );

            } catch (storageError) {

                console.error(
                    'Unable to persist theme locally:',
                    storageError
                );

            }

        }

    } catch (error) {

        console.error(
            'Unable to load theme setting:',
            error
        );

    }

    if (window.matchMedia) {

        window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', () => {

                const savedTheme =
                    window.localStorage.getItem('cl-theme');

                if (savedTheme === 'system') {

                    const isDark =
                        window.matchMedia('(prefers-color-scheme: dark)').matches;

                    document.documentElement.dataset.theme =
                        isDark ? 'dark' : 'light';

                }

            });

    }

    const successMessage =
        await window
            .crypticLocker
            .getLoginSuccessMessage();

    if (successMessage) {

        formError.style.color =
            'var(--success)';

        formError.textContent =
            successMessage;

    }

    try {

        /*
            First check whether this running
            CrypticLocker process already has
            an unlocked vault session.
        */

        const session =
            await window.crypticLocker
                .getSessionStatus();


        if (session.unlocked) {

            window.location.replace(
                'dashboard.html'
            );

            return;

        }


        const exists =
            await window.crypticLocker
                .vaultExists();

        if (exists) {

            showUnlockScreen(
                !!successMessage
            );

        } else {

            showCreateScreen();

        }


    } catch (error) {

        console.error(error);


        formError.style.color =
            'var(--danger)';

        formError.textContent =
            'Unable to initialize CrypticLocker.';

    }

}


initializeApp();

function hideAllScreens() {

    authScreen.style.display = 'none';

    forgotPasswordScreen.style.display =
        'none';

    if (importVaultOption) {
        importVaultOption.style.display =
            'none';
    }

}

/* =========================================
   CREATE SCREEN
========================================= */

function showCreateScreen() {

    hideAllScreens();

    authScreen.style.display = 'block';

    if (importVaultOption) {
        importVaultOption.style.display =
            'block';
    }

    screenMode = 'create';


    screenTitle.textContent =
        'Create your vault';

    screenDescription.textContent =
        'Create a master password to protect your private files.';


    confirmPasswordGroup.style.display =
        'block';

    strengthSection.style.display =
        'block';

    requirementsSection.style.display =
        'grid';


    password.placeholder =
        'Enter a strong password';

    password.setAttribute(
        'autocomplete',
        'new-password'
    );


    submitButtonText.textContent =
        'Create Vault';

    submitButton.disabled = false;

    forgotPasswordContainer.style.display =
        'none';


    securityText.textContent =
        'Your vault will be encrypted and stored locally on this device.';


    password.focus();

}


/* =========================================
   FAILED ATTEMPTS & LOCKOUT COUNTDOWN
========================================= */

let lockoutIntervalId = null;

function clearLockoutCountdown() {
    if (lockoutIntervalId) {
        clearInterval(lockoutIntervalId);
        lockoutIntervalId = null;
    }
}

function startLockoutCountdown(totalSeconds) {
    clearLockoutCountdown();
    let remaining = Math.max(1, Math.ceil(totalSeconds));

    password.disabled = true;
    submitButton.disabled = true;

    function renderCountdown() {
        if (remaining <= 0) {
            clearLockoutCountdown();
            password.disabled = false;
            submitButton.disabled = false;
            submitButtonText.textContent = 'Unlock Vault';
            formError.textContent = '';
            formError.style.color = '';
            password.focus();
            return;
        }

        submitButtonText.textContent = `Try again in ${remaining}s`;
        formError.style.color = 'var(--danger)';
        formError.textContent = `Too many failed attempts. Please wait ${remaining}s before trying again.`;
        remaining--;
    }

    renderCountdown();
    lockoutIntervalId = setInterval(renderCountdown, 1000);
}

async function checkAndApplyLockout() {
    if (screenMode !== 'unlock') return;
    try {
        if (
            window.crypticLocker &&
            typeof window.crypticLocker.getLockoutStatus === 'function'
        ) {
            const status = await window.crypticLocker.getLockoutStatus();
            if (status && status.locked && status.remainingSeconds > 0) {
                startLockoutCountdown(status.remainingSeconds);
            }
        }
    } catch (err) {
        console.error('Error checking lockout status:', err);
    }
}


/* =========================================
   UNLOCK SCREEN
========================================= */

function showUnlockScreen(
    preserveMessage = false
) {

    hideAllScreens();

    authScreen.style.display = 'block';

    screenMode = 'unlock';


    screenTitle.textContent =
        'Welcome back';

    screenDescription.textContent =
        'Enter your master password to unlock your vault.';


    confirmPasswordGroup.style.display =
        'none';

    strengthSection.style.display =
        'none';

    requirementsSection.style.display =
        'none';


    password.placeholder =
        'Enter your master password';

    password.setAttribute(
        'autocomplete',
        'current-password'
    );


    submitButtonText.textContent =
        'Unlock Vault';

    submitButton.disabled = false;

    forgotPasswordContainer.style.display =
        'flex';


    securityText.textContent =
        'Encrypted locally. Protected privately.';


    if (!preserveMessage) {

        formError.textContent = '';

        formError.style.color = '';

    }

    password.value = '';

    confirmPassword.value = '';


    password.focus();

    checkAndApplyLockout();

}


/* =========================================
   FORGOT PASSWORD SCREEN
========================================= */

function showForgotPasswordScreen() {

    screenMode = 'forgot';

    hideAllScreens();

    forgotPasswordScreen.style.display =
        'block';

    screenTitle.textContent =
        'Forgot Password';

    screenDescription.textContent =
        'Verify your recovery key and create a new master password.';

    securityText.textContent =
        'Reset your vault password using your recovery key.';

    recoveryKeyInput.value = '';

    forgotPasswordInput.value = '';

    forgotConfirmPasswordInput.value = '';

    forgotPasswordError.textContent = '';

    forgotPasswordContainer.style.display =
        'none';

    recoveryKeyInput.focus();

}

/* =========================================
   PASSWORD VALIDATION
========================================= */

function checkPassword() {

    /*
        Strength indicator is only relevant
        while creating a new vault.
    */

    if (screenMode !== 'create') {
        return;
    }


    const value =
        password.value;


    const hasLength =
        value.length >= 8;

    const hasUpper =
        /[A-Z]/.test(value);

    const hasLower =
        /[a-z]/.test(value);

    const hasNumber =
        /[0-9]/.test(value);

    const hasSpecial =
        /[^A-Za-z0-9]/.test(value);


    lengthRule.classList.toggle(
        'valid',
        hasLength
    );


    caseRule.classList.toggle(
        'valid',
        hasUpper && hasLower
    );


    numberRule.classList.toggle(
        'valid',
        hasNumber
    );


    let score = 0;


    if (hasLength) {
        score++;
    }

    if (hasUpper && hasLower) {
        score++;
    }

    if (hasNumber) {
        score++;
    }

    if (hasSpecial) {
        score++;
    }


    updateStrength(score);

}


function updateStrength(score) {

    const colors = [
        'var(--border)',
        'var(--danger)',
        'var(--warning)',
        'var(--primary)',
        'var(--success)'
    ];


    const labels = [
        'Not set',
        'Weak',
        'Fair',
        'Good',
        'Strong'
    ];


    strengthBars.forEach(
        (bar, index) => {

            if (index < score) {

                bar.style.background =
                    colors[score];

            } else {

                bar.style.background =
                    'var(--border)';

            }

        }
    );


    strengthText.textContent =
        labels[score];


    strengthText.style.color =
        score === 0
            ? 'var(--muted)'
            : colors[score];

}

/* =========================================
   RECOVERY KEY FORMAT
========================================= */

recoveryKeyInput.addEventListener(
    'input',
    () => {

        forgotPasswordError.textContent = '';

    }
);

password.addEventListener(
    'input',
    () => {

        checkPassword();

        /*
            Remove old error as user starts
            typing another password.
        */

        if (screenMode === 'unlock') {

            formError.textContent = '';

        }

    }
);


forgotPasswordSubmitButton.addEventListener(
    'click',
    async () => {

        forgotPasswordError.textContent = '';

        forgotPasswordSubmitButton.disabled = true;

        forgotPasswordSubmitButtonText.textContent =
            'Resetting...';

        const recoveryKey =
            recoveryKeyInput.value.trim();

        const newPassword =
            forgotPasswordInput.value;

        const confirmPassword =
            forgotConfirmPasswordInput.value;

        if (!recoveryKey) {

            forgotPasswordError.textContent =
                'Enter your recovery key.';

            forgotPasswordSubmitButton.disabled = false;

            forgotPasswordSubmitButtonText.textContent =
                'Reset Password';

            return;

        }

        if (newPassword.length < 8) {

            forgotPasswordError.textContent =
                'Password must be at least 8 characters.';

            forgotPasswordSubmitButton.disabled = false;

            forgotPasswordSubmitButtonText.textContent =
                'Reset Password';

            return;

        }

        if (newPassword !== confirmPassword) {

            forgotPasswordError.textContent =
                'Passwords do not match.';

            forgotPasswordSubmitButton.disabled = false;

            forgotPasswordSubmitButtonText.textContent =
                'Reset Password';

            return;

        }

        const result =
            await window.crypticLocker.resetPassword(
                recoveryKey,
                newPassword
            );

        if (!result.success) {

            forgotPasswordError.textContent =
                result.message;

            forgotPasswordSubmitButton.disabled = false;

            forgotPasswordSubmitButtonText.textContent =
                'Reset Password';

            return;

        }

        // Success

        // Clear forgot password form

        recoveryKeyInput.value = '';
        forgotPasswordInput.value = '';
        forgotConfirmPasswordInput.value = '';
        forgotPasswordError.textContent = '';


        // Hide forgot password screen

        forgotPasswordScreen.style.display =
            'none';


        // Show login screen

        authScreen.style.display =
            'block';

        forgotPasswordSubmitButton.disabled = false;

        forgotPasswordSubmitButtonText.textContent =
            'Reset Password';

        showUnlockScreen();

        formError.style.color =
            'var(--success)';

        formError.textContent =
            'Password reset successfully. Log in using your new password.';


        // Focus password field

        password.value = '';

        password.focus();

    }
);

forgotPasswordInput.addEventListener(
    'input',
    () => {

        forgotPasswordError.textContent = '';

    }
);

forgotConfirmPasswordInput.addEventListener(
    'input',
    () => {

        forgotPasswordError.textContent = '';

    }
);

/* =========================================
   SHOW / HIDE PASSWORD
========================================= */

forgotPasswordLink.addEventListener(
    'click',
    showForgotPasswordScreen
);

backToLoginButton.addEventListener(
    'click',
    showUnlockScreen
);

document
    .querySelectorAll(
        '.toggle-password'
    )
    .forEach(button => {

        button.addEventListener(
            'click',
            () => {

                const target =
                    document.getElementById(
                        button.dataset.target
                    );


                if (
                    target.type ===
                    'password'
                ) {

                    target.type =
                        'text';

                    button.classList.add(
                        'visible'
                    );

                    button.setAttribute(
                        'aria-label',
                        'Hide password'
                    );

                } else {

                    target.type =
                        'password';

                    button.classList.remove(
                        'visible'
                    );

                    button.setAttribute(
                        'aria-label',
                        'Show password'
                    );

                }

            }
        );

    });


/* =========================================
   FORM SUBMIT
========================================= */

form.addEventListener(
    'submit',
    async event => {

        event.preventDefault();


        if (screenMode === 'create') {

            await handleCreateVault();

        } else if (
            screenMode === 'unlock'
        ) {

            await handleUnlockVault();

        }

    }
);


/* =========================================
   CREATE VAULT
========================================= */

async function handleCreateVault() {

    formError.style.color =
        'var(--danger)';

    formError.textContent = '';


    const value =
        password.value;

    const confirmValue =
        confirmPassword.value;


    const validPassword =
        value.length >= 8 &&
        /[A-Z]/.test(value) &&
        /[a-z]/.test(value) &&
        /[0-9]/.test(value);


    if (!validPassword) {

        formError.textContent =
            'Please meet all password requirements.';

        return;

    }


    if (value !== confirmValue) {

        formError.textContent =
            'Passwords do not match.';

        return;

    }


    setButtonLoading(
        'Creating Vault...'
    );


    try {

        const result =
            await window.crypticLocker
                .createVault(value);


        if (!result.success) {

            formError.style.color =
                'var(--danger)';

            formError.textContent =
                result.message ||
                'Unable to create vault.';

            resetButton();

            return;

        }


        password.value = '';
        confirmPassword.value = '';


        /*
    Vault now exists.
    Switch directly to the unlock screen.
*/

        showUnlockScreen();


        formError.style.color =
            'var(--success)';

        formError.textContent =
            'Vault created successfully. Unlock it to continue.';


    } catch (error) {

        console.error(error);


        formError.style.color =
            'var(--danger)';

        formError.textContent =
            'Something went wrong while creating the vault.';


        resetButton();

    }

}


/* =========================================
   UNLOCK VAULT
========================================= */

async function handleUnlockVault() {

    formError.style.color =
        'var(--danger)';

    formError.textContent = '';


    const value =
        password.value;


    if (!value) {

        formError.textContent =
            'Enter your master password.';

        password.focus();

        return;

    }


    setButtonLoading(
        'Unlocking...'
    );


    try {

        const result =
            await window.crypticLocker
                .unlockVault(value);


        /*
            Clear password field immediately
            after IPC operation completes.
        */

        password.value = '';


        if (!result.success) {

            formError.style.color =
                'var(--danger)';

            if (result.locked && result.remainingSeconds > 0) {
                startLockoutCountdown(result.remainingSeconds);
                return;
            }

            formError.textContent =
                result.message ||
                'Incorrect master password.';


            resetButton();

            password.focus();

            return;

        }

        clearLockoutCountdown();

        formError.style.color =
            'var(--success)';

        formError.textContent =
            'Vault unlocked successfully.';


        submitButtonText.textContent =
            'Unlocked ✓';

        submitButton.disabled =
            true;


        /*
            Open the main CrypticLocker
            dashboard after successful unlock.
        */

        setTimeout(() => {

            window.location.href =
                'dashboard.html';

        }, 350);


    } catch (error) {

        console.error(error);


        password.value = '';


        formError.style.color =
            'var(--danger)';

        formError.textContent =
            'Unable to unlock the vault.';


        resetButton();

        password.focus();

    }

}

/* =========================================
   BUTTON HELPERS
========================================= */

function setButtonLoading(text) {

    submitButton.disabled = true;

    submitButtonText.textContent = text;

}


function resetButton() {

    submitButton.disabled = false;


    if (screenMode === 'create') {

        submitButtonText.textContent =
            'Create Vault';

    } else {

        submitButtonText.textContent =
            'Unlock Vault';

    }

}


/* =========================================
   IMPORT VAULT & PROGRESS MANAGEMENT
========================================= */

function formatImportBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function setImportInProgress(inProgress) {
    const vaultCard = document.querySelector('.vault-card');
    if (vaultCard) {
        vaultCard.classList.toggle('importing-active', inProgress);
    }

    if (inProgress) {
        if (screenTitle) screenTitle.textContent = 'Importing Vault';
        if (screenDescription) screenDescription.textContent = 'Restoring encrypted files and vault structure...';
    } else {
        if (screenTitle && screenMode === 'create') {
            screenTitle.textContent = 'Create your vault';
            screenDescription.textContent = 'Create a master password to protect your private files.';
        }
        if (typeof closeImportBoostDropdown === 'function') {
            closeImportBoostDropdown();
        }
    }

    if (password) password.disabled = inProgress;
    if (confirmPassword) confirmPassword.disabled = inProgress;
    if (submitButton) submitButton.disabled = inProgress;
    if (importVaultButton) importVaultButton.disabled = inProgress;

    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(btn => {
        btn.disabled = inProgress;
    });

    if (importProgressCard) {
        importProgressCard.style.display = inProgress ? 'flex' : 'none';
        if (inProgress) {
            if (importProgressPercent) importProgressPercent.textContent = '0%';
            if (importProgressBarFill) importProgressBarFill.style.width = '0%';
            if (importProgressTitle) importProgressTitle.textContent = 'Preparing import...';
            if (importProgressDetails) importProgressDetails.textContent = 'Opening archive...';
            if (importCancelButton) {
                importCancelButton.disabled = false;
                const cancelSpan = importCancelButton.querySelector('span');
                if (cancelSpan) cancelSpan.textContent = 'Cancel';
            }
        }
    }
}

let currentImportOperationId = null;

if (
    window.crypticLocker &&
    typeof window.crypticLocker.onOperationProgress === 'function'
) {
    window.crypticLocker.onOperationProgress(progress => {
        if (!progress || progress.operation !== 'import') return;

        if (progress.operationId) {
            currentImportOperationId = progress.operationId;
        }

        if (progress.status === 'started' || progress.status === 'progress') {
            if (importProgressCard && importProgressCard.style.display === 'none') {
                setImportInProgress(true);
            }

            const totalBytes = Number(progress.totalBytes) || 0;
            const processedBytes = Number(progress.processedBytes) || 0;
            const percentage = totalBytes > 0
                ? Math.min(100, Math.max(0, Math.round((processedBytes / totalBytes) * 100)))
                : 0;

            if (importProgressPercent) {
                importProgressPercent.textContent = `${percentage}%`;
            }
            if (importProgressBarFill) {
                importProgressBarFill.style.width = `${percentage}%`;
            }

            if (importProgressTitle) {
                if (progress.currentFile === 'Verifying package integrity...') {
                    importProgressTitle.textContent = 'Verifying package integrity...';
                } else {
                    importProgressTitle.textContent = 'Restoring encrypted files...';
                }
            }

            if (importProgressDetails) {
                const totalFiles = Number(progress.totalFiles) || 0;
                const completedFiles = Number(progress.completedFiles) || 0;
                if (totalFiles > 0) {
                    const formattedProcessed = formatImportBytes(processedBytes);
                    const formattedTotal = formatImportBytes(totalBytes);
                    importProgressDetails.textContent = `${completedFiles} / ${totalFiles} files (${formattedProcessed} / ${formattedTotal})`;
                } else {
                    importProgressDetails.textContent = progress.currentFile || 'Processing package...';
                }
            }
        } else if (progress.status === 'completed') {
            if (importProgressPercent) importProgressPercent.textContent = '100%';
            if (importProgressBarFill) importProgressBarFill.style.width = '100%';
            if (importProgressTitle) importProgressTitle.textContent = 'Vault imported successfully!';
            if (importProgressDetails) importProgressDetails.textContent = 'Finalizing...';
        } else if (progress.status === 'cancelled') {
            setImportInProgress(false);
            formError.style.color = 'var(--muted)';
            formError.textContent = 'Vault import was cancelled.';
        }
    });
}

if (importCancelButton) {
    importCancelButton.addEventListener('click', async () => {
        importCancelButton.disabled = true;
        const cancelSpan = importCancelButton.querySelector('span');
        if (cancelSpan) {
            cancelSpan.textContent = 'Cancelling...';
        }
        if (
            currentImportOperationId &&
            window.crypticLocker &&
            typeof window.crypticLocker.cancelOperation === 'function'
        ) {
            try {
                await window.crypticLocker.cancelOperation(currentImportOperationId);
            } catch (err) {
                console.error('Failed to cancel import operation:', err);
            }
        }
    });
}

if (importVaultButton) {

    importVaultButton.addEventListener(
        'click',
        async () => {

            formError.textContent = '';
            formError.style.color = 'var(--danger)';

            const btnSpan = importVaultButton.querySelector('span');
            const originalText = btnSpan ? btnSpan.textContent : 'Import Existing Vault (.clvault)';

            importVaultButton.disabled = true;
            if (btnSpan) {
                btnSpan.textContent = 'Selecting file...';
            }

            try {

                const result =
                    await window
                        .crypticLocker
                        .importVault();

                if (result && result.success) {

                    // If a theme was restored from the imported package, apply it immediately
                    if (result.theme) {
                        let themeToApply = result.theme;
                        if (themeToApply === 'system') {
                            const isDark =
                                window.matchMedia &&
                                window.matchMedia('(prefers-color-scheme: dark)').matches;
                            themeToApply = isDark ? 'dark' : 'light';
                        }
                        document.documentElement.dataset.theme = themeToApply;
                        try {
                            window.localStorage.setItem('cl-theme', result.theme);
                        } catch { }
                    }

                    setImportInProgress(false);

                    // Show success on the unlock screen
                    showUnlockScreen(true);

                    formError.style.color = 'var(--success)';
                    formError.textContent = 'Vault imported successfully! Enter your master password to unlock.';

                } else if (result && result.errorCode === 'INSUFFICIENT_STORAGE') {

                    setImportInProgress(false);
                    formError.style.color = 'var(--danger)';
                    const req = formatImportBytes(result.requiredBytes);
                    const avail = formatImportBytes(result.availableBytes);
                    formError.textContent = `Insufficient storage space on your device. Required: ${req}, Available: ${avail}.`;

                } else if (result && result.canceled) {

                    // User canceled file picker or cancelled during import
                    setImportInProgress(false);
                    formError.style.color = 'var(--muted)';
                    formError.textContent = '';

                } else {

                    setImportInProgress(false);
                    formError.style.color = 'var(--danger)';
                    formError.textContent = result?.message || 'Failed to import vault package.';

                }

            } catch (err) {

                console.error('Import error:', err);
                setImportInProgress(false);
                formError.style.color = 'var(--danger)';
                formError.textContent = err.message || 'An error occurred during vault import.';

            } finally {

                importVaultButton.disabled = false;
                if (btnSpan) {
                    btnSpan.textContent = originalText;
                }

            }

        }
    );

}

/* =========================================
   CUSTOM GLASSMORPHIC FLOATING TOOLTIP ENGINE
========================================= */

function initCustomTooltipEngine() {
    let tooltipEl = document.getElementById('customTooltipPortal');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'customTooltipPortal';
        tooltipEl.className = 'custom-tooltip-portal';
        document.body.appendChild(tooltipEl);
    }

    let activeTarget = null;
    let showTimeout = null;

    function hideTooltip() {
        if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
        }
        activeTarget = null;
        if (tooltipEl) {
            tooltipEl.classList.remove('visible');
        }
    }

    function positionTooltip(target) {
        const text = target.getAttribute('data-tooltip');
        if (!text || !tooltipEl) return;

        tooltipEl.textContent = text;
        const targetRect = target.getBoundingClientRect();

        tooltipEl.style.left = '0px';
        tooltipEl.style.top = '0px';
        const tooltipRect = tooltipEl.getBoundingClientRect();

        let top = targetRect.top - tooltipRect.height - 8;
        if (top < 10) {
            top = targetRect.bottom + 8;
        }

        let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        const padding = 10;
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.top = `${Math.round(top)}px`;
        tooltipEl.classList.add('visible');
    }

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        if (activeTarget === target) return;

        activeTarget = target;
        if (showTimeout) clearTimeout(showTimeout);
        showTimeout = setTimeout(() => {
            if (activeTarget === target) {
                positionTooltip(target);
            }
        }, 80);
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target && activeTarget === target) {
            hideTooltip();
        }
    });

    document.addEventListener('mousedown', hideTooltip);
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('blur', hideTooltip);
}

initCustomTooltipEngine();

/* =========================================
   IMPORT I/O ACCELERATION DROPDOWN CONTROLLER
========================================= */

let cachedImportHardwareProfile = null;
let activeImportBoostTierId = 'tier1';

function updateImportBoostDropdownUI(tierId) {
    activeImportBoostTierId = tierId;
    if (!cachedImportHardwareProfile || !cachedImportHardwareProfile.tiers) return;

    const currentTier = cachedImportHardwareProfile.tiers.find(t => t.id === tierId) || cachedImportHardwareProfile.tiers[0];
    if (importBoostSelectedText && currentTier) {
        importBoostSelectedText.textContent = currentTier.label;
    }
    if (importBoostMenu) {
        importBoostMenu.querySelectorAll('.custom-dropdown-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === tierId);
        });
    }
}

function closeImportBoostDropdown() {
    if (importBoostDropdown && importBoostMenu) {
        importBoostDropdown.classList.remove('open');
        importBoostMenu.hidden = true;
        if (importBoostButton) {
            importBoostButton.setAttribute('aria-expanded', 'false');
        }
    }
}

async function initImportBoostEngine() {
    try {
        closeImportBoostDropdown();
        if (window.crypticLocker && typeof window.crypticLocker.getHardwareProfile === 'function') {
            const res = await window.crypticLocker.getHardwareProfile();
            if (res && res.success && res.profile) {
                cachedImportHardwareProfile = res.profile;
                activeImportBoostTierId = res.profile.activeId || 'tier1';
                renderImportBoostMenu();
                updateImportBoostDropdownUI(activeImportBoostTierId);
                closeImportBoostDropdown();
            }
        }
    } catch (err) {
        console.error('Failed to initialize import hardware boost profile:', err);
    }
}

function renderImportBoostMenu() {
    if (!importBoostMenu || !cachedImportHardwareProfile || !cachedImportHardwareProfile.tiers) return;
    importBoostMenu.innerHTML = '';
    cachedImportHardwareProfile.tiers.forEach((tier) => {
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = 'custom-dropdown-item';
        itemBtn.dataset.id = tier.id;
        itemBtn.setAttribute('role', 'option');
        if (tier.id === activeImportBoostTierId) {
            itemBtn.classList.add('active');
        }
        itemBtn.textContent = tier.label;
        itemBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            updateImportBoostDropdownUI(tier.id);
            closeImportBoostDropdown();
            if (window.crypticLocker && typeof window.crypticLocker.setIoAcceleration === 'function') {
                try {
                    await window.crypticLocker.setIoAcceleration(tier);
                } catch (setErr) {
                    console.error('Failed to set I/O acceleration tier:', setErr);
                }
            }
        });
        importBoostMenu.appendChild(itemBtn);
    });
}

if (importBoostButton && importBoostMenu) {
    importBoostButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = importBoostDropdown && importBoostDropdown.classList.contains('open');
        if (!isOpen) {
            if (!importBoostMenu.children.length && cachedImportHardwareProfile) {
                renderImportBoostMenu();
            }
            if (importBoostDropdown) importBoostDropdown.classList.add('open');
            importBoostMenu.hidden = false;
            importBoostButton.setAttribute('aria-expanded', 'true');
        } else {
            closeImportBoostDropdown();
        }
    });

    document.addEventListener('click', (e) => {
        if (importBoostDropdown && !importBoostDropdown.contains(e.target)) {
            closeImportBoostDropdown();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImportBoostDropdown();
        }
    });
}

initImportBoostEngine();