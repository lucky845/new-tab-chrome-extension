/**
 * 轻量 Toast 通知组件
 * 替代 alert() 的非阻塞提示，挂在 window.showToast(message, type)
 * type: 'info'（默认） | 'success' | 'error'
 */
(function () {
    'use strict';

    const CONTAINER_ID = 'dsh-toast-container';

    function ensureContainer() {
        let container = document.getElementById(CONTAINER_ID);
        if (!container) {
            container = document.createElement('div');
            container.id = CONTAINER_ID;
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = 'info', duration = 2600) {
        const container = ensureContainer();
        const toast = document.createElement('div');
        toast.className = `dsh-toast dsh-toast--${type}`;
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        container.appendChild(toast);

        // 入场动画
        requestAnimationFrame(() => toast.classList.add('dsh-toast--visible'));

        // 自动退场
        setTimeout(() => {
            toast.classList.remove('dsh-toast--visible');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
            // 兜底移除（transitionend 可能不触发）
            setTimeout(() => toast.remove(), 600);
        }, duration);
    }

    window.showToast = showToast;
})();
