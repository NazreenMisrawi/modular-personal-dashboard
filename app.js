// Modular Personal Dashboard Application
// Persistent storage via localStorage + Supabase (per-user).

const STORAGE_KEY = 'modularDashboardData_v1';
const SUPABASE_URL = 'https://lmkovkianhwzjgaajxca.supabase.co';
const SUPABASE_KEY = 'sb_publishable__IPAAWNqWmoMftlvy35sHQ_DFSTSWgB';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let currentUser = null;

let state = {
  theme: 'dark',
  dashboards: [],
  currentView: 'home',
  currentDashboardId: null,
  calendarDate: new Date(),
  calendarView: 'week', // week, month, agenda
  calendarFilter: 'all'
};

let charts = {}; // to destroy on re-render

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
      // Ensure dates are Date objects where needed
      state.calendarDate = new Date(state.calendarDate || Date.now());
    } else {
      seedInitialData();
    }
  } catch (e) {
    console.error('Load failed', e);
    seedInitialData();
  }
  applyTheme();
}

function saveState() {
  try {
    const toSave = { ...state };
    toSave.calendarDate = toSave.calendarDate.toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    if (currentUser) saveToSupabase();
  } catch (e) {
    console.error('Save failed', e);
  }
}

function seedInitialData() {
  const aqId = generateId();
  const aquarium = {
    id: aqId,
    name: 'Freshwater Aquarium',
    icon: '🐠',
    color: '#26c6da',
    archived: false,
    config: {
      tank: '45 x 30 x 28 cm (~32L)',
      filter: 'Sicce Shark Mini Skim 350',
      lighting: 'Red Aquatics Ultra Nano RGB Pro',
      co2: 'Chihiros Mini CO2 Kit with solenoid',
      tempTarget: '25–27°C',
      co2Schedule: { on: '09:00', off: '19:00', lastChange: '' },
      lightingSchedule: [
        { window: 'Morning', on: '08:00', off: '12:00', intensity: '50%' },
        { window: 'Afternoon', on: '12:00', off: '18:00', intensity: '100%' },
        { window: 'Evening', on: '18:00', off: '22:00', intensity: '30%' }
      ]
    },
    metrics: [
      { id: generateId(), name: 'Temperature', unit: '°C', type: 'number', category: 'Water', target: 26, history: [] },
      { id: generateId(), name: 'pH', unit: '', type: 'decimal', category: 'Water', target: 7.0, history: [] },
      { id: generateId(), name: 'Ammonia', unit: 'ppm', type: 'number', category: 'Water', history: [] },
      { id: generateId(), name: 'Nitrite', unit: 'ppm', type: 'number', category: 'Water', history: [] },
      { id: generateId(), name: 'Nitrate', unit: 'ppm', type: 'number', category: 'Water', history: [] },
      { id: generateId(), name: 'TDS', unit: 'ppm', type: 'number', category: 'Water', history: [] },
      { id: generateId(), name: 'GH', unit: 'dGH', type: 'number', category: 'Water', history: [] },
      { id: generateId(), name: 'KH', unit: 'dKH', type: 'number', category: 'Water', history: [] },
      { id: generateId(), name: 'CO2 Status', unit: '', type: 'boolean', category: 'Equipment', history: [] },
      { id: generateId(), name: 'Plant Condition', unit: '', type: 'text', category: 'Livestock', history: [] },
      { id: generateId(), name: 'Livestock Condition', unit: '', type: 'text', category: 'Livestock', history: [] }
    ],
    activities: [
      { id: generateId(), name: 'Lighting Schedule', type: 'schedule', recurrence: 'daily', timeOn: '08:00', timeOff: '20:00', history: [] },
      { id: generateId(), name: 'CO2 Schedule', type: 'schedule', recurrence: 'daily', timeOn: '09:00', timeOff: '19:00', history: [] },
      { id: generateId(), name: 'Feeding', type: 'task', recurrence: 'daily', history: [] },
      { id: generateId(), name: 'Water Change', type: 'task', recurrence: 'weekly', history: [] },
      { id: generateId(), name: 'Fertilisation', type: 'task', recurrence: 'weekly', history: [] },
      { id: generateId(), name: 'Filter Cleaning', type: 'maintenance', recurrence: 'monthly', history: [] }
    ],
    widgets: [
      { id: generateId(), type: 'config' },
      { id: generateId(), type: 'metrics-overview' },
      { id: generateId(), type: 'water-test' },
      { id: generateId(), type: 'co2-schedule' },
      { id: generateId(), type: 'lighting-schedule' },
      { id: generateId(), type: 'activities' },
      { id: generateId(), type: 'chart', metricName: 'Temperature' },
      { id: generateId(), type: 'chart', metricName: 'pH' }
    ]
  };
  state.dashboards = [aquarium];
  saveState();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

// ===== AUTH & SUPABASE =====
async function initAuth() {
  if (!sb) { showLogin(); return; }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      await loadFromSupabase();
      updateUserProfile();
      render();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('Auth init failed', err);
    showLogin();
  }
}

function updateUserProfile() {
  const emailEl = document.getElementById('user-email');
  if (emailEl && currentUser) {
    emailEl.textContent = currentUser.email || 'User';
  }
}

function showProfileMenu() {
  showModal('Profile', `
    <p style="margin-bottom:1rem;"><strong>${currentUser?.email || 'User'}</strong></p>
    <div style="display:flex; gap:0.5rem;">
      <button class="btn-secondary btn" onclick="closeModal()">Close</button>
      <button class="btn" onclick="logout()">Log out</button>
    </div>
  `);
}

function showLogin() {
  document.getElementById('main-content').innerHTML = `
    <div class="card" style="max-width:400px; margin:4rem auto;">
      <h2>Login</h2>
      <div class="form-group"><label>Email</label><input id="auth-email" type="email"></div>
      <div class="form-group"><label>Password</label><input id="auth-password" type="password"></div>
      <div style="display:flex; gap:0.5rem; margin-top:1rem;">
        <button class="btn" onclick="doLogin()">Login</button>
        <button class="btn-secondary btn" onclick="doSignup()">Sign up</button>
      </div>
    </div>`;
}

async function doLogin() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
  else location.reload();
}

async function doSignup() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const { error } = await sb.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert('Account created. You can now log in.');
}

async function loadFromSupabase() {
  if (!currentUser) return;
  const { data, error } = await sb
    .from('dashboards')
    .select('data')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (data?.data && data.data.dashboards?.length) {
    state = { ...state, ...data.data };
    state.calendarDate = new Date(state.calendarDate || Date.now());
  } else if (!error) {
    // Try migrate from localStorage first
    const local = localStorage.getItem(STORAGE_KEY);
    let migrated = false;
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed.dashboards?.length) {
          state = { ...state, ...parsed };
          state.calendarDate = new Date(state.calendarDate || Date.now());
          migrated = true;
        }
      } catch (e) { console.error('Migration parse failed', e); }
    }
    if (!migrated && !state.dashboards.length) seedInitialData();
    await saveToSupabase();
  }
}

async function saveToSupabase() {
  if (!currentUser) return;
  const toSave = { ...state };
  toSave.calendarDate = toSave.calendarDate.toISOString();
  await sb.from('dashboards').upsert({
    user_id: currentUser.id,
    data: toSave,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  location.reload();
}

// ===== RENDER =====
function render() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // Destroy old charts
  Object.values(charts).forEach(c => c.destroy && c.destroy());
  charts = {};

  try {
    switch (state.currentView) {
      case 'home': renderHome(main); break;
      case 'dashboards': renderDashboards(main); break;
      case 'dashboard': renderDashboard(main); break;
      case 'calendar': renderCalendar(main); break;
      case 'activities': renderActivities(main); break;
      case 'settings': renderSettings(main); break;
      default: renderHome(main);
    }
  } catch (err) {
    console.error('Render error:', err);
    main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p>${err.message}</p><button class="btn" onclick="state.currentView='home'; render()">Go Home</button></div>`;
  }
  updateNav();
}

function updateNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === state.currentView);
  });
}

function renderHome(container) {
  const active = state.dashboards.filter(d => !d.archived);
  const upcoming = getUpcomingActivities(5);
  container.innerHTML = `
    <h1>Overview</h1>
    <div class="grid">
      ${active.map(d => `
        <div class="card" onclick="openDashboard('${d.id}')" style="cursor:pointer; border-left: 4px solid ${d.color}">
          <h3>${d.icon} ${d.name}</h3>
          <p>${d.metrics.length} metrics • ${d.activities.length} activities</p>
        </div>
      `).join('') || '<div class="empty-state">No dashboards yet. Create one!</div>'}
    </div>
    <h2 style="margin-top:2rem">Upcoming Activities</h2>
    ${upcoming.length ? upcoming.map(a => `
      <div class="card">
        <span class="color-dot" style="background:${a.dashboardColor}"></span>
        <strong>${a.name}</strong> — ${a.dashboardName}<br>
        <span class="status-${a.status}">${formatDate(a.date)} ${a.time || ''}</span>
      </div>
    `).join('') : '<div class="empty-state">No upcoming activities</div>'}
  `;
}

function renderDashboards(container) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
      <h1>My Dashboards</h1>
      <button class="btn" onclick="showCreateDashboard()">+ Create</button>
    </div>
    <div class="grid">
      ${state.dashboards.map(d => `
        <div class="card">
          <div style="display:flex; justify-content:space-between">
            <h3>${d.icon} ${d.name} ${d.archived ? '(Archived)' : ''}</h3>
            <div>
              <button class="btn-small btn-secondary" onclick="openDashboard('${d.id}')">Open</button>
              <button class="btn-small btn-secondary" onclick="editDashboard('${d.id}')">Edit</button>
              <button class="btn-small btn-danger" onclick="deleteDashboard('${d.id}')">Delete</button>
            </div>
          </div>
          <p style="margin-top:0.5rem; color:var(--text-muted)">${d.metrics.length} metrics</p>
          <button class="btn-small btn-secondary" onclick="duplicateDashboard('${d.id}')">Duplicate</button>
          <button class="btn-small btn-secondary" onclick="toggleArchive('${d.id}')">${d.archived ? 'Unarchive' : 'Archive'}</button>
        </div>
      `).join('')}
    </div>
  `;
}

function openDashboard(id) {
  state.currentDashboardId = id;
  state.currentView = 'dashboard';
  render();
}

function renderDashboard(container) {
  const dash = state.dashboards.find(d => d.id === state.currentDashboardId);
  if (!dash) { state.currentView = 'dashboards'; render(); return; }

  // Special polished layout for Freshwater Aquarium matching the concept
  if (dash.name.toLowerCase().includes('aquarium')) {
    container.innerHTML = renderAquariumConcept(dash);
    setTimeout(() => {
      renderCharts(dash);
      renderLightingChart(dash);
    }, 50);
    return;
  }

  // Fallback modular layout for other dashboards
  container.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-title">${dash.icon} ${dash.name}</div>
      <div>
        <button class="btn-secondary btn" onclick="showAddWidget()">+ Widget</button>
        <button class="btn-secondary btn" onclick="state.currentView='dashboards'; render()">Back</button>
      </div>
    </div>
    <div class="grid" id="widgets-grid">
      ${dash.widgets.map((w, idx) => renderWidget(dash, w, idx)).join('')}
    </div>
  `;
  setTimeout(() => renderCharts(dash), 50);
}

function renderAquariumConcept(dash) {
  // Key metrics for the concept row
  const temp = dash.metrics.find(m => m.name === 'Temperature');
  const ph = dash.metrics.find(m => m.name === 'pH');
  const nitrate = dash.metrics.find(m => m.name === 'Nitrate');
  const last = (m) => m && m.history.length ? m.history[m.history.length - 1].value : null;

  const tempVal = last(temp);
  const phVal = last(ph);
  const nitrateVal = last(nitrate);

  // Week days for activity circles
  const today = new Date();
  const weekStart = getWeekStart(today);
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const dayNums = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.getDate();
  });
  const todayIdx = (today.getDay() + 6) % 7; // Monday=0

  // Upcoming activities (simplified)
  const upcoming = dash.activities
    .filter(a => a.name.toLowerCase().includes('water') || a.name.toLowerCase().includes('test') || a.name.toLowerCase().includes('change'))
    .slice(0, 3);

  return `
    <div class="dashboard-header">
      <div class="dashboard-title">${dash.icon} ${dash.name}</div>
      <span class="badge">Dashboard</span>
    </div>

    <div class="metrics-row">
      <div class="metric-card">
        <div class="label">Temperature</div>
        <div class="value">${tempVal !== null ? tempVal : '—'}<span class="unit">°C</span></div>
      </div>
      <div class="metric-card">
        <div class="label">pH</div>
        <div class="value">${phVal !== null ? phVal : '—'}</div>
      </div>
      <div class="metric-card">
        <div class="label">Nitrate</div>
        <div class="value">${nitrateVal !== null ? nitrateVal : '—'}<span class="unit">ppm</span></div>
      </div>
    </div>
    <p class="note">Illustrative layout — readings appear here after you log real data. No data is fabricated.</p>

    <div class="section-title">Equipment status</div>
    <div class="card">
      <h4 style="margin-bottom:0.75rem">Lighting Schedule</h4>
      <div class="chart-container" style="height:160px"><canvas id="lighting-chart"></canvas></div>
    </div>
    <div class="card">
      <h4 style="margin-bottom:0.75rem">CO2</h4>
      <div><strong>ON:</strong> ${(dash.config.co2Schedule||{}).on || '—'}</div>
      <div><strong>OFF:</strong> ${(dash.config.co2Schedule||{}).off || '—'}</div>
      <div><strong>Last cartridge change:</strong> ${(dash.config.co2Schedule||{}).lastChange || 'Not recorded'}</div>
    </div>
    <div class="card">
      <h4 style="margin-bottom:0.75rem">Latest Water Test</h4>
      ${(() => {
        const params = ['Temperature','pH','Ammonia','Nitrite','Nitrate','TDS','GH','KH'];
        const rows = params.map(name => {
          const m = dash.metrics.find(x => x.name === name);
          const last = m && m.history.length ? m.history[m.history.length-1] : null;
          return last ? `<div><strong>${name}:</strong> ${last.value} ${m.unit||''} <span style="color:var(--text-muted);font-size:0.8rem;">(${last.date})</span></div>` : '';
        }).filter(Boolean);
        return rows.length ? rows.join('') : '<div class="empty-state">No data recorded</div>';
      })()}
      <button class="btn" style="margin-top:0.75rem" onclick="showWaterTestModal()">Log Water Test</button>
      <button class="btn-small btn-secondary" style="margin-top:0.5rem; margin-left:0.5rem;" onclick="if(confirm('Clear all water test data?')) clearWaterTestData()">Clear Data</button>
    </div>

    <div class="section-title">This week's activities</div>
    <div class="week-days">
      ${days.map((label, i) => {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        const dayActs = dash.activities.filter(a => {
          if (a.recurrence === 'daily') return true;
          if (a.recurrence === 'alternate') return (dayDate.getDate() % 2 === 0);
          if (a.recurrence === 'weekly') return dayDate.getDay() === 0;
          return false;
        });
        return `<div class="day-circle ${i === todayIdx ? 'today' : ''}">
          <span class="label">${label}</span>
          <div class="num">${dayNums[i]}</div>
          <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.35rem; width:100%;">
            ${dayActs.map(a => `<button class="badge ${isCompletedOnDate(a, dayDate) ? 'completed' : ''}" style="font-size:0.65rem; text-align:center; border:none; cursor:pointer;" onclick="showActivityOptions('${a.id}', '${dayDate.toISOString().slice(0,10)}')">${a.name}</button>`).join('')}
            <button class="badge" style="font-size:0.65rem; text-align:center; border:none; cursor:pointer; opacity:0.7;" onclick="showAddActivityForDay('${dayDate.toISOString().slice(0,10)}')">+</button>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="upcoming-card">
      <div class="upcoming-header">
        <span class="badge" style="background:#1a3a3a;color:#26c6da;">Today</span>
        <strong>Upcoming activities</strong>
      </div>
      ${upcoming.length ? upcoming.map(a => `
        <div class="upcoming-item">
          <div class="left">
            <span>${a.name.includes('change') ? '💧' : '🧪'}</span>
            <span>${a.name}</span>
          </div>
          <span style="color:var(--text-muted);font-size:0.85rem;">${a.recurrence === 'weekly' ? 'Sunday' : 'Scheduled'}</span>
        </div>
      `).join('') : '<div class="empty-state" style="padding:1rem;">No upcoming activities</div>'}
    </div>

    <div style="margin-top:1.5rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
      <button class="btn-secondary btn" onclick="showAddWidget()">+ Widget</button>
      <button class="btn-secondary btn" onclick="state.currentView='dashboards'; render()">Back</button>
    </div>

    <!-- Existing widgets still available below for full modular access -->
    <div class="section-title" style="margin-top:2rem;">Additional Widgets</div>
    <div class="grid">
      ${dash.widgets.filter(w => w.type !== 'metrics-overview' && w.type !== 'water-test').map((w, idx) => renderWidget(dash, w, idx)).join('')}
    </div>
  `;
}

function showWaterTestModal() {
  const dash = getCurrentDash();
  if (!dash) return;
  showModal('Log Water Test', `
    <form onsubmit="logWaterTest(event); closeModal();">
      <div class="form-group"><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}" required></div>
      <div class="form-group"><label>Temperature (°C)</label><input type="number" step="0.1" name="temp" placeholder="optional"></div>
      <div class="form-group"><label>pH</label><input type="number" step="0.1" name="ph" placeholder="optional"></div>
      <div class="form-group"><label>Ammonia (ppm)</label><input type="number" step="0.01" name="ammonia" placeholder="optional"></div>
      <div class="form-group"><label>Nitrite (ppm)</label><input type="number" step="0.01" name="nitrite" placeholder="optional"></div>
      <div class="form-group"><label>Nitrate (ppm)</label><input type="number" step="0.1" name="nitrate" placeholder="optional"></div>
      <div class="form-group"><label>TDS</label><input type="number" name="tds" placeholder="optional"></div>
      <div class="form-group"><label>GH</label><input type="number" step="0.5" name="gh" placeholder="optional"></div>
      <div class="form-group"><label>KH</label><input type="number" step="0.5" name="kh" placeholder="optional"></div>
      <div class="form-group"><label>Notes</label><textarea name="notes"></textarea></div>
      <div style="display:flex; gap:0.5rem; margin-top:1rem;">
        <button type="submit" class="btn">Log Test</button>
        <button type="button" class="btn-secondary btn" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
}


function getWidgetTitle(w) {
  const titles = {
    config: 'Equipment Config',
    'metrics-overview': 'Metrics',
    'water-test': 'Water Testing',
    activities: "Today's Schedule",
    chart: w.metricName + ' Chart',
    'co2-schedule': 'CO2 Schedule',
    'lighting-schedule': 'Lighting Schedule'
  };
  return titles[w.type] || w.type;
}

function renderWidget(dash, widget, idx) {
  const editing = isEditing(widget.id);
  const header = `<div class="widget-header"><h3>${getWidgetTitle(widget)}</h3>
    <div style="display:flex; gap:0.25rem; align-items:center;">
      ${!editing && widget.type !== 'activities' ? `<button class="btn-small" onclick="toggleEditWidget('${widget.id}')">Edit</button>` : ''}
      <button class="icon-btn" onclick="moveWidget('${widget.id}', -1)">↑</button>
      <button class="icon-btn" onclick="moveWidget('${widget.id}', 1)">↓</button>
      <button class="icon-btn" onclick="removeWidget('${widget.id}')">×</button>
    </div></div>`;

  let content = '';

  switch (widget.type) {
    case 'config':
      const items = dash.config.equipment || [
        { label: 'Tank', value: dash.config.tank || '' },
        { label: 'Filter', value: dash.config.filter || '' },
        { label: 'Lighting', value: dash.config.lighting || '' },
        { label: 'CO2', value: dash.config.co2 || '' },
        { label: 'Temp Target', value: dash.config.tempTarget || '' }
      ];
      if (!dash.config.equipment) dash.config.equipment = items;
      if (editing) {
        content = items.map((item, i) => `
          <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;">
            <input style="width:120px" value="${item.label}" onchange="updateEquipmentItem(${i}, 'label', this.value)">
            <input style="flex:1" value="${item.value}" onchange="updateEquipmentItem(${i}, 'value', this.value)">
            <button class="btn-small btn-danger" onclick="removeEquipmentItem(${i})">Remove</button>
          </div>
        `).join('');
        content += `<button class="btn-small" onclick="addEquipmentItem()">+ Add Item</button>
          <button class="btn" style="margin-top:0.75rem" onclick="saveWidget('${widget.id}')">Save</button>`;
      } else {
        content = items.map(item => `<div style="margin-bottom:0.4rem"><strong>${item.label}:</strong> ${item.value || '—'}</div>`).join('');
      }
      break;

    case 'activities':
      const todayActs = dash.activities.filter(a => {
        if (a.recurrence === 'daily') return true;
        if (a.recurrence === 'alternate') return (new Date().getDate() % 2 === 0);
        if (a.recurrence === 'weekly') return new Date().getDay() === 0;
        return false;
      });
      content = todayActs.map(a => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
          <span>${a.name}</span>
          <span class="badge ${isCompletedToday(a) ? 'completed' : ''}">${isCompletedToday(a) ? 'Completed' : 'Not completed'}</span>
        </div>
      `).join('') || '<div class="empty-state">No activities for today</div>';
      break;

    case 'lighting-schedule':
      const lights = dash.config.lightingSchedule || [
        { window: 'Morning', on: '08:00', off: '12:00', intensity: '50%' }
      ];
      if (!dash.config.lightingSchedule) dash.config.lightingSchedule = lights;
      if (editing) {
        content = lights.map((l, i) => `
          <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap;">
            <input style="width:100px" value="${l.window}" onchange="updateLightingWindow(${i}, 'window', this.value)" placeholder="Window">
            <input type="time" value="${l.on}" onchange="updateLightingWindow(${i}, 'on', this.value)">
            <span>–</span>
            <input type="time" value="${l.off}" onchange="updateLightingWindow(${i}, 'off', this.value)">
            <input style="width:70px" value="${l.intensity}" onchange="updateLightingWindow(${i}, 'intensity', this.value)" placeholder="%">
            <button class="btn-small btn-danger" onclick="removeLightingWindow(${i})">Remove</button>
          </div>
        `).join('');
        content += `<button class="btn-small" onclick="addLightingWindow()">+ Add Window</button>
          <button class="btn" style="margin-top:0.75rem" onclick="saveWidget('${widget.id}')">Save</button>`;
      } else {
        content = lights.map(l => `<div style="margin-bottom:0.4rem"><strong>${l.window}:</strong> ${l.on} – ${l.off} (${l.intensity})</div>`).join('') || '<div class="empty-state">No lighting windows</div>';
      }
      break;

    case 'co2-schedule':
      const co2 = dash.config.co2Schedule || { on: '09:00', off: '19:00', lastChange: '' };
      if (editing) {
        content = `
          <div class="form-group"><label>ON time</label><input type="time" value="${co2.on}" onchange="updateCo2Schedule('on', this.value)"></div>
          <div class="form-group"><label>OFF time</label><input type="time" value="${co2.off}" onchange="updateCo2Schedule('off', this.value)"></div>
          <div class="form-group"><label>Last cartridge change</label><input type="date" value="${co2.lastChange}" onchange="updateCo2Schedule('lastChange', this.value)"></div>
          <button class="btn" onclick="saveWidget('${widget.id}')">Save</button>
        `;
      } else {
        content = `
          <div><strong>ON:</strong> ${co2.on}</div>
          <div><strong>OFF:</strong> ${co2.off}</div>
          <div><strong>Last cartridge change:</strong> ${co2.lastChange || 'Not recorded'}</div>
        `;
      }
      break;

    case 'metrics-overview':
      content = dash.metrics.map(m => {
        const last = m.history[m.history.length - 1];
        return `<div style="margin-bottom:0.5rem"><strong>${m.name}</strong> <span class="metric-value">${last ? last.value : '—'}</span> ${m.unit || ''}</div>`;
      }).join('') || '<div class="empty-state">No metrics</div>';
      if (editing) content += `<button class="btn-small" onclick="showAddMetric()">+ Metric</button><button class="btn" style="margin-top:0.75rem" onclick="saveWidget('${widget.id}')">Save</button>`;
      break;

    case 'chart':
      const metric = dash.metrics.find(m => m.name === widget.metricName);
      content = metric && metric.history.length ? `<div class="chart-container"><canvas id="chart-${widget.id}"></canvas></div>` : '<div class="empty-state">No data recorded</div>';
      if (editing) content += `<button class="btn" style="margin-top:0.75rem" onclick="saveWidget('${widget.id}')">Save</button>`;
      break;

    case 'water-test':
      if (editing) {
        content = `<p style="color:var(--text-muted);margin-bottom:0.75rem;">Water testing form is always available. Click Save to exit edit mode.</p>
          <button class="btn" onclick="saveWidget('${widget.id}')">Save</button>`;
      } else {
        content = `<button class="btn" onclick="showWaterTestModal()">Log Water Test</button>`;
      }
      break;

    default:
      content = '<div class="empty-state">Widget</div>';
  }

  return `<div class="card" data-widget="${widget.id}">${header}${content}</div>`;
}

function renderLightingChart(dash) {
  const ctx = document.getElementById('lighting-chart');
  if (!ctx) return;
  const lights = dash.config.lightingSchedule || [];
  if (!lights.length) return;
  if (charts['lighting']) charts['lighting'].destroy();

  // Build 24-hour intensity curve (every 30 min)
  const points = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const minutes = h * 60 + m;
      let intensity = 0;
      for (const l of lights) {
        const [onH, onM] = l.on.split(':').map(Number);
        const [offH, offM] = l.off.split(':').map(Number);
        const onMin = onH * 60 + onM;
        const offMin = offH * 60 + offM;
        const pct = parseInt(l.intensity) || 0;
        if (minutes >= onMin && minutes < offMin) intensity = Math.max(intensity, pct);
      }
      points.push({ time: timeStr, intensity });
    }
  }

  // Calculate max intensity rounded up to nearest 10
  const maxIntensity = Math.max(...lights.map(l => parseInt(l.intensity) || 0), 10);
  const yMax = Math.ceil(maxIntensity / 10) * 10;

  charts['lighting'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(p => p.time),
      datasets: [{
        label: 'Intensity %',
        data: points.map(p => p.intensity),
        borderColor: '#26c6da',
        backgroundColor: 'rgba(38,198,218,0.15)',
        tension: 0.1,
        fill: true,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          title: { display: true, text: 'Time' },
          ticks: { maxTicksLimit: 8, callback: (val, idx) => points[idx]?.time.endsWith(':00') ? points[idx].time : '' }
        },
        y: {
          beginAtZero: true,
          max: yMax,
          title: { display: true, text: 'Light %' }
        }
      }
    }
  });
}

function renderCharts(dash) {
  dash.widgets.forEach(w => {
    if (w.type === 'chart') {
      const metric = dash.metrics.find(m => m.name === w.metricName);
      if (metric && metric.history.length) {
        const ctx = document.getElementById(`chart-${w.id}`);
        if (ctx) {
          charts[w.id] = new Chart(ctx, {
            type: 'line',
            data: {
              labels: metric.history.map(h => new Date(h.date).toLocaleDateString()),
              datasets: [{ label: metric.name, data: metric.history.map(h => h.value), borderColor: '#26c6da', tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          });
        }
      }
    }
  });
}

function renderCalendar(container) {
  const start = getWeekStart(state.calendarDate);
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const events = getEventsForRange(start, new Date(start.getTime() + 7*86400000));

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center">
      <h1>Global Calendar</h1>
      <div>
        <button class="btn-secondary" onclick="changeWeek(-1)">← Prev</button>
        <button class="btn-secondary" onclick="changeWeek(1)">Next →</button>
        <select onchange="state.calendarFilter=this.value; render()" style="margin-left:0.5rem">
          <option value="all">All Dashboards</option>
          ${state.dashboards.map(d => `<option value="${d.id}" ${state.calendarFilter===d.id?'selected':''}>${d.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <p>Week of ${formatDate(start)}</p>
    <div class="calendar-grid">
      ${days.map(day => {
        const dayEvents = events.filter(e => sameDay(e.date, day));
        const isToday = sameDay(day, new Date());
        return `<div class="calendar-day ${isToday ? 'today' : ''}">
          <strong>${day.toLocaleDateString(undefined, {weekday:'short', day:'numeric'})}</strong>
          ${dayEvents.map(e => `<div class="activity-item" style="border-left:3px solid ${e.color}" onclick="showActivityDetail('${e.activityId}')">${e.name}</div>`).join('')}
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderActivities(container) {
  const all = getAllActivities();
  container.innerHTML = `
    <h1>All Activities</h1>
    ${all.map(a => `
      <div class="card">
        <span class="color-dot" style="background:${a.dashboardColor}"></span>
        <strong>${a.name}</strong> (${a.dashboardName}) — ${a.recurrence || 'one-time'}
        <button class="btn-small" style="float:right" onclick="completeActivity('${a.id}', '${a.dashboardId}')">Complete Task</button>
      </div>
    `).join('') || '<div class="empty-state">No activities</div>'}
  `;
}

function renderSettings(container) {
  container.innerHTML = `
    <h1>Settings</h1>
    <div class="card">
      <label>Theme</label>
      <select onchange="setTheme(this.value)">
        <option value="dark" ${state.theme==='dark'?'selected':''}>Dark</option>
        <option value="light" ${state.theme==='light'?'selected':''}>Light</option>
      </select>
    </div>
    <div class="card">
      <button class="btn" onclick="exportData()">Export Data (JSON)</button>
      <button class="btn-secondary" onclick="importData()">Import Data</button>
      <p style="margin-top:0.5rem; color:var(--text-muted)">Backup/restore ready. Future: notifications, CSV export, sensors.</p>
    </div>
  `;
}

// ===== ACTIONS =====
function showCreateDashboard() {
  showModal('Create Dashboard', `
    <div class="form-group"><label>Name</label><input id="new-name" placeholder="e.g. Groceries"></div>
    <div class="form-group"><label>Icon</label><input id="new-icon" value="📊" maxlength="2"></div>
    <div class="form-group"><label>Color</label><input type="color" id="new-color" value="#26c6da"></div>
    <div class="form-group"><label>Template</label>
      <select id="new-template">
        <option value="blank">Blank</option>
        <option value="aquarium">Freshwater Aquarium</option>
        <option value="household">Household</option>
        <option value="groceries">Groceries</option>
      </select>
    </div>
    <button class="btn" onclick="createDashboard()">Create</button>
  `);
}

function createDashboard() {
  const name = document.getElementById('new-name').value || 'New Dashboard';
  const icon = document.getElementById('new-icon').value || '📊';
  const color = document.getElementById('new-color').value;
  const template = document.getElementById('new-template').value;
  const id = generateId();
  let dash = { id, name, icon, color, archived: false, config: {}, metrics: [], activities: [], widgets: [] };

  if (template === 'aquarium') {
    // Simplified seed
    dash.config = { tank: 'New tank', filter: '', lighting: '', co2: '', tempTarget: '25°C' };
    dash.metrics = [{ id: generateId(), name: 'Temperature', unit: '°C', type: 'number', history: [] }];
    dash.widgets = [{ id: generateId(), type: 'metrics-overview' }, { id: generateId(), type: 'water-test' }];
  } else if (template === 'household') {
    dash.metrics = [{ id: generateId(), name: 'Appliance Status', type: 'text', history: [] }];
    dash.activities = [{ id: generateId(), name: 'Maintenance Check', recurrence: 'monthly', history: [] }];
    dash.widgets = [{ id: generateId(), type: 'activities' }];
  } else if (template === 'groceries') {
    dash.metrics = [{ id: generateId(), name: 'Inventory', type: 'text', history: [] }];
    dash.widgets = [{ id: generateId(), type: 'metrics-overview' }];
  }

  state.dashboards.push(dash);
  saveState();
  closeModal();
  openDashboard(id);
}

let editingWidgets = new Set();

function toggleEditWidget(id) {
  if (editingWidgets.has(id)) editingWidgets.delete(id);
  else editingWidgets.add(id);
  render();
}

function saveWidget(id) {
  editingWidgets.delete(id);
  saveState();
  render();
}

function isEditing(id) {
  return editingWidgets.has(id);
}

function updateCo2Schedule(key, value) {
  const dash = getCurrentDash();
  if (!dash) return;
  if (!dash.config.co2Schedule) dash.config.co2Schedule = { on: '09:00', off: '19:00', lastChange: '' };
  dash.config.co2Schedule[key] = value;
  saveState();
  render();
}

function updateLightingWindow(idx, key, value) {
  const dash = getCurrentDash();
  if (!dash) return;
  if (!dash.config.lightingSchedule) dash.config.lightingSchedule = [];
  if (dash.config.lightingSchedule[idx]) {
    dash.config.lightingSchedule[idx][key] = value;
    saveState();
    render();
  }
}

function addLightingWindow() {
  const dash = getCurrentDash();
  if (!dash) return;
  if (!dash.config.lightingSchedule) dash.config.lightingSchedule = [];
  dash.config.lightingSchedule.push({ window: 'New', on: '08:00', off: '12:00', intensity: '50%' });
  saveState();
  render();
}

function removeLightingWindow(idx) {
  const dash = getCurrentDash();
  if (!dash || !dash.config.lightingSchedule) return;
  dash.config.lightingSchedule.splice(idx, 1);
  saveState();
  render();
}

function removeActivity(id) {
  const dash = getCurrentDash();
  if (!dash) return;
  dash.activities = dash.activities.filter(a => a.id !== id);
  saveState();
  render();
}

function updateEquipmentItem(idx, key, value) {
  const dash = getCurrentDash();
  if (!dash || !dash.config.equipment) return;
  dash.config.equipment[idx][key] = value;
  saveState();
}

function addEquipmentItem() {
  const dash = getCurrentDash();
  if (!dash) return;
  if (!dash.config.equipment) dash.config.equipment = [];
  dash.config.equipment.push({ label: 'New', value: '' });
  saveState();
  render();
}

function removeEquipmentItem(idx) {
  const dash = getCurrentDash();
  if (!dash || !dash.config.equipment) return;
  dash.config.equipment.splice(idx, 1);
  saveState();
  render();
}

function updateActivity(id, key, value) {
  const dash = getCurrentDash();
  if (!dash) return;
  const act = dash.activities.find(a => a.id === id);
  if (act) {
    act[key] = value || null;
    saveState();
  }
}

function clearWaterTestData() {
  const dash = state.dashboards.find(d => d.name.toLowerCase().includes('aquarium'));
  if (!dash) return;
  const waterMetrics = ['Temperature','pH','Ammonia','Nitrite','Nitrate','TDS','GH','KH'];
  dash.metrics.forEach(m => {
    if (waterMetrics.includes(m.name)) m.history = [];
  });
  saveState();
  render();
}

function logWaterTest(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const date = data.get('date');
  const notes = data.get('notes');
  const dash = getCurrentDash();
  if (!dash) return;

  const params = ['temp','ph','ammonia','nitrite','nitrate','tds','gh','kh'];
  const nameMap = { temp: 'Temperature', ph: 'pH', ammonia: 'Ammonia', nitrite: 'Nitrite', nitrate: 'Nitrate', tds: 'TDS', gh: 'GH', kh: 'KH' };
  params.forEach(p => {
    const val = data.get(p);
    if (val) {
      const metric = dash.metrics.find(m => m.name === nameMap[p]);
      if (metric) {
        const existingIdx = metric.history.findIndex(h => h.date === date);
        const entry = { date, value: parseFloat(val), notes };
        if (existingIdx >= 0) metric.history[existingIdx] = entry;
        else metric.history.push(entry);
      }
    }
  });
  saveState();
  render();
  alert('Test logged');
}

function completeActivity(id, dashId) {
  const dash = dashId ? state.dashboards.find(d => d.id === dashId) : getCurrentDash();
  if (!dash) return;
  const act = dash.activities.find(a => a.id === id);
  if (act) {
    const today = new Date().toISOString().slice(0, 10);
    if (!act.history.some(h => h.date.startsWith(today))) {
      act.history.push({ date: new Date().toISOString(), completed: true });
    }
    saveState();
    render();
  }
}

function showActivityOptions(activityId, dateStr) {
  const dash = getCurrentDash();
  if (!dash) return;
  const act = dash.activities.find(a => a.id === activityId);
  if (!act) return;
  const completed = isCompletedOnDate(act, new Date(dateStr));
  showModal(act.name, `
    <p style="margin-bottom:1rem;">Date: ${dateStr}</p>
    <div style="display:flex; gap:0.5rem;">
      <button class="btn" onclick="completeActivityOnDate('${activityId}', '${dateStr}'); closeModal();">${completed ? 'Already Completed' : 'Complete Task'}</button>
      <button class="btn-secondary btn" onclick="resetActivityOnDate('${activityId}', '${dateStr}'); closeModal();">Reset</button>
    </div>
  `);
}

function showAddActivityForDay(dateStr) {
  showModal('Add Activity', `
    <div class="form-group"><label>Name</label><input id="a-name"></div>
    <div class="form-group"><label>Recurrence</label>
      <select id="a-rec"><option value="">None</option><option>daily</option><option>alternate</option><option>weekly</option><option>monthly</option></select>
    </div>
    <div style="display:flex; gap:0.5rem; margin-top:1rem;">
      <button class="btn" onclick="addActivityForDay('${dateStr}')">Add</button>
      <button type="button" class="btn-secondary btn" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

function addActivityForDay(dateStr) {
  const dash = getCurrentDash();
  if (!dash) return;
  dash.activities.push({
    id: generateId(),
    name: document.getElementById('a-name').value || 'New Activity',
    recurrence: document.getElementById('a-rec').value || null,
    history: []
  });
  saveState();
  closeModal();
  render();
}

function isCompletedOnDate(act, date) {
  const dateStr = date.toISOString ? date.toISOString().slice(0, 10) : date;
  return act.history.some(h => h.date.startsWith(dateStr) && h.completed);
}

function completeActivityOnDate(id, dateStr) {
  const dash = getCurrentDash();
  if (!dash) return;
  const act = dash.activities.find(a => a.id === id);
  if (act && !isCompletedOnDate(act, dateStr)) {
    act.history.push({ date: dateStr + 'T12:00:00', completed: true });
    saveState();
    render();
  }
}

function resetActivityOnDate(id, dateStr) {
  const dash = getCurrentDash();
  if (!dash) return;
  const act = dash.activities.find(a => a.id === id);
  if (act) {
    act.history = act.history.filter(h => !h.date.startsWith(dateStr));
    saveState();
    render();
  }
}

function isCompletedToday(act) {
  return isCompletedOnDate(act, new Date());
}

function showAddMetric() {
  showModal('Add Metric', `
    <div class="form-group"><label>Name</label><input id="m-name"></div>
    <div class="form-group"><label>Unit</label><input id="m-unit"></div>
    <div class="form-group"><label>Type</label>
      <select id="m-type"><option>number</option><option>decimal</option><option>percentage</option><option>text</option><option>boolean</option><option>date</option></select>
    </div>
    <button class="btn" onclick="addMetric()">Add</button>
  `);
}

function addMetric() {
  const dash = getCurrentDash();
  if (!dash) return;
  dash.metrics.push({
    id: generateId(),
    name: document.getElementById('m-name').value || 'New Metric',
    unit: document.getElementById('m-unit').value,
    type: document.getElementById('m-type').value,
    history: []
  });
  saveState();
  closeModal();
  render();
}

function showAddActivity() {
  showModal('Add Activity', `
    <div class="form-group"><label>Name</label><input id="a-name"></div>
    <div class="form-group"><label>Recurrence</label>
      <select id="a-rec"><option value="">None</option><option>daily</option><option>alternate</option><option>weekly</option><option>monthly</option></select>
    </div>
    <button class="btn" onclick="addActivity()">Add</button>
  `);
}

function addActivity() {
  const dash = getCurrentDash();
  if (!dash) return;
  dash.activities.push({
    id: generateId(),
    name: document.getElementById('a-name').value || 'New Activity',
    recurrence: document.getElementById('a-rec').value || null,
    history: []
  });
  saveState();
  closeModal();
  render();
}

function showAddWidget() {
  const dash = getCurrentDash();
  showModal('Add Widget', `
    <div class="form-group"><label>Type</label>
      <select id="w-type">
        <option value="metrics-overview">Metrics Overview</option>
        <option value="activities">Activities</option>
        <option value="chart">Chart (select metric)</option>
        <option value="co2-schedule">CO2 Schedule</option>
        <option value="lighting-schedule">Lighting Schedule</option>
        <option value="notes">Notes</option>
      </select>
    </div>
    <div class="form-group" id="metric-select" style="display:none">
      <label>Metric</label>
      <select id="w-metric">${dash.metrics.map(m => `<option>${m.name}</option>`).join('')}</select>
    </div>
    <button class="btn" onclick="addWidget()">Add</button>
  `);
  document.getElementById('w-type').onchange = function() {
    document.getElementById('metric-select').style.display = this.value === 'chart' ? 'block' : 'none';
  };
}

function addWidget() {
  const dash = getCurrentDash();
  const type = document.getElementById('w-type').value;
  const widget = { id: generateId(), type };
  if (type === 'chart') widget.metricName = document.getElementById('w-metric').value;
  dash.widgets.push(widget);
  saveState();
  closeModal();
  render();
}

function removeWidget(id) {
  const dash = getCurrentDash();
  dash.widgets = dash.widgets.filter(w => w.id !== id);
  saveState();
  render();
}

function moveWidget(widgetId, dir) {
  const dash = getCurrentDash();
  if (!dash) return;
  const idx = dash.widgets.findIndex(w => w.id === widgetId);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < dash.widgets.length) {
    [dash.widgets[idx], dash.widgets[newIdx]] = [dash.widgets[newIdx], dash.widgets[idx]];
    saveState();
    render();
  }
}

function deleteDashboard(id) {
  if (confirm('Delete this dashboard? Data will be lost.')) {
    state.dashboards = state.dashboards.filter(d => d.id !== id);
    saveState();
    render();
  }
}

function duplicateDashboard(id) {
  const orig = state.dashboards.find(d => d.id === id);
  if (orig) {
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = generateId();
    copy.name += ' (Copy)';
    copy.metrics.forEach(m => m.id = generateId());
    copy.activities.forEach(a => a.id = generateId());
    copy.widgets.forEach(w => w.id = generateId());
    state.dashboards.push(copy);
    saveState();
    render();
  }
}

function toggleArchive(id) {
  const d = state.dashboards.find(x => x.id === id);
  if (d) { d.archived = !d.archived; saveState(); render(); }
}

function editDashboard(id) {
  const d = state.dashboards.find(x => x.id === id);
  showModal('Edit Dashboard', `
    <div class="form-group"><label>Name</label><input id="edit-name" value="${d.name}"></div>
    <div class="form-group"><label>Icon</label><input id="edit-icon" value="${d.icon}"></div>
    <div class="form-group"><label>Color</label><input type="color" id="edit-color" value="${d.color}"></div>
    <button class="btn" onclick="saveEdit('${id}')">Save</button>
  `);
}

function saveEdit(id) {
  const d = state.dashboards.find(x => x.id === id);
  d.name = document.getElementById('edit-name').value;
  d.icon = document.getElementById('edit-icon').value;
  d.color = document.getElementById('edit-color').value;
  saveState();
  closeModal();
  render();
}

function setTheme(theme) {
  state.theme = theme;
  applyTheme();
  saveState();
}

function changeWeek(delta) {
  state.calendarDate.setDate(state.calendarDate.getDate() + delta * 7);
  saveState();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dashboard-backup.json';
  a.click();
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = JSON.parse(reader.result);
        state.calendarDate = new Date(state.calendarDate);
        saveState();
        applyTheme();
        render();
        alert('Imported');
      } catch { alert('Invalid file'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== HELPERS =====
function getCurrentDash() {
  return state.dashboards.find(d => d.id === state.currentDashboardId);
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function formatDate(d) {
  return new Date(d).toLocaleDateString();
}

function getUpcomingActivities(limit = 10) {
  const upcoming = [];
  state.dashboards.filter(d => !d.archived).forEach(dash => {
    dash.activities.forEach(act => {
      // Simple: next occurrence based on recurrence
      const next = calculateNext(act);
      if (next) {
        upcoming.push({
          ...act,
          date: next,
          dashboardName: dash.name,
          dashboardColor: dash.color,
          status: next < new Date() ? 'overdue' : 'upcoming'
        });
      }
    });
  });
  return upcoming.sort((a,b) => a.date - b.date).slice(0, limit);
}

function calculateNext(act) {
  if (!act.recurrence) return null;
  const last = act.history.length ? new Date(act.history[act.history.length-1].date) : new Date();
  const next = new Date(last);
  if (act.recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (act.recurrence === 'alternate') next.setDate(next.getDate() + 2);
  else if (act.recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else if (act.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

function getEventsForRange(start, end) {
  const events = [];
  state.dashboards.forEach(dash => {
    if (state.calendarFilter !== 'all' && state.calendarFilter !== dash.id) return;
    dash.activities.forEach(act => {
      // Generate occurrences in range (simplified for daily/weekly)
      let d = new Date(start);
      while (d < end) {
        events.push({
          date: new Date(d),
          name: act.name,
          color: dash.color,
          activityId: act.id,
          dashboardId: dash.id
        });
        if (act.recurrence === 'daily') d.setDate(d.getDate() + 1);
        else if (act.recurrence === 'alternate') d.setDate(d.getDate() + 2);
        else if (act.recurrence === 'weekly') d.setDate(d.getDate() + 7);
        else break;
      }
    });
  });
  return events;
}

function getAllActivities() {
  const all = [];
  state.dashboards.forEach(dash => {
    dash.activities.forEach(act => {
      all.push({ ...act, dashboardName: dash.name, dashboardColor: dash.color, dashboardId: dash.id });
    });
  });
  return all;
}

function showActivityDetail(id) {
  // Find and show modal with details
  let found;
  state.dashboards.forEach(d => {
    const a = d.activities.find(x => x.id === id);
    if (a) found = { ...a, dash: d.name };
  });
  if (found) {
    showModal(found.name, `<p>Dashboard: ${found.dash}</p><p>Recurrence: ${found.recurrence || 'none'}</p><p>Completions: ${found.history.length}</p>`);
  }
}

// Modal helpers
function showModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  // Nav - more robust handling
  document.getElementById('nav').addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const item = e.target.closest('.nav-item');
    if (!item) return;

    if (item.id === 'create-dashboard-btn') {
      showCreateDashboard();
      return;
    }

    if (item.dataset.view) {
      state.currentView = item.dataset.view;
      state.currentDashboardId = null;
      render();
    }
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
});
