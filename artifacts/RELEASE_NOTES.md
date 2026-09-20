# 🚀 Release Notes: CloudPulse-API v2.0.0
- **Release Version:** 2.0.0
- **Release Date:** 2026-09-20
- **Author:** Ali Nurettin Demir & The Autonomous 7-Agent SDLC Factory

---

## 🌟 Major Improvements & Architectural Advancements

### 1. Unified Production Gateway Architecture
Re-engineered `src/index.js` to serve as the unified, high-performance production server and Prometheus gateway, consolidating service management, background probing, and live SSE event broadcasting.

### 2. Nearest-Rank Statistical Engine & Standard Deviation
Replaced arbitrary approximations with exact Nearest-Rank latency percentiles ($p50, p90, p95, p99$), mean, and standard deviation variance tracking to capture network jitter.

### 3. WHATWG URL Standard Compliance
Eliminated legacy `url.parse()` deprecation warnings by transitioning the probe engine to the modern WHATWG `new URL()` standard.

### 4. Prometheus & OpenMetrics Scrape Gateway
Exported comprehensive gauge metrics covering health status, latency, uptime percentages, and percentile distributions formatted with deterministic label dimensions.

### 5. Cyber Dark-Mode Operations Console
Maintained and verified the responsive dark-themed dashboard in `public/` supporting live SSE telemetry updates and ad-hoc probe pings.

### 6. 100% Non-Mocked Verification Suite
Achieved 25 passing assertions in `tests/run_tests.js` executing against live ephemeral operating system network sockets.
