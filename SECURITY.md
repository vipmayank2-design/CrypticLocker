# Security Policy

## Supported Versions

| Version | Supported          |
| :------ | :----------------- |
| 1.0.x   | ✅ Active support  |

## Reporting a Vulnerability

**⚠️ DO NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in CrypticLocker, please report it responsibly:

1. **Email**: Send a detailed report to the maintainer via GitHub private messaging or the contact method listed on the maintainer's GitHub profile
2. **Include**: A clear description of the vulnerability, steps to reproduce, potential impact, and any suggested fixes
3. **Response**: You will receive an acknowledgment within **48 hours**
4. **Timeline**: We aim to release a fix within **7 days** for critical vulnerabilities

We will credit reporters (with permission) in the release notes.

## Security Architecture Overview

### Encryption
- **Cipher**: AES-256-GCM (Authenticated Encryption with Associated Data)
- **Key Derivation**: scrypt (N=16384, r=8, p=1, key length=32 bytes)
- **IV Generation**: Cryptographically random 96-bit IV per file (via `crypto.randomBytes`)
- **Authentication**: 128-bit GCM authentication tags for tamper detection
- **Implementation**: Node.js built-in `crypto` module only — zero third-party crypto libraries

### Key Management
- Master password is never stored — only the derived key is used in memory
- Vault Master Key (VMK) is encrypted with the Password Unlock Key (PUK)
- Recovery key uses PBKDF2 with 100,000 iterations (SHA-512)
- In-memory keys are scrubbed on vault lock, app blur/timeout, or session destruction

### File Formats
- `.clvault` — Full vault backup archive (encrypted, tamper-evident)
- `.clpack` — Capsule package for sharing encrypted files between users

### Access Control
- Progressive lockout ladder after failed unlock attempts (exponential cooldown)
- Auto-lock on configurable idle timeout
- Auto-lock on OS sleep/screen-lock events
- Danger Zone vault deletion requires 3-step verification with password challenge

## What CrypticLocker Does NOT Protect Against

In the interest of transparency, CrypticLocker does **not** protect against:

- **Keyloggers / Screen recorders**: If your OS is compromised, an attacker can capture your master password as you type it
- **Physical RAM extraction**: While the app is unlocked, decrypted data exists briefly in memory
- **OS-level compromise**: A rootkit or malware with admin/root access can bypass any application-level encryption
- **Rubber-hose cryptanalysis**: CrypticLocker cannot protect against physical coercion
- **Deleted file recovery**: Original files (before vault import) may be recoverable from disk unless securely shredded

## Dependency Security

- We regularly run `npm audit` to check for known vulnerabilities in dependencies
- All cryptographic operations use Node.js built-in modules — no third-party crypto libraries
- Electron security best practices: `contextIsolation: true`, `nodeIntegration: false`

## Responsible Disclosure

We ask that you:
- Give us reasonable time to fix vulnerabilities before public disclosure
- Do not exploit vulnerabilities beyond what's necessary to demonstrate the issue
- Do not access, modify, or delete other users' data

We appreciate your help in keeping CrypticLocker secure for everyone.
