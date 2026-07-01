# Workspace Agent Rules

This document outlines the strict guidelines and constraints that all AI coding assistants (agents) must follow when working on the **Token Compressor** project.

---

## 🔄 Commit, Versioning & Changelog Rule

For **EVERY** code change, feature addition, bug fix, or refactoring:
1. **Changelog Update**: Add a corresponding entry in [CHANGELOG.md](file:///d:/backup%20from%20pc%20asus/Documents%20Development/token-compressor/CHANGELOG.md) under the appropriate heading (e.g., Added, Changed, Fixed).
2. **Version Bump**: Increment the version number in [package.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/token-compressor/package.json) following Semantic Versioning (SemVer) rules.
3. **Git Commit**: Perform a clean Git commit (`git add` and `git commit`) containing only the relevant changes, with a descriptive, conventional commit message (e.g. `feat: ...`, `fix: ...`, `docs: ...`).

---

## 🛠️ Code Quality & Design Principles

Always design and write code with the following principles in mind:
- **Best Practices**: Use modern, secure, and performant coding patterns (e.g. strict TypeScript typing, proper error handling, async/await constructs, proper resource management).
- **Modularity**: Break down complex routines into small, focused, reusable, and single-responsibility functions or components. Avoid huge, monolithic code chunks.
- **Maintainability**: Write self-documenting code with descriptive names for variables, functions, and files. Retain comments explaining the *why* of complex decisions.
- **Scalability**: Structure routes, data models, and configurations so they can easily support future extensions (e.g. adding new pipelines, new LLM providers, or scaling traffic).

---

## 📏 File Length Constraint

- **Maximum File Line Count**: No code file (source file, test file, or style file) is permitted to exceed **1000 lines of code**.
- If a file approaches or exceeds this limit, you **MUST** split it into smaller, modular sub-files or separate modules.
