/**
 * 玻璃边缘折射（SVG 位移贴图）—— 单贴图版
 *
 * 为什么是「单贴图」：第一版按每个元素的宽高圆角各生成一张位移图，冷启动 trace 显示
 * glass-edge.js 的 scan 一次性占用主线程 **116ms**（10 张 128×128 的 SDF 循环 + 10 次
 * canvas.toDataURL 的 PNG 编码），直接把首帧推到 156ms。
 * 现在整站共用一张归一化方图，feImage 用 preserveAspectRatio="none" 拉伸到元素盒：
 * 边缘带会随宽高比略变形，但在 3–5px 的环上肉眼看不出来，而生成成本从 116ms 降到个位数。
 *
 * 仍然只在 Chrome 支持 backdrop-filter: url() 时启用；Safari 会整条声明作废（玻璃消失），
 * 所以能力检测放在最前面，不支持就什么都不做，CSS 那边自动用回亮度环。
 */
(function () {
    'use strict';

    const SEL =
        '.quick-access-item, .add-quick-access-btn, .search-bar, .side-card, .weather-widget';
    const MAP_SIZE = 64; // 64×64 足够表达「边缘带内从强到弱」，生成只要几毫秒
    const SCALE = 11; // 位移像素：与 3px 的断面环同量级，再大会采到远处的颜色

    if (
        typeof CSS === 'undefined' ||
        !CSS.supports ||
        !CSS.supports('backdrop-filter', 'url(#x)')
    ) {
        return;
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-transparency: reduce)').matches) {
        return;
    }

    // 归一化位移图：圆角矩形 SDF 的外法线 × 边缘衰减，编码进 R/G（128 为不动）
    function buildMap() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = MAP_SIZE;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
        const half = MAP_SIZE / 2;
        const radius = MAP_SIZE * 0.14;
        const band = MAP_SIZE * 0.16;
        const sd = (x, y) => {
            const qx = Math.abs(x - half) - half + radius;
            const qy = Math.abs(y - half) - half + radius;
            return (
                Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
                Math.min(Math.max(qx, qy), 0) -
                radius
            );
        };
        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) {
                const depth = Math.max(0, -sd(x + 0.5, y + 0.5));
                const u = Math.min(1, depth / band);
                const mag = Math.pow(1 - u, 1.25);
                const e = 1;
                const nx = sd(x + 0.5 + e, y + 0.5) - sd(x + 0.5 - e, y + 0.5);
                const ny = sd(x + 0.5, y + 0.5 + e) - sd(x + 0.5, y + 0.5 - e);
                const len = Math.hypot(nx, ny) || 1;
                const i = (y * MAP_SIZE + x) * 4;
                img.data[i] = Math.round(128 + (nx / len) * mag * 127);
                img.data[i + 1] = Math.round(128 + (ny / len) * mag * 127);
                img.data[i + 2] = 128;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvas.toDataURL('image/png');
    }

    let filterReady = false;

    function injectFilter() {
        if (filterReady) return;
        filterReady = true;
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        svg.id = 'glass-edge-defs';

        const filter = document.createElementNS(NS, 'filter');
        filter.setAttribute('id', 'glass-edge');
        // 用 objectBoundingBox + 百分比，把同一张方图映射到任意元素盒
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', '100%');
        filter.setAttribute('height', '100%');

        const feImage = document.createElementNS(NS, 'feImage');
        feImage.setAttribute('href', buildMap());
        feImage.setAttribute('x', '0');
        feImage.setAttribute('y', '0');
        feImage.setAttribute('width', '100%');
        feImage.setAttribute('height', '100%');
        feImage.setAttribute('preserveAspectRatio', 'none');
        feImage.setAttribute('result', 'map');

        const disp = document.createElementNS(NS, 'feDisplacementMap');
        disp.setAttribute('in', 'SourceGraphic');
        disp.setAttribute('in2', 'map');
        disp.setAttribute('scale', String(SCALE));
        disp.setAttribute('xChannelSelector', 'R');
        disp.setAttribute('yChannelSelector', 'G');

        filter.appendChild(feImage);
        filter.appendChild(disp);
        svg.appendChild(filter);
        document.body.appendChild(svg);
    }

    function tag(el) {
        // 不要在这里读 getBoundingClientRect：那会为每个元素强制一次同步布局，
        // 十几个元素叠起来就是几十毫秒（trace 里 scan 的耗时大头其实是它）。
        // 尺寸判断交给 CSS —— 太小的元素加了这个类也只是多一圈 3px 描边，没有副作用。
        if (!(el instanceof HTMLElement) || el.classList.contains('has-glass-edge')) return;
        el.classList.add('has-glass-edge');
    }

    function scan() {
        injectFilter();
        document.querySelectorAll(SEL).forEach(tag);
    }

    let scheduled = 0;
    function schedule() {
        if (scheduled) return;
        scheduled = window.setTimeout(() => {
            scheduled = 0;
            // 只在有新元素时扫一次，避免 MutationObserver 自己触发自己
            if (document.querySelector(SEL + ':not(.has-glass-edge)')) scan();
        }, 150);
    }

    // 等「首次内容绘制」之后再干活：load 事件早于 FCP，第一版在 load 里扫描，
    // 结果 60ms 的主线程占用正好卡在首帧前面（trace 里 FCP 156ms 而 load 只有 85ms）。
    function afterFirstPaint(cb) {
        if (typeof PerformanceObserver === 'undefined') {
            setTimeout(cb, 300);
            return;
        }
        let fired = false;
        const run = () => {
            if (fired) return;
            fired = true;
            observer.disconnect();
            cb();
        };
        const observer = new PerformanceObserver(list => {
            if (list.getEntries().some(e => e.name === 'first-contentful-paint')) run();
        });
        try {
            observer.observe({ type: 'paint', buffered: true });
        } catch {
            run();
            return;
        }
        setTimeout(run, 800); // 兜底：极端情况下 paint 事件没来也不能一直不装
    }

    function start() {
        afterFirstPaint(() => {
            if (window.requestIdleCallback)
                window.requestIdleCallback(() => scan(), { timeout: 1000 });
            else setTimeout(() => scan(), 120);
        });

        const mo = new MutationObserver(schedule);
        mo.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', schedule, { passive: true });
        window.GlassEdge = { refresh: schedule };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
