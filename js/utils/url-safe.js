/**
 * 链接安全工具
 *
 * 为什么需要这个：快捷方式、自定义搜索引擎、备份导入的数据里都可能带任意协议的地址。
 * 这些值最终会进 <a href>、window.open()、background-image，只要其中一个协议是
 * javascript: / data: / file:，就从「一个链接」变成注入面。MV3 的 CSP 会挡下大部分，
 * 但把安全押在浏览器兜底上不值得——新标签页扩展要打开的东西本来就是网页，只放行 http(s)。
 *
 * 另外统一 open()：默认带 noopener/noreferrer，避免被打开的站点通过 window.opener 反向操纵本页。
 */
(function () {
    'use strict';

    const SAFE_PROTOCOLS = ['http:', 'https:'];

    function parse(url) {
        if (typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (!trimmed) return null;
        try {
            return new URL(trimmed);
        } catch {
            return null;
        }
    }

    // 能否安全地当作网页地址使用
    function isHttp(url) {
        const parsed = parse(url);
        return !!parsed && SAFE_PROTOCOLS.indexOf(parsed.protocol) !== -1;
    }

    // 能否安全地当作壁纸图片来源：http(s) 网络图、内联 data:image、或扩展内相对路径
    function isImageSource(url) {
        if (typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed) return false;
        if (/^data:image\//i.test(trimmed)) return true;
        if (/^[\w./-]+\.(jpe?g|png|webp|gif|avif|svg)$/i.test(trimmed)) return true;
        return isHttp(trimmed);
    }

    // 用于 <a href>：不安全的地址退化成不可跳转的占位
    function href(url) {
        return isHttp(url) ? url.trim() : '#';
    }

    // 新标签页打开；不安全地址直接拒绝，返回 false 让调用方决定要不要提示
    function open(url) {
        if (!isHttp(url)) return false;
        window.open(url.trim(), '_blank', 'noopener,noreferrer');
        return true;
    }

    window.UrlSafe = {
        isHttp: isHttp,
        isImageSource: isImageSource,
        href: href,
        open: open,
    };
})();
