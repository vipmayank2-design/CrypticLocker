# CrypticLocker 🛡️
> **Enterprise-Grade Offline-First Desktop Vault & Cryptographic Container**  
> *Commercial Turnkey Software Asset — Full Intellectual Property (IP) & Source Code Distribution*

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/vipmayank2-design/CrypticLocker)
[![Architecture](https://img.shields.io/badge/Arch-x64%20%7C%20ARM64%20(Apple%20Silicon)-success.svg)](https://github.com/vipmayank2-design/CrypticLocker)
[![Tests](https://img.shields.io/badge/Audit-13%2F13%20Suites%20Passed%20(100%25)-brightgreen.svg)](https://github.com/vipmayank2-design/CrypticLocker)
[![Security](https://img.shields.io/badge/Cipher-AES--256--GCM%20%2B%20Scrypt-orange.svg)](https://github.com/vipmayank2-design/CrypticLocker)
[![License](https://img.shields.io/badge/License-Commercial%20Asset-lightgrey.svg)](LICENSE)

---

## 1. Executive Summary & Asset Overview

**CrypticLocker** is a production-ready, zero-knowledge personal desktop vault designed for ultra-secure local storage, streaming encryption, and portable archiving of sensitive files and folders.

Built with an uncompromising **Offline-First / Zero-Telemetry** design philosophy, CrypticLocker never transmits user data, encryption keys, or biometric telemetry outside the host machine. All cryptographic operations are processed on the local hardware via hardware-accelerated AES-NI pipelines.

### 💼 Technical Acquisition Highlights
* **100% Turnkey Codebase**: Clean, audited, enterprise JavaScript with zero technical debt or prototype residue.
* **Commercial Anonymity**: Clean git commit history, verified author metadata (`CrypticLocker Technologies`), and zero hardcoded developer paths or credentials.
* **Master Health Audit**: Automated test suite (`npm test`) with 13 comprehensive test suites validating cryptography, streaming pipelines, lockout ladders, and UI integrity in under 2 seconds.
* **Multi-Platform Automated CI/CD**: Pre-configured GitHub Actions matrix pipeline compiling native binaries for **Windows**, **macOS (Apple Silicon & Intel)**, and **Linux** concurrently.

---

## 2. Core Cryptographic Architecture

CrypticLocker implements an enterprise **Dual-Key Envelope Architecture** utilizing military-grade symmetric encryption and memory-hardened password derivation.

```
                          [ User Master Password ]
                                     │
                                     ▼
                   [ Scrypt KDF (N=16384, r=8, p=1) ]
                                     │
                                     ▼
                       [ Password Unlock Key (PUK) ]
                                     │
                                     ▼
      ┌─────────────────────────────────────────────────────────────┐
      │  Vault Master Key Package (VMK) Decryption (AES-256-GCM)   │
      └─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                        [ Vault Master Key (VMK) ]
                                     │
                                     ▼
      ┌─────────────────────────────────────────────────────────────┐
      │     Streaming Payload Encryption / Decryption Engine        │
      │   • Per-file unique 96-bit cryptographic IVs                │
      │   • Authenticated 128-bit GCM authentication tags           │
      │   • 512 KB dynamic chunked streaming pipeline               │
      └─────────────────────────────────────────────────────────────┘
```

### Cryptographic Parameters
* **Primary Symmetric Cipher**: `AES-256-GCM` (Authenticated Galois/Counter Mode).
* **Key Derivation Function (KDF)**: `Scrypt` (`N=16384`, `r=8`, `p=1`, key length = 32 bytes).
* **Master Recovery Key**: 256-bit entropy derived via high-iteration PBKDF2 (`100,000` iterations, SHA-512) formatted as standard human-readable, hyphenated hexadecimal groups.
* **Zero-Knowledge Memory Hygiene**: In-memory keys and session secrets are scrubbed upon vault lock, application blur/timeout, or explicit session destruction.

---

## 3. Subsystem & Feature Specifications

### 🗄️ 1. File & Folder Engine
* **Add File / Add Folder**: Supports both **COPY** (preserves host source) and **MOVE** (securely migrates source and unlinks original upon atomic verification).
* **High-Speed Chunked Streaming**: 512 KB chunk buffer enables processing multi-gigabyte files with constant, minimal RAM footprint (< 80 MB).
* **Instant Cancellation & Atomic Rollback**: Operations can be cancelled in real-time. Incomplete operations trigger immediate atomic stream destruction and unlinking, leaving zero orphaned chunks.

### 📦 2. Enterprise Vault Backup & Restore (`.clvault`)
* **Proprietary Archive Format**: `.clvault` is a tamper-evident, self-contained binary archive packaging encrypted vault assets, folder hierarchy trees, and integrity checksums.
* **Pre-Check Disk Quota Engine**: Validates destination drive capacity prior to export/import to avoid mid-stream out-of-disk failures.
* **Native OS Association**: Windows Explorer and file managers natively recognize and associate with `.clvault` files.

### 🧪 3. Quarantine & Deep Byte Inspection Subsystem
* Detects and isolates orphaned or structurally desynchronized encrypted blocks.
* Inspects payload headers, cryptographic integrity tags, and structure without decrypting payload data.
* Provides 1-click byte-level repair, orphan recovery, or permanent purging.

### 🛡️ 4. Security Hardening & Lockout System
* **Progressive Lockout Ladder**: Enforces exponential cooldown periods after repeated invalid unlock attempts to mitigate brute-force dictionary attacks.
* **Auto-Lock Engine**: Configurable idle timeout (default 1 minute) and automated lock upon OS sleep/screen-lock events.
* **Danger Zone Reset**: 3-step verification modal with mandatory password challenge for permanent vault destruction.

---

## 4. Codebase Directory Structure

```
CrypticLocker/
├── .github/
│   └── workflows/
│       └── build.yml               # Automated 3-platform GitHub Actions CI/CD matrix
├── build/
│   ├── icon.ico                    # Windows multi-resolution icon (16x16 -> 256x256)
│   ├── icon.icns                   # macOS Apple Icon Image format
│   └── icon.png                    # Linux & cross-platform high-res master icon (512x512)
├── core/
│   ├── constants/
│   │   └── cryptoConstants.js      # Cryptographic parameter definitions
│   ├── crypto/
│   │   └── vaultCrypto.js          # AES-256-GCM cipher engine & key derivation
│   ├── session/
│   │   └── sessionManager.js       # In-memory session manager & auto-lock state
│   └── vault/
│       └── vaultPackage.js         # .clvault streaming export/import archive engine
├── src/
│   ├── css/
│   │   ├── dashboard.css           # Vault dashboard, data grid & modal styles
│   │   ├── global.css              # System theme variables (Dark & Light tokens)
│   │   └── style.css               # Setup screen, auth card & responsive styling
│   ├── fonts/
│   │   └── LeagueSpartan-*.ttf     # Bundled local typography (zero CDN dependency)
│   ├── img/
│   │   ├── logo.png                # Master high-resolution branded logo (2000x2000)
│   │   └── logo-transparent.png    # In-app vector transparent brand mark (1101x1101)
│   ├── js/
│   │   ├── app.js                  # Setup screen, import flow & unlock controller
│   │   ├── dashboard.js            # Main dashboard, table rendering & modal logic
│   │   └── theme-init.js           # Instant flash-free theme loader
│   ├── dashboard.html              # Main vault interface
│   └── index.html                  # Setup, login, and forgot-password interface
├── main.js                         # Electron main process & IPC handlers (13,000+ lines)
├── preload.js                      # ContextBridge security barrier & API exposure
├── package.json                    # Packaging targets, scripts & metadata
├── test-all.js                     # Master pre-packaging health audit suite (13 suites)
└── .gitignore                      # Clean production exclusion rules
```

---

## 5. Developer & Build Guide

### Prerequisites
* **Node.js**: v20.x or v22.x (Recommended: `v22.x`)
* **npm**: v10.x or higher
* **Git**: Installed and configured

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/vipmayank2-design/CrypticLocker.git
cd CrypticLocker
npm install
```

### 2. Running in Development Mode
Launch the application locally with full DevTools support:
```bash
npm start
```

### 3. Running the Master Health Audit
Execute the automated regression and integrity suite:
```bash
npm test
```
*Expected Output: `TOTAL TEST SUITES: 13 | PASSED: 13 ✅ | FAILED: 0 🎉`*

---

## 6. Multi-Platform Production Packaging

CrypticLocker is configured out-of-the-box with **`electron-builder`** for local and cloud compilations.

### 🪟 Windows Compilation (Run directly on Windows)
Build both NSIS setup installer and portable single-file executable:
```bash
npm run build:win
```
**Output Binaries (`dist/`)**:
* `CrypticLocker Setup 1.0.0.exe` (~90 MB) — Full installer with Desktop shortcut, Start Menu entry, `.clvault` association, and clean uninstaller.
* `CrypticLocker 1.0.0.exe` (~90 MB) — Zero-installation portable edition for USB drives.

### 🍎 macOS Compilation (Run on macOS or via CI/CD)
```bash
npm run build:mac
```
**Output Binary (`dist/`)**:
* `CrypticLocker-1.0.0.dmg` — Native Apple Silicon (M1/M2/M3/M4) and Intel installer image.

### 🐧 Linux Compilation (Run on Linux or via CI/CD)
```bash
npm run build:linux
```
**Output Binaries (`dist/`)**:
* `CrypticLocker-1.0.0.AppImage` — Universal portable Linux executable (runs across Ubuntu, Fedora, Debian, Arch).
* `CrypticLocker_1.0.0_amd64.deb` — Debian/Ubuntu native package.

---

## 7. Automated Cloud CI/CD (GitHub Actions)

The repository includes a ready-to-run continuous integration workflow located at `.github/workflows/build.yml`.

### How to Trigger 1-Click Cloud Builds:
1. Navigate to the **Actions** tab in your GitHub repository.
2. Select **`Build Multi-Platform Packages`** from the workflow list.
3. Click **`Run workflow`** ➔ Select the `main` branch ➔ Click the green button.
4. GitHub's cloud runners will concurrently:
   * Boot **`windows-latest`**, **`macos-latest`**, and **`ubuntu-latest`**.
   * Run the master test suite (`npm test`) on each operating system.
   * Compile and export Windows `.exe`, macOS `.dmg`, and Linux `.AppImage` / `.deb`.
   * Bundle all files into the **Artifacts** download section on GitHub.

---

## 8. Acquirer Handover & Extensibility Notes

For technical teams acquiring the CrypticLocker IP, the following architectural extension points are documented:

### 1. "Check for Updates" Endpoint Integration
* **Current Implementation**: The user interface in Settings includes an interactive "Check for updates" trigger.
* **Acquirer Integration**: Because CrypticLocker is zero-telemetry and strictly offline-first, no external telemetry server is contacted by default.
* **How to Connect**: To activate automatic updates, configure `electron-updater` in `main.js` pointing to your organization's release endpoint (e.g. AWS S3 bucket, Cloudflare R2, or GitHub Releases):
  ```javascript
  const { autoUpdater } = require('electron-updater');
  autoUpdater.setFeedURL({ provider: 'github', owner: 'YOUR_ORG', repo: 'CrypticLocker' });
  autoUpdater.checkForUpdatesAndNotify();
  ```

### 2. Commercial Licensing & Monetization Layer
* The application is architected with strict boundary separation between authentication (`src/js/app.js`), session state (`core/session/sessionManager.js`), and backend operations (`main.js`).
* Acquirers wishing to introduce license keys or recurring subscription checks can easily intercept the unlock handshake in `main.js` (`ipcMain.handle('vault:unlock')`).

### 3. Re-Branding / White-Labeling
* All brand identity assets are centralized in:
  * Master Logo: `src/img/logo.png`
  * In-App Mark: `src/img/logo-transparent.png`
  * OS Icons: `build/icon.ico`, `build/icon.icns`, `build/icon.png`
  * Brand Strings: `package.json` (`productName`, `appId`, `author`)

---

## 9. Technical Due-Diligence Checklist

| Due-Diligence Item | Verification Method | Status |
| :--- | :--- | :---: |
| **Zero Hardcoded Secrets** | Codebase-wide regex scan for tokens, keys, passwords | ✅ Clean |
| **Zero Developer Filepaths** | Audit of file path resolution; all storage uses `app.getPath('userData')` | ✅ Clean |
| **No Copyleft / GPL Contamination** | Dependency license audit; all dependencies are MIT / Permissive | ✅ Clean |
| **Automated Test Coverage** | `npm test` runs 13 automated test suites across all core modules | ✅ 100% Passed |
| **Binary Verification** | `electron-builder` compiles cleanly on Windows, macOS, and Linux | ✅ Verified |
| **ASAR Bundle Cleanliness** | Production package excludes test code, logs, and developer scratchpads | ✅ 0 Bytes Test Code |

---

## 10. Ownership & Commercial Rights

**CrypticLocker Technologies** holds full intellectual property, commercial, copyright, and distribution rights to this software asset, source code, visual identity, and documentation.

*For acquisition inquiries or technical transfer assistance, contact:*  
**CrypticLocker Technologies** — `contact@crypticlocker.com`
