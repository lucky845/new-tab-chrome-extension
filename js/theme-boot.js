/**
 * 首屏预置：主题 + 时钟（防白闪 / 防占位符闪）
 *
 * 为什么单独成文件而不写成内联 <script>：
 * manifest 的 CSP 是 script-src 'self'（无 'unsafe-inline'），内联脚本会被拦截，
 * 拦截后本段逻辑不执行 → 首帧先按默认深色绘制，再被 theme-manager 翻成浅色，出现白闪。
 *
 * 引入位置：newtab.html 的 <head> 内、style.css 之前。
 * 本文件依赖 theme-manager.js 已先加载（提供 ThemeManager.applyStoredSync）。
 *
 * 为什么顺带填时钟：
 * 时钟本来是 "--:--" 占位，要等 app.init()（跨进程读 storage）完成后才被 startClock()
 * 写成真实时间。这段空窗里用户看到的就是一屏「--:--」+ 空方格，体感就是白屏。
 * 时钟内容完全由本地时间算出、不需要任何 IO —— 放在这里填掉，
 * 首帧就是正确时间，后面的 startClock() 只是接管秒级刷新，画面不再跳变。
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
    } else {
        window.ThemeManager.applyStoredSync();
    }

    // 时钟预填：与 app.js 的 startClock() 保持同一格式（HH:MM，24 小时制）
    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }
    function paintClock() {
        var now = new Date();
        var timeEl = document.getElementById('clock-time');
        if (timeEl) timeEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
        var dateEl = document.getElementById('clock-date');
        if (dateEl && !dateEl.textContent) {
            var week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            dateEl.textContent =
                now.getFullYear() +
                '年' +
                (now.getMonth() + 1) +
                '月' +
                now.getDate() +
                '日 ' +
                week[now.getDay()];
        }
    }
    // 本脚本在 <head> 里执行，此时 #clock-time 还没被解析出来（body 在脚本之后）。
    // 用 MutationObserver 监听「节点刚被创建」的那一刻立刻填值 ——
    // 这是唯一能抢在首帧绘制之前生效的时机（DOMContentLoaded 已经在首次绘制之后了）。
    paintClock();
    if (!document.getElementById('clock-time') && typeof MutationObserver === 'function') {
        const obs = new MutationObserver(() => {
            if (document.getElementById('clock-time')) {
                paintClock();
                obs.disconnect();
            }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    }
    document.addEventListener('DOMContentLoaded', paintClock, { once: true });
})();
