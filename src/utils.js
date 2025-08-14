// ============ 工具函数（模块） ============
export function $(selector) { return document.querySelector(selector); }
export function $all(selector) { return document.querySelectorAll(selector); }

export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 12px 16px;
    border-radius: 8px; color: #fff; font-weight: 600; z-index: 10000;
    transform: translateX(120%); transition: transform .25s ease; max-width: 320px;
    box-shadow: 0 6px 22px rgba(0,0,0,.2);
  `;
  notification.style.background = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#6366f1');
  document.body.appendChild(notification);
  requestAnimationFrame(() => notification.style.transform = 'translateX(0)');
  setTimeout(() => {
    notification.style.transform = 'translateX(120%)';
    setTimeout(() => notification.remove(), 250);
  }, 2600);
}

export function safeJsonParse(text) {
  try { return [JSON.parse(text), null]; } catch (e) { return [null, e]; }
}


