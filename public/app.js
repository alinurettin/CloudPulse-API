// CloudPulse-API Real-Time Dashboard Client

let services = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchServices();
  setupSSE();
  setupEventListeners();

  // Polling fallback
  setInterval(fetchServices, 10000);
});

function setupEventListeners() {
  const modal = document.getElementById('modalAddService');
  const btnOpen = document.getElementById('btnOpenAddModal');
  const btnClose = document.getElementById('btnCloseModal');
  const btnCancel = document.getElementById('btnCancelModal');
  const form = document.getElementById('formAddService');

  btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  btnCancel.addEventListener('click', () => modal.classList.add('hidden'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('inputName').value.trim();
    const url = document.getElementById('inputUrl').value.trim();
    const intervalMs = parseInt(document.getElementById('inputInterval').value, 10);
    const timeoutMs = parseInt(document.getElementById('inputTimeout').value, 10);

    if (!name || !url) return;

    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, intervalMs, timeoutMs })
      });
      const data = await res.json();
      if (data.success) {
        modal.classList.add('hidden');
        form.reset();
        fetchServices();
      }
    } catch (err) {
      alert('Failed to add service: ' + err.message);
    }
  });
}

function setupSSE() {
  const liveStatus = document.getElementById('liveStatus');
  const eventSource = new EventSource('/api/events');

  eventSource.onopen = () => {
    liveStatus.innerText = 'Live SSE Connected';
    liveStatus.parentElement.style.borderColor = 'rgba(16, 185, 129, 0.4)';
  };

  eventSource.addEventListener('service_update', (e) => {
    try {
      const updated = JSON.parse(e.data);
      const index = services.findIndex(s => s.id === updated.id);
      if (index !== -1) {
        services[index] = updated;
      } else {
        services.push(updated);
      }
      renderServices(services);
      updateGlobalMetrics(services);
    } catch (err) {
      console.error('Error parsing SSE event:', err);
    }
  });

  eventSource.onerror = () => {
    liveStatus.innerText = 'Reconnecting...';
    liveStatus.parentElement.style.borderColor = 'rgba(245, 158, 11, 0.4)';
  };
}

async function fetchServices() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.success) {
      services = data.services;
      renderServices(services);
      updateGlobalMetrics(services);
    }
  } catch (err) {
    console.error('Fetch services error:', err);
  }
}

function updateGlobalMetrics(list) {
  document.getElementById('valTotalServices').innerText = list.length;
  document.getElementById('valHealthyServices').innerText = list.filter(s => s.status === 'HEALTHY').length;
  document.getElementById('valDegradedServices').innerText = list.filter(s => s.status === 'DEGRADED').length;
  document.getElementById('valDownServices').innerText = list.filter(s => s.status === 'DOWN').length;
}

function renderServices(list) {
  const container = document.getElementById('servicesList');
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="loading-placeholder">No services registered yet. Click "Add Service" above.</div>';
    return;
  }

  container.innerHTML = '';
  list.forEach(s => {
    const card = document.createElement('div');
    card.className = 'service-card';

    // Build latency history bars (last 20 samples)
    const historyBars = (s.history || []).slice(-20).map(h => {
      const heightPercent = Math.min(100, Math.max(10, Math.round((h.latencyMs / 500) * 100)));
      return `<div class="history-bar ${h.status}" style="height: ${heightPercent}%" title="${h.latencyMs}ms (${h.status}) at ${h.timestamp.split('T')[1].split('.')[0]}"></div>`;
    }).join('');

    const formattedTime = s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleTimeString() : 'Never';

    card.innerHTML = `
      <div class="service-card-header">
        <div class="service-title">
          <h3>${s.name}</h3>
          <span class="service-url">${s.url}</span>
        </div>
        <span class="status-badge ${s.status}">${s.status}</span>
      </div>

      <div class="service-stats-row">
        <div class="stat-item">
          <span class="stat-lbl">LATENCY</span>
          <span class="stat-num">${s.lastLatencyMs}ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-lbl">p95</span>
          <span class="stat-num">${s.stats ? s.stats.p95 : 0}ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-lbl">UPTIME</span>
          <span class="stat-num">${s.uptimePercent}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-lbl">PROBES</span>
          <span class="stat-num">${s.stats ? s.stats.sampleCount : 0}</span>
        </div>
      </div>

      <div class="history-bar-container" title="Recent latency samples">
        ${historyBars || '<span style="font-size:11px; color:#6b7280; margin:auto;">Waiting for first probe sample...</span>'}
      </div>

      <div class="service-actions">
        <span class="last-checked">Checked: ${formattedTime}</span>
        <div class="btn-group">
          <button class="action-btn" onclick="pingService('${s.id}')">⚡ Ping</button>
          <button class="action-btn delete" onclick="deleteService('${s.id}')">🗑️</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function pingService(id) {
  try {
    await fetch(`/api/services/${id}/ping`, { method: 'POST' });
    fetchServices();
  } catch (err) {
    alert('Ping error: ' + err.message);
  }
}

async function deleteService(id) {
  if (!confirm('Are you sure you want to stop monitoring this service?')) return;
  try {
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    fetchServices();
  } catch (err) {
    alert('Delete error: ' + err.message);
  }
}
