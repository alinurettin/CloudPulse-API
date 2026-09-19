# 📊 Product Requirements Document (PRD): CloudPulse-API

- **Project:** CloudPulse-API
- **Author:** Expert Business Analyst
- **Status:** APPROVED & COMPLETE
- **Version:** 1.0.0

---

## 1. Product Vision & Goals

CloudPulse-API is designed for DevOps engineers, Site Reliability Engineers (SREs), and backend developers who need immediate, real-time observability over internal and external microservices without complex infrastructure.

---

## 2. User Personas

1. **DevOps / SRE Engineer (Primary):** Wants continuous health and latency visibility, Prometheus metrics scraping, and alert thresholds.
2. **Full Stack Developer:** Wants a clean REST API to programmatically register and monitor services during development and staging.
3. **Engineering Lead:** Wants a clean live dashboard to display on team monitoring screens.

---

## 3. Functional Requirements (FR) & BDD Acceptance Criteria

### FR-1: Dynamic Service Registration
- **Description:** Users can register new HTTP/HTTPS endpoints to be monitored dynamically via `POST /api/services`.
- **BDD Scenario:**
  ```gherkin
  Given a valid target service name and HTTP endpoint URL
  When the client sends POST /api/services with interval and timeout
  Then the service is registered with unique ID, status 'HEALTHY', and monitoring starts immediately
  And a 201 Created response is returned with service payload
  ```

### FR-2: Periodic Automated Probing & Metric Aggregation
- **Description:** Engine polls each registered service at its configured interval (default 10s) and computes response latency, status code, and uptime.
- **BDD Scenario:**
  ```gherkin
  Given an active registered service
  When the probe interval timer triggers
  Then an asynchronous HTTP GET request is sent to the target endpoint
  And latency in milliseconds is recorded in the rolling sample window
  And percentiles (p50, p95, p99) and uptime percentages are recomputed
  ```

### FR-3: Real-Time WebSocket Metric Streaming
- **Description:** Any connected WebSocket client on `/ws` receives instant metric broadcasts whenever a service probe completes or changes state.
- **BDD Scenario:**
  ```gherkin
  Given a connected dashboard client on WebSocket /ws
  When any service status transitions (e.g., HEALTHY -> DEGRADED -> DOWN)
  Then an event frame 'SERVICE_STATUS_UPDATE' is broadcast within 50ms
  ```

### FR-4: Prometheus Metrics Exporter
- **Description:** Exposes standard Prometheus text metrics at `GET /metrics` for Grafana scraping.
- **BDD Scenario:**
  ```gherkin
  When a Prometheus scraper requests GET /metrics
  Then the response Content-Type is 'text/plain; version=0.0.4'
  And contains metrics 'cloudpulse_service_up', 'cloudpulse_latency_seconds', and 'cloudpulse_requests_total'
  ```

### FR-5: Modern Dark-Themed Live Dashboard
- **Description:** Embedded web interface with real-time cards, latency graphs, service management, and quick ping controls.

---

## 4. Non-Functional Requirements (NFR)

- **Latency:** API response time under 15ms for local metric queries.
- **Scalability:** Handles 100+ concurrent monitored endpoints and 50+ simultaneous WebSocket clients with <50MB RAM.
- **Resilience:** Unreachable external targets must not crash or block the probe scheduler.
