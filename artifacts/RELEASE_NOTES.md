# 🚀 Release Notes: CloudPulse-API v1.0.0

- **Project:** CloudPulse-API
- **Release Version:** `v1.0.0`
- **Release Date:** 2026-09-20
- **Author:** Expert DevOps Engineer
- **Git Commit:** Production Release
- **Target Repository:** [github.com/alinurettin/CloudPulse-API](https://github.com/alinurettin/CloudPulse-API)

---

## 🌟 Highlights & Features

- **Asynchronous Health Probing:** Non-blocking HTTP/HTTPS probe scheduler with configurable intervals and timeouts.
- **Percentile Latency Engine:** In-memory statistical computation of rolling $p50$, $p95$, $p99$, average, min, and max latencies.
- **Prometheus Metrics Exporter:** Native `/metrics` endpoint formatted for Grafana and Prometheus scraping.
- **Real-Time Operational Dashboard:** Modern dark-themed web UI connected via Server-Sent Events (SSE) with live latency bars and service controls.
- **Containerized Deployment:** Production Dockerfile with health check probe and `docker-compose.yml` for zero-configuration startup.
- **Automated CI/CD:** GitHub Actions workflow running tests and verifying container builds on every push.

---

## 📦 Deployment Instructions

```bash
# Clone the repository
git clone https://github.com/alinurettin/CloudPulse-API.git
cd CloudPulse-API

# Option A: Run via Docker Compose
docker-compose up -d

# Option B: Run via Node.js
npm start
```
Access the dashboard at `http://localhost:3000`.
