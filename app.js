// ─── 데이터 ────────────────────────────────────────────────────────────────

const PRESETS = [
  { name: '칫솔',     cycleDays: 90  },
  { name: '수세미',   cycleDays: 30  },
  { name: '베개',     cycleDays: 730 },
  { name: '샤워타월', cycleDays: 90  },
  { name: '수건',     cycleDays: 365 },
  { name: '도마',     cycleDays: 730 },
];

function loadItems() {
  return JSON.parse(localStorage.getItem('cyclo_items') || '[]');
}

function saveItems(items) {
  localStorage.setItem('cyclo_items', JSON.stringify(items));
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── 로직 ────────────────────────────────────────────────────────────────────

function daysLeft(item) {
  const start = new Date(item.startDate);
  const due   = new Date(start);
  due.setDate(due.getDate() + item.cycleDays);
  const diff  = Math.round((due - new Date()) / 86400000);
  return diff; // 음수 = 지남
}

function addItem(name, cycleDays, isCustom = false) {
  const items = loadItems();
  if (items.some(i => i.name === name)) return; // 중복 방지
  items.push({ id: uuid(), name, cycleDays, startDate: today(), isCustom });
  saveItems(items);
}

function resetItem(id) {
  const items = loadItems().map(i => i.id === id ? { ...i, startDate: today() } : i);
  saveItems(items);
}

function removeItem(id) {
  saveItems(loadItems().filter(i => i.id !== id));
}

// ─── 렌더링 ──────────────────────────────────────────────────────────────────

const itemList   = document.getElementById('item-list');
const emptyMsg   = document.getElementById('empty-msg');
const addPanel   = document.getElementById('add-panel');
const presetGrid = document.getElementById('preset-grid');
const resetModal = document.getElementById('reset-modal');
const resetMsg   = document.getElementById('reset-modal-msg');

function urgencyClass(days) {
  if (days < 0)  return 'overdue';
  if (days <= 7) return 'soon';
  return 'ok';
}

function daysLabel(days) {
  if (days < 0)  return `${Math.abs(days)}일 지남`;
  if (days === 0) return '오늘 교체!';
  return `D-${days}`;
}

function render() {
  const items = loadItems().sort((a, b) => daysLeft(a) - daysLeft(b));
  itemList.innerHTML = '';
  emptyMsg.hidden = items.length > 0;

  items.forEach(item => {
    const days = daysLeft(item);
    const li = document.createElement('li');
    li.className = `item-card ${urgencyClass(days)}`;
    li.innerHTML = `
      <div class="item-info">
        <span class="item-name">${item.name}</span>
        <span class="item-days">${daysLabel(days)}</span>
      </div>
      <div class="item-actions">
        <button class="btn-reset" data-id="${item.id}">교체함</button>
        <button class="btn-remove" data-id="${item.id}">삭제</button>
      </div>
    `;
    itemList.appendChild(li);
  });
}

function renderPresets() {
  const existing = new Set(loadItems().map(i => i.name));
  presetGrid.innerHTML = '';
  PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'preset-card' + (existing.has(p.name) ? ' added' : '');
    btn.disabled = existing.has(p.name);
    btn.innerHTML = `<span class="preset-name">${p.name}</span><span class="preset-cycle">${p.cycleDays}일마다</span>`;
    btn.addEventListener('click', () => {
      addItem(p.name, p.cycleDays, false);
      scheduleNotifications();
      closePanel();
      render();
    });
    presetGrid.appendChild(btn);
  });
}

// ─── 패널 / 모달 ─────────────────────────────────────────────────────────────

function openPanel() {
  renderPresets();
  addPanel.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePanel() {
  addPanel.hidden = true;
  document.body.style.overflow = '';
  document.getElementById('custom-form').reset();
}

let pendingResetId = null;

function openResetModal(id) {
  const item = loadItems().find(i => i.id === id);
  if (!item) return;
  pendingResetId = id;
  resetMsg.textContent = `"${item.name}"을(를) 오늘 교체했나요?`;
  resetModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeResetModal() {
  resetModal.hidden = true;
  document.body.style.overflow = '';
  pendingResetId = null;
}

// ─── 이벤트 ──────────────────────────────────────────────────────────────────

// pull-to-refresh 방지: 모든 스크롤 컨테이너에서 위로 당기는 제스처 차단
let _touchStartY = 0;
document.addEventListener('touchstart', e => { _touchStartY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchmove', e => {
  if (e.touches[0].clientY - _touchStartY <= 0) return; // 위로 스크롤은 허용

  // 가장 가까운 스크롤 가능한 조상 탐색
  let el = e.target;
  while (el && el !== document.documentElement) {
    const ov = window.getComputedStyle(el).overflowY;
    if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight) {
      if (el.scrollTop <= 0) e.preventDefault(); // 내부 컨테이너 최상단 → 차단
      return;
    }
    el = el.parentElement;
  }

  // 스크롤 컨테이너 없음 → 페이지 최상단이면 차단
  if ((document.scrollingElement?.scrollTop ?? 0) <= 0) e.preventDefault();
}, { passive: false, capture: true });

document.getElementById('fab').addEventListener('click', openPanel);
document.getElementById('close-panel').addEventListener('click', closePanel);

addPanel.addEventListener('click', e => { if (e.target === addPanel) closePanel(); });
resetModal.addEventListener('click', e => { if (e.target === resetModal) closeResetModal(); });

document.getElementById('custom-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('custom-name').value.trim();
  const days = parseInt(document.getElementById('custom-days').value, 10);
  if (!name || !days) return;
  addItem(name, days, true);
  scheduleNotifications();
  closePanel();
  render();
});

itemList.addEventListener('click', e => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (e.target.classList.contains('btn-reset')) openResetModal(id);
  if (e.target.classList.contains('btn-remove')) {
    removeItem(id);
    render();
  }
});

document.getElementById('confirm-reset').addEventListener('click', () => {
  if (pendingResetId) {
    resetItem(pendingResetId);
    scheduleNotifications();
    closeResetModal();
    render();
  }
});

document.getElementById('cancel-reset').addEventListener('click', closeResetModal);

// ─── Service Worker + 알림 ───────────────────────────────────────────────────

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'RESET_ITEM') {
        resetItem(e.data.itemId);
        scheduleNotifications();
        render();
      }
    });
  } catch (err) {
    console.error('SW 등록 실패:', err);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

// setTimeout 기반 로컬 알림 스케줄링 (탭이 열려있는 동안 유효)
const scheduledTimers = [];

async function scheduleNotifications() {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return;

  scheduledTimers.forEach(clearTimeout);
  scheduledTimers.length = 0;

  const items = loadItems();
  const now = Date.now();

  items.forEach(item => {
    const start  = new Date(item.startDate);
    const due    = new Date(start);
    due.setDate(due.getDate() + item.cycleDays);
    const delay  = due.getTime() - now;

    if (delay <= 0) {
      // 이미 지남 - 즉시 알림 (최초 1회만)
      const key = `notified_${item.id}_${item.startDate}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        new Notification(`Cyclo: ${item.name} 교체 시기`, {
          body: `${item.name} 교체일이 지났어요. 교체하셨나요?`,
          tag: item.id,
          data: { itemId: item.id },
        });
      }
    } else {
      const t = setTimeout(() => {
        new Notification(`Cyclo: ${item.name} 교체 시기`, {
          body: `오늘은 ${item.name} 교체일이에요!`,
          tag: item.id,
          data: { itemId: item.id },
        });
      }, delay);
      scheduledTimers.push(t);
    }
  });
}

// ─── 초기화 ──────────────────────────────────────────────────────────────────

registerSW();
scheduleNotifications();
render();
