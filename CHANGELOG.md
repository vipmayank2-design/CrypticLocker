# Changelog

All notable changes to CrypticLocker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-18

### Added

#### Core Security
- AES-256-GCM file and folder encryption with per-file unique 96-bit IVs
- scrypt key derivation (N=16384, r=8, p=1) for master password hashing
- Vault Master Key (VMK) envelope architecture with dual-key encryption
- 256-bit recovery key system with PBKDF2 (100,000 iterations, SHA-512)
- Progressive lockout ladder with exponential cooldown after failed attempts
- Auto-lock on idle timeout (configurable) and OS sleep/screen-lock events
- In-memory key scrubbing on vault lock and session destruction

#### File & Folder Management
- Add files and folders to vault with COPY (preserve source) or MOVE (migrate and delete source) modes
- Restore files and folders from vault back to their original location
- Bulk selection and operations (add, restore, delete)
- Real-time search and column-based sorting
- Context-aware empty state engine with actionable guidance

#### Capsule Engine (.clpack)
- Secure capsule export for sharing encrypted files between users
- Single file/folder and multi-item capsule packaging
- Capsule import with merge into existing vault
- Password-protected capsule packages with independent encryption

#### Vault Backup & Restore (.clvault)
- Full vault export to encrypted `.clvault` archive format
- Full vault import and restore from `.clvault` archives
- Pre-check disk quota validation before export/import
- Tamper-evident archive format with integrity checksums

#### Performance
- Adaptive Hardware-Aware I/O Acceleration Engine
- Dynamic buffer scaling based on host RAM (512 KB to 16 MB)
- Up to ~600% throughput improvement over legacy baseline
- Interactive acceleration tier selection during operations

#### Quarantine & Recovery
- Orphaned file detection and isolation
- Deep byte inspection without decrypting payload data
- One-click orphan recovery or permanent purging
- Vault integrity checking system

#### User Interface
- Dark, Light, and System theme support
- Glassmorphic floating tooltip system (zero browser tooltips)
- Custom scrollbars across all pages
- Responsive layout with clean, professional design

#### Platform Support
- Windows NSIS installer with desktop/start menu shortcuts
- Windows portable edition (zero-installation, USB-ready)
- macOS DMG for Apple Silicon (M1/M2/M3/M4) and Intel
- Linux AppImage and .deb packages
- Native file associations for `.clvault` and `.clpack`
- Windows taskbar integration with explicit AppUserModelId

#### Developer Experience
- 16 automated test suites covering all core modules
- GitHub Actions CI/CD for multi-platform builds
- Cross-platform build scripts (Windows, macOS, Linux)
