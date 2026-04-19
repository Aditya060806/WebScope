# WebScope DevOps Report: Containerization of a Web App

## 1. Introduction
WebScope is a Node.js web automation platform that exposes CLI, HTTP API, and MCP interfaces on top of Playwright. The project requires consistent execution across development and deployment environments, including browser dependencies, runtime configuration, optional distributed state, and repeatable startup behavior. Containerization was implemented to solve environment drift and simplify deployment.

## 2. Problem Statement
Before containerization, local setup depended on host-level Node.js, Playwright browser binaries, and manual environment configuration. This creates variation across machines and raises production-readiness risks for:
- Browser dependency mismatch
- Non-reproducible startup behavior
- Inconsistent persistence behavior across restarts
- Difficult CI/CD packaging and release

## 3. Goals and Scope
The containerization effort targeted the following outcomes:
- Build a production-grade runtime image for WebScope
- Ensure Playwright Chromium availability inside the container
- Add health checks for orchestration compatibility
- Support state persistence for API keys and uploads
- Support optional Redis-backed distributed operation
- Add CI workflow to build and publish container images

Out of scope:
- Kubernetes deployment manifests
- Service mesh or advanced ingress configuration
- Cloud-specific infrastructure provisioning

## 4. Containerization Architecture
The implemented architecture uses:
- A multi-stage Docker image for optimized runtime packaging
- Docker Compose for local and production-like orchestration
- Optional Redis service/profile for distributed stores
- Persistent named volumes for stateful data

Core topology:
- webscope: main application service exposing HTTP on port 3000
- redis: optional service enabled via profile when distributed key/rate stores are needed

## 5. Dockerfile Design and Implementation
The Dockerfile follows a two-stage build:

### 5.1 Dependency Stage
- Base: node:20-bookworm-slim
- Purpose: install production dependencies only
- Command: npm ci --omit=dev --ignore-scripts

This keeps the final runtime image smaller and avoids executing lifecycle scripts in the dependency stage.

### 5.2 Runtime Stage
- Base: mcr.microsoft.com/playwright:v1.50.0-jammy
- Purpose: run the app with Playwright-compatible browser dependencies
- App files copied: src, mcp, tools, public, openapi.yaml, README.md, LICENSE, logo.svg
- Browser install command: npx --yes playwright install chromium

### 5.3 Runtime Hardening
- Exposed port: 3000
- Healthcheck: periodic request to /health
- Non-root execution: USER pwuser
- Entrypoint command: node src/cli.js --serve

This design provides browser compatibility and safer runtime defaults for deployment.

## 6. Docker Compose Orchestration
The repository includes two compose files.

### 6.1 Base Compose (docker-compose.yml)
The base stack defines:
- webscope build context and image name
- Port mapping from host to container (default 3000)
- Environment variable mapping with defaults
- Named volumes:
  - webscope-state -> /app/state
  - webscope-uploads -> /tmp/webscope-uploads
- Restart policy: unless-stopped
- Service-level healthcheck against /health

A redis service is defined with profile: redis so it remains optional.

### 6.2 Redis Overlay (docker-compose.redis.yml)
The overlay activates distributed behavior by setting:
- WEBSCOPE_RATE_LIMIT_STORE=redis
- WEBSCOPE_API_KEY_STORE=redis
- WEBSCOPE_REDIS_URL=redis://redis:6379

It also declares webscope dependency on redis for redis-mode startup.

## 7. Configuration and Environment Management
Container runtime behavior is configured through environment variables and a template file (.env.docker.example). Key variables include:
- WEBSCOPE_PORT, WEBSCOPE_TIMEOUT, WEBSCOPE_COLS
- WEBSCOPE_API_KEY, WEBSCOPE_API_KEYS_JSON
- WEBSCOPE_API_KEY_STORE and WEBSCOPE_API_KEYS_FILE
- WEBSCOPE_RATE_LIMIT_STORE, WEBSCOPE_RATE_LIMIT_MAX, WEBSCOPE_RATE_LIMIT_WINDOW_MS
- WEBSCOPE_REDIS_URL
- WEBSCOPE_AUDIT_LOG and WEBSCOPE_CORS_ORIGIN

Operational benefit:
- Same image can run in local, staging, or production-like environments using only env changes.

## 8. Developer and Operator Workflow
NPM scripts were added for standard container operations:
- docker:build
- docker:run
- docker:up
- docker:up:redis
- docker:down

This reduces command complexity and improves onboarding for team members.

## 9. CI/CD Container Delivery
A GitHub Actions workflow builds and publishes the container image to GHCR.

Workflow highlights:
- Triggered on main branch pushes and version tags
- Uses Buildx and QEMU for modern build pipeline support
- Logs in to GHCR using GITHUB_TOKEN
- Generates tags for latest, branch, tag, and commit sha
- Pushes image with build cache settings enabled

This provides repeatable artifact generation and versioned container distribution.

## 10. Runtime Validation and Testing Evidence
Validation was performed through both automated tests and live container checks.

### 10.1 Automated Test Coverage
The test suite validates:
- Scoped auth and file-backed key persistence
- Backend failure paths with expected error codes
- Redis distributed behavior for shared keys and cross-instance rate limits

Test commands:
- npm test
- npm run test:form
- npm run test:live
- npm run test:ats

### 10.2 Container Runtime Checks
The deployment flow was validated through:
- Compose build and startup in redis profile mode
- API health verification
- API key persistence across container restart
- Rate-limit enforcement verification in running containers
- Compose teardown and cleanup

Observed outcome:
- Containerization flow is functional end-to-end for both base and redis-backed modes.

## 11. Security and Reliability Considerations
Containerization decisions that improve reliability and security:
- Non-root container user
- Health checks at image and compose levels
- Persistent volumes for key/state continuity
- Optional distributed state via Redis
- Scoped API key management and rate limiting at application layer

Current hardening opportunities:
- Add image vulnerability scanning (for example, Trivy) in CI
- Add PR-time container build verification
- Add stronger readiness checks for dependency health in addition to liveness
- Consider digest pinning for base images

## 12. Key Issue Found During Validation and Fix Applied
During distributed runtime testing, a consistency issue was identified:
- API key updates from one instance were not immediately visible to another live instance when using non-memory stores.

Fix implemented:
- Non-memory key stores (file and redis) are now reloaded on request path, while memory store remains cached.

Impact:
- Multi-instance key management now behaves correctly without requiring service restart.

## 13. Results
Containerization outcomes achieved:
- Reproducible runtime package with browser dependencies included
- Consistent startup and health monitoring behavior
- Optional distributed mode with Redis
- Persistent state support across restarts
- Scripted developer workflow for build/run/up/down
- CI-backed image publishing pipeline

Overall assessment:
- WebScope is properly containerized for practical deployment workflows and further production hardening.

## 14. Future Enhancements
Recommended next steps:
- Add vulnerability scanning and policy gates in CI
- Add compose profiles for reverse proxy and TLS termination
- Add readiness endpoint that validates store dependencies
- Add resource constraints and stress tests for high concurrency operation
- Publish deployment runbook with rollback strategy and operational SLOs

## 15. Implementation Evidence (Repository References)
- Docker image design: Dockerfile
- Orchestration: docker-compose.yml, docker-compose.redis.yml
- Runtime env template: .env.docker.example
- Operator scripts: package.json
- Delivery pipeline: .github/workflows/docker-image.yml
- Health endpoint and runtime behavior: src/server.js
- Usage and operations docs: README.md

## 16. Project Directory Structure
Table 16.1: Project Directory Structure

| Path | Description |
|---|---|
| src/ | Core Node.js runtime modules for browser automation, rendering, API serving, CLI orchestration, and store adapters |
| src/browser.js | Playwright-based AgentBrowser engine for navigation, interaction, recording, and network logging |
| src/renderer.js | Text-grid renderer that converts visible page content into structured, agent-readable output |
| src/server.js | HTTP API server with endpoint routing, auth scopes, rate limiting, metrics, and health handling |
| src/api-key-store.js | API key persistence abstraction with memory, file, and Redis backends |
| src/rate-limit-store.js | Rate-limit storage abstraction with memory and Redis implementations |
| src/cli.js | CLI entrypoint for render mode, interactive mode, and API server startup |
| src/ensure-browser.js | Startup helper that verifies Playwright Chromium installation |
| mcp/ | Model Context Protocol server integration layer |
| mcp/index.js | MCP JSON-RPC server exposing WebScope tools and session management |
| tools/ | Integration assets for LLM frameworks and function-calling workflows |
| tools/tool_definitions.json | Tool schema definitions for OpenAI/Anthropic-style function calling |
| tools/system_prompt.md | System prompt guidance for WebScope tool-using agents |
| test/ | Integration test suite for auth, persistence, failure paths, and Redis behavior |
| test/fixtures/ | HTML fixtures for deterministic form and multi-step workflow testing |
| docs/ | Documentation pages and generated project reports |
| canvas/ | Local dashboard and UI artifacts used for project demonstration |
| public/ | Public branding assets (logos used in docs/site) |
| site/ | Frontend workspace for project website assets and build configuration |
| Dockerfile | Multi-stage container image definition for production runtime |
| docker-compose.yml | Base multi-service orchestration file for WebScope deployment |
| docker-compose.redis.yml | Redis profile overlay enabling distributed key and rate-limit stores |
| .env.docker.example | Docker environment template for configurable deployment settings |
| .github/workflows/docker-image.yml | CI workflow to build and publish Docker images to GHCR |
| openapi.yaml | OpenAPI contract for HTTP API endpoints and response models |
| package.json | Project manifest with runtime dependencies, test scripts, and Docker scripts |
| README.md | Primary usage and operations documentation |
