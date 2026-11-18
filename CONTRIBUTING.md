# Contributing to CrypticLocker

Thank you for your interest in contributing to CrypticLocker! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20.x or v22.x (Recommended: v22.x)
- **npm**: v10.x or higher
- **Git**: Installed and configured
- **Windows**: Required for building Windows binaries (macOS/Linux supported via CI/CD)

### Development Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/CrypticLocker.git
   cd CrypticLocker
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Run** in development mode:
   ```bash
   npm start
   ```
5. **Run** the test suite:
   ```bash
   npm test
   ```
   Expected output: All 16 test suites should pass.

## 📋 How to Contribute

### Reporting Bugs

- Use [GitHub Issues](https://github.com/vipmayank2-design/CrypticLocker/issues) with the **Bug Report** template
- Include: OS version, app version (installer or portable), steps to reproduce, expected vs actual behavior
- Attach screenshots if the issue is visual

### Suggesting Features

- Use [GitHub Issues](https://github.com/vipmayank2-design/CrypticLocker/issues) with the **Feature Request** template
- Describe the problem your feature would solve
- Explain your proposed solution

### Submitting Code Changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Ensure **all 16 test suites pass**:
   ```bash
   npm test
   ```
4. Verify **zero syntax errors** in core files:
   ```bash
   node -c main.js
   node -c preload.js
   node -c src/js/dashboard.js
   node -c src/js/app.js
   ```
5. Commit with a clear message:
   ```bash
   git commit -m "feat: add description of your change"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Open a **Pull Request** against the `main` branch

## 🔒 Security Contributions

> **⚠️ IMPORTANT**: If you discover a security vulnerability, **DO NOT** open a public issue. Please follow our [Security Policy](SECURITY.md) for responsible disclosure.

For security-related code changes:
- All cryptographic operations must use Node.js built-in `crypto` module only
- Never introduce custom or third-party cryptographic implementations
- Document any changes to encryption parameters or key derivation
- Security changes require extra review and testing

## 📐 Code Style Guidelines

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for JavaScript strings
- **Semicolons**: Always use semicolons
- **Comments**: Write clear comments for complex logic
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **No console.log in production code**: Use proper error handling instead

## 🧪 Testing

- All changes must pass the existing 16 test suites
- New features should include appropriate tests in `test-all.js`
- Test suites cover: syntax validation, cryptography, lockout system, import/export, quarantine, settings, UI formatting, I/O acceleration, empty states, and capsule engine

## 📝 Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, no logic change)
- `refactor:` — Code restructuring (no feature or bug fix)
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks (dependencies, CI, etc.)

Examples:
```
feat: add folder-level password protection
fix: resolve scrollbar inconsistency on export page
docs: update security architecture documentation
```

## 🤝 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## 📄 License

By contributing to CrypticLocker, you agree that your contributions will be licensed under the [GPL-3.0 License](LICENSE).

---

Thank you for helping make CrypticLocker better! 🛡️
