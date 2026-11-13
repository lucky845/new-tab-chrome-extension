/**
 * 首屏主题预置（防白闪）
 *
 * 为什么单独成文件而不写成内联 <script>：
 * manifest 的 CSP 是 script-src 'self'（无 'unsafe-inline'），内联脚本会被拦截，
 * 拦截后本段逻辑不执行 → 首帧先按默认深色绘制，再被 theme-manager 翻成浅色，出现白闪。
 *
 * 引入位置：newtab.html 的 <head> 内、style.css 之前。
 * 本文件依赖 theme-manager.js 已先加载（提供 ThemeManager.applyStoredSync）。
 */
(function () {
    if (!window.ThemeManager || typeof window.ThemeManager.applyStoredSync !== 'function') {
        // 兜底：极端情况下模块未就绪，至少不要留在无 data-theme 的状态
        var prefersLight = false;
        try {
            prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        } catch {
            prefersLight = false;
        }
        document.documentElement.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme-mode', 'auto');
        return;
    }
    window.ThemeManager.applyStoredSync();
})();
