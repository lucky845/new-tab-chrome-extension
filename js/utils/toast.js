/**
 * Toast 通知（兼容层）
 * --------------------------------------------------------------------
 * 历史：这里曾自带一套 .dsh-toast 的独立样式（缺 warning 类型，视觉与整页玻璃语言不一致）。
 * 现在统一由 dsh-tip.js 的浮层形态承载，本文件只保留旧的调用签名：
 *     window.showToast(message, type, duration)
 * type: 'info'（默认） | 'success' | 'warning' | 'error'
 *
 * 之所以做成转发层而不是删掉重写调用点：app.js 里有 30+ 处 showToast(...)，
 * 统一外观的收益应该在组件层拿到，而不是去改 30 个业务点引入风险。
 */
(function () {
    'use strict';

    const FALLBACK_DURATION = 2600;

    function showToast(message, type = 'info', duration) {
        // dsh-tip.js 未加载时不静默吞掉提示：退回到最朴素的 console 提示，便于排查
        if (!window.dshTip) {
            console.warn('[toast] dshTip 未加载，提示丢失:', message);
            return null;
        }
        const known = ['success', 'warning', 'error', 'info', 'loading'].includes(type);
        // 与底层 Tip 保持同一口径：undefined/null 才用默认值，显式 0 表示常驻，不能被吞掉
        const effective = duration == null ? FALLBACK_DURATION : duration;
        return window.dshTip.toast(message, known ? type : 'info', effective);
    }

    window.showToast = showToast;
})();
