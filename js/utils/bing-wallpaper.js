/**
 * Bing 官方壁纸接口封装
 * 使用 Bing 每日壁纸存档接口（HPImageArchive），无需任何 API Key。
 * 接口：https://www.bing.com/HPImageArchive.aspx?format=js&idx={0-7}&n={1-8}&mkt={market}
 * - idx：距今天的天数偏移（0=今天，7=8天前）
 * - n：返回图片数量（最大 8）
 * - mkt：市场（zh-CN / en-US / ja-JP 等，不同市场每日图可能不同）
 * 返回的 url 为相对路径，需拼接 https://www.bing.com 前缀。
 */
(function () {
    'use strict';

    const BING_BASE = 'https://www.bing.com';
    const API_ENDPOINT = 'https://www.bing.com/HPImageArchive.aspx';

    // 常用市场列表：用于随机换壁纸时增加多样性
    const MARKETS = [
        'zh-CN',
        'en-US',
        'ja-JP',
        'en-GB',
        'de-DE',
        'fr-FR',
        'en-CA',
        'en-AU',
        'it-IT',
        'es-ES',
    ];

    /**
     * 拉取 Bing 壁纸列表
     * @param {number} idx 天数偏移 0-7
     * @param {number} count 数量 1-8
     * @param {string} mkt 市场，默认 zh-CN
     * @returns {Promise<Array<{url, title, copyright, startdate}>>} 图片列表（url 为完整地址）
     */
    async function fetchList(idx = 0, count = 1, mkt = 'zh-CN') {
        const url = `${API_ENDPOINT}?format=js&idx=${idx}&n=${count}&mkt=${encodeURIComponent(mkt)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Bing 壁纸接口请求失败: HTTP ${response.status}`);
        }
        const data = await response.json();
        const images = (data && data.images) || [];
        return images
            .filter(img => img && img.url)
            .map(img => ({
                url: img.url.startsWith('http') ? img.url : `${BING_BASE}${img.url}`,
                title: img.title || '',
                copyright: img.copyright || '',
                startdate: img.startdate || '',
            }));
    }

    /**
     * 获取今日壁纸（中国市场）
     * @returns {Promise<{url, title, copyright}|null>} 失败返回 null
     */
    async function fetchDaily() {
        try {
            const list = await fetchList(0, 1, 'zh-CN');
            return list[0] || null;
        } catch (error) {
            console.error('获取 Bing 每日壁纸失败:', error);
            return null;
        }
    }

    /**
     * 随机获取一张 Bing 壁纸（随机天数偏移 + 随机市场，保证多样性）
     * @returns {Promise<{url, title, copyright}|null>} 失败返回 null
     */
    async function fetchRandom() {
        // 三次尝试：idx 0-7 随机 × 随机市场，避免个别市场当天数据缺失
        for (let attempt = 0; attempt < 3; attempt++) {
            const idx = Math.floor(Math.random() * 8);
            const mkt = MARKETS[Math.floor(Math.random() * MARKETS.length)];
            try {
                const list = await fetchList(idx, 1, mkt);
                if (list[0]) {
                    return list[0];
                }
            } catch (error) {
                console.warn(
                    `Bing 壁纸第 ${attempt + 1} 次尝试失败 (idx=${idx}, mkt=${mkt}):`,
                    error
                );
            }
        }
        return null;
    }

    // 导出为全局（与 weather-config.js 的 window 全局风格一致）
    window.BingWallpaper = { fetchList, fetchDaily, fetchRandom, MARKETS };
})();
