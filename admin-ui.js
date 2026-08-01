// admin-ui.js (يُحمَّل في admin.html فقط)

if (localStorage.getItem('theme') === 'dark') { document.documentElement.classList.add('dark'); }
else { document.documentElement.classList.remove('dark'); }

document.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = document.documentElement.classList.contains('dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
});

function toggleTheme() {
    const html = document.documentElement, icon = document.getElementById('theme-icon');
    if (html.classList.contains('dark')) { html.classList.remove('dark'); if (icon) icon.className = 'fa-solid fa-moon'; localStorage.setItem('theme', 'light'); }
    else { html.classList.add('dark'); if (icon) icon.className = 'fa-solid fa-sun'; localStorage.setItem('theme', 'dark'); }
}

function showToast(text, type = 'info') {
    const container = document.getElementById('toast-container'); if (!container) return;
    const t = document.createElement('div');
    let bg = 'bg-stone-900 text-white', icon = 'fa-solid fa-circle-info';
    if (type === 'success') { bg = 'bg-emerald-600 text-white'; icon = 'fa-solid fa-circle-check'; }
    else if (type === 'error') { bg = 'bg-red-600 text-white'; icon = 'fa-solid fa-circle-xmark'; }
    else if (type === 'warning') { bg = 'bg-amber-500 text-black'; icon = 'fa-solid fa-triangle-exclamation'; }
    t.className = `${bg} p-4 rounded-2xl flex items-center gap-3 shadow-xl transform translate-y-2 opacity-0 transition-all duration-300 border border-white/10 text-xs font-bold`;
    t.innerHTML = `<i class="${icon} text-base shrink-0"></i> <span>${text}</span>`;
    container.appendChild(t);
    setTimeout(() => t.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => { t.classList.add('translate-y-2', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 4000);
}

let confirmActionCallback = null;
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('confirm-modal').classList.remove('hidden');
    confirmActionCallback = onConfirm;
}

function switchAdminTab(tab) {
    ['products', 'offers', 'media', 'settings', 'channels', 'chat', 'backup'].forEach(t => {
        const el = document.getElementById(`admin-tab-${t}`); if (el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) btn.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-stone-100 text-stone-600 dark:bg-dark-800 dark:text-stone-400 hover:bg-stone-200 transition-all';
    });
    const targetEl = document.getElementById(`admin-tab-${tab}`); if (targetEl) targetEl.classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-btn-${tab}`);
    if (activeBtn) activeBtn.className = 'px-4 py-2 text-xs font-black rounded-lg bg-primary-500 text-white shadow-md transition-all';
    if (tab === 'chat' && window.loadAdminChatList) window.loadAdminChatList();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirm-cancel-btn')?.addEventListener('click', () => { document.getElementById('confirm-modal').classList.add('hidden'); confirmActionCallback = null; });
    document.getElementById('confirm-ok-btn')?.addEventListener('click', () => { document.getElementById('confirm-modal').classList.add('hidden'); if (confirmActionCallback) { confirmActionCallback(); confirmActionCallback = null; } });
});

window.toggleTheme = toggleTheme;
window.showToast = showToast;
window.showConfirmModal = showConfirmModal;
window.switchAdminTab = switchAdminTab;
