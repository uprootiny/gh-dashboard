const API = 'https://api.github.com';
const USER = 'uprootiny';

let token = localStorage.getItem('gh_token') || '';

if (token) {
  document.getElementById('setup').style.display = 'none';
  refresh();
}

function saveToken() {
  token = document.getElementById('token').value.trim();
  if (!token) return showError('Token required');
  localStorage.setItem('gh_token', token);
  document.getElementById('setup').style.display = 'none';
  refresh();
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function gh(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function refresh() {
  const dashboard = document.getElementById('dashboard');
  dashboard.innerHTML = '<div style="color: var(--dim)">Loading...</div>';

  try {
    const [rateLimit, user, repos, actions] = await Promise.all([
      gh('/rate_limit'),
      gh('/user'),
      gh(`/users/${USER}/repos?per_page=5&sort=updated`),
      fetchActionsUsage()
    ]);

    const cards = [];

    // --- API Rate Limits ---
    const resources = rateLimit.resources;
    const rateLimitMetrics = ['core', 'search', 'graphql', 'code_search'].map(key => {
      const r = resources[key];
      if (!r) return null;
      const pct = r.limit > 0 ? (r.remaining / r.limit) * 100 : 100;
      const resetTime = new Date(r.reset * 1000).toLocaleTimeString();
      return metric(key, `${r.remaining} / ${r.limit}`, pct, `resets ${resetTime}`);
    }).filter(Boolean);

    cards.push(card('API Rate Limits', rateLimitMetrics));

    // --- Account ---
    const plan = user.plan || {};
    const diskMB = ((user.disk_usage || 0) / 1024).toFixed(1);
    cards.push(card('Account', [
      metric('Plan', plan.name || 'free', 100),
      metric('Public repos', `${user.public_repos}`, null),
      metric('Private repos', `${user.total_private_repos || 0} / ${plan.private_repos || '∞'}`,
        plan.private_repos ? (user.total_private_repos / plan.private_repos) * 100 : 100),
      metric('Disk usage', `${diskMB} MB`, null),
      metric('Collaborators', `${plan.collaborators || 0}`, null),
    ]));

    // --- Actions Minutes ---
    if (actions) {
      cards.push(card('Actions Minutes (this billing cycle)', [
        metric('Total used', `${actions.total_minutes_used} min`,
          actions.included_minutes > 0 ? ((actions.total_minutes_used / actions.included_minutes) * 100) : null),
        metric('Included', `${actions.included_minutes} min`, 100),
        metric('Paid overage', `$${actions.total_paid_minutes_used || 0}`, null),
        ...Object.entries(actions.minutes_used_breakdown || {}).map(([os, mins]) =>
          metric(`  ${os}`, `${mins} min`, null)
        )
      ]));
    }

    // --- Storage (Packages + Actions) ---
    cards.push(card('Storage', [
      metric('Actions artifacts', actions ? `${((actions.total_paid_storage_used || 0)).toFixed(1)} GB paid` : 'N/A', null),
      metric('Repo disk', `${diskMB} MB`, null),
    ]));

    // --- Recent Repos (workflow status) ---
    const repoMetrics = repos.map(r => {
      const age = timeSince(new Date(r.pushed_at));
      return metric(r.name, `pushed ${age}`, null);
    });
    cards.push(card('Recent Repos', repoMetrics));

    dashboard.innerHTML = cards.join('');
    document.getElementById('updated').textContent = `Last updated: ${new Date().toLocaleString()}`;
  } catch (err) {
    dashboard.innerHTML = '';
    showError(`Failed: ${err.message}`);
    document.getElementById('setup').style.display = 'block';
  }
}

async function fetchActionsUsage() {
  try {
    // This endpoint requires the user to be part of an org or have billing access
    // For personal accounts, try the billing API
    return await gh(`/users/${USER}/settings/billing/actions`);
  } catch {
    try {
      return await gh(`/orgs/${USER}/settings/billing/actions`);
    } catch {
      return null;
    }
  }
}

function metric(name, value, pct, subtitle) {
  const barColor = pct === null ? '' : pct > 70 ? 'green' : pct > 30 ? 'yellow' : 'red';
  const statusClass = pct === null ? '' : pct > 70 ? 'ok' : pct > 30 ? 'warn' : 'crit';

  return `
    <div class="metric">
      <span class="metric-name">${name}${subtitle ? `<br><span style="color:var(--dim);font-size:11px">${subtitle}</span>` : ''}</span>
      <div class="metric-right">
        <span class="metric-value">${value}</span>
        ${pct !== null ? `
          <div class="bar-container">
            <div class="bar-fill ${barColor}" style="width:${Math.min(100, pct)}%"></div>
          </div>
          <span class="status ${statusClass}"></span>
        ` : ''}
      </div>
    </div>`;
}

function card(title, metrics) {
  return `<div class="card"><h2>${title}</h2>${metrics.join('')}</div>`;
}

function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = [
    [31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']
  ];
  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count}${label} ago`;
  }
  return 'just now';
}
