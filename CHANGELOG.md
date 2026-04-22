# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Release process assets: changelog tracking and a reusable GitHub release tag template.

## [1.0.1] - 2026-04-19

### Added
- Scoped API security highlights in docs (`read`, `write`, `admin`).
- Admin key lifecycle coverage (`/auth/keys`) in docs and release summary.
- Redis-backed distributed rate-limit and key-store coverage in release notes.
- Release notes section with direct npm upgrade command in README.

### Changed
- Docker Compose project naming pinned to `webscope` to avoid folder-name based project labels.
- npm Docker scripts updated to use explicit Compose project name.

### Fixed
- Multi-instance key visibility issue for non-memory key stores by reloading file/Redis stores on request path.

## [1.0.0] - 2026-04-19

### Added
- Text-grid web automation runtime with CLI, HTTP API, and MCP interfaces.
- Core interaction features: navigate, click, type, scroll, waitFor, query, region, evaluate, batch, replay.
- Device emulation, custom headers, proxy support, network inspector, and recording workflows.
- OpenAPI endpoint and Prometheus metrics endpoint.
- Container runtime support with Docker and Compose.

[Unreleased]: https://github.com/Aditya060806/WebScope/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/Aditya060806/WebScope/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Aditya060806/WebScope/releases/tag/v1.0.0
