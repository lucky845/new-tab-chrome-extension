/**
 * 壁纸管理模块
 * 壁纸域唯一业务归属：默认壁纸加载（Bing 免 Key / Pexels 缓存优先）、
 * Pexels 搜索数据层、随机换图、缓存校验。
 * UI 渲染（面板、网格、分页控件）由 app.js 通过回调/直接调用完成。
 */
// 模块常量（static class field 语法不被当前 espree 解析，改用类外赋值）
const WALLPAPERS_PER_PAGE = 18;

// 兜底：第三方今日壁纸接口
const FALLBACK_URL = 'https://www.todaybing.com/api/today';

class WallpaperManager {
    constructor() {
        this.pexelsApiKey = '';
        this.currentQuery = 'Nature';
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalWallpapers = 0;
        this.wallpaperCategories = [
            { name: '自然', query: 'Nature' },
            { name: '城市', query: 'Cityscape' },
            { name: '科技', query: 'Technology' },
            { name: '抽象', query: 'Abstract' },
            { name: '海洋', query: 'Ocean' },
            { name: '森林', query: 'Forest' },
            { name: '山脉', query: 'Mountains' },
            { name: '天空', query: 'Sky' },
            { name: '动物', query: 'Animals' },
            { name: '食物', query: 'Food' },
            { name: '运动', query: 'Sports' },
            { name: '旅行', query: 'Travel' },
        ];

        // UI 回调（由 app.js 注入，manager 不直接持有面板 DOM）
        this.onAuthError = null; // Pexels 401 时触发（提示用户配置密钥）

        this.RANDOM_QUERIES = [
            'Nature',
            'Cityscape',
            'Technology',
            'Abstract',
            'Ocean',
            'Forest',
            'Mountains',
            'Sky',
            'Wallpaper',
        ];
    }

    // 设置API密钥
    setApiKey(apiKey) {
        this.pexelsApiKey = apiKey || '';
    }

    // 从集中 settings 同步密钥（app.js 在 settings 变更后调用）
    async syncApiKey() {
        try {
            const data = await chrome.storage.local.get(['settings']);
            this.pexelsApiKey = (data.settings && data.settings.pexelsApiKey) || '';
        } catch (error) {
            console.error('同步壁纸密钥失败:', error);
        }
        return this.pexelsApiKey;
    }

    get container() {
        return document.getElementById('wallpaper');
    }

    // ---------- 默认壁纸链路 ----------

    /**
     * 主入口：加载并应用壁纸（行为与原 main.js fetchAndSetWallpaper 一致）
     * 优先级：缓存 URL → 仅缓存 ID → 无 Key 走 Bing / 有 Key 走 Pexels 随机
     */
    async fetchAndSetWallpaper() {
        await this.syncApiKey();
        const apiKey = this.pexelsApiKey;

        if (!apiKey) {
            // 未配置 Pexels Key：默认使用 Bing 每日壁纸（无需密钥，开箱即用）
            await this.fetchBingWallpaper(false);
            return;
        }

        // 1. 尝试加载已缓存的壁纸
        const result = await chrome.storage.local.get([
            'savedWallpaperId',
            'savedWallpaperUrl',
            'savedWallpaperData',
        ]);

        if (result.savedWallpaperUrl) {
            // 优先使用缓存的URL，避免网络请求
            this.setWallpaper(result.savedWallpaperUrl);
            console.log('使用缓存的壁纸URL');

            // 异步验证壁纸是否仍然有效（Bing 壁纸的官方 CDN 链接长期有效，无需走 Pexels 验证）
            const isBingWallpaper =
                result.savedWallpaperData && result.savedWallpaperData.source === 'bing';
            if (result.savedWallpaperId && !isBingWallpaper) {
                setTimeout(async () => {
                    const isValid = await this.validateWallpaperById(
                        result.savedWallpaperId,
                        apiKey
                    );
                    if (!isValid) {
                        console.log('缓存的壁纸已失效，获取新壁纸');
                        await this.fetchRandomWallpaper(true);
                    }
                }, 100);
            }
            return;
        }

        // 2. 如果有ID但没有URL，尝试获取URL
        if (result.savedWallpaperId && !result.savedWallpaperUrl) {
            const success = await this.fetchWallpaperById(result.savedWallpaperId, apiKey);
            if (success) {
                return;
            }
        }

        // 3. 如果没有保存的壁纸或加载失败，则获取随机壁纸
        await this.fetchRandomWallpaper(true);
    }

    /**
     * 无 Key 默认路径：Bing 官方接口（随机或每日）
     */
    async fetchBingWallpaper(isRandom = true) {
        try {
            const photo = isRandom
                ? await window.BingWallpaper.fetchRandom()
                : await window.BingWallpaper.fetchDaily();
            if (photo && photo.url) {
                this.setWallpaper(photo.url);
                const bingId = `bing_${photo.startdate || Date.now()}`;
                await chrome.storage.local.set({
                    savedWallpaperId: bingId,
                    savedWallpaperUrl: photo.url,
                    savedWallpaperData: {
                        id: bingId,
                        url: photo.url,
                        photographer: 'Bing Daily Wallpaper',
                        alt: photo.title || photo.copyright || '',
                        source: 'bing',
                    },
                });
                console.log(`已应用 Bing 壁纸: ${photo.title || photo.url}`);
                return;
            }
        } catch (error) {
            console.error('获取 Bing 壁纸失败:', error);
        }
        // 兜底：第三方今日壁纸接口
        this.setWallpaper(`${FALLBACK_URL}?${Date.now()}`);
    }

    // 验证壁纸是否仍然有效
    async validateWallpaperById(id, apiKey) {
        try {
            const response = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
                headers: { Authorization: apiKey },
            });
            return response.ok;
        } catch (error) {
            console.error('验证壁纸时网络错误:', error);
            return false;
        }
    }

    // 仅剩缓存 ID 时的恢复路径
    async fetchWallpaperById(id, apiKey) {
        try {
            const response = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
                headers: { Authorization: apiKey },
            });
            if (!response.ok) {
                console.error(
                    `获取已保存壁纸(ID: ${id})失败，状态: ${response.status}。将移除该ID。`
                );
                await chrome.storage.local.remove([
                    'savedWallpaperId',
                    'savedWallpaperUrl',
                    'savedWallpaperData',
                ]);
                return false;
            }
            const photo = await response.json();
            this.applyPexelsWallpaper(photo, true);
            console.log(`成功加载并缓存壁纸 (ID: ${id})`);
            return true;
        } catch (error) {
            console.error('获取已保存壁纸时网络错误:', error);
            return false;
        }
    }

    /**
     * "换一张"：有 Key 走 Pexels 随机并保存；401 触发 onAuthError 回调
     */
    async fetchRandomWallpaper(shouldSave = false) {
        const apiKey = this.pexelsApiKey;
        const randomQuery =
            this.RANDOM_QUERIES[Math.floor(Math.random() * this.RANDOM_QUERIES.length)];
        const page = Math.floor(Math.random() * 100) + 1;
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(randomQuery)}&orientation=landscape&per_page=1&page=${page}`;

        try {
            const response = await fetch(url, { headers: { Authorization: apiKey } });
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Pexels API 密钥无效或已过期。');
                    if (this.onAuthError) this.onAuthError();
                }
                throw new Error(`Pexels API 请求失败: ${response.status}`);
            }

            const data = await response.json();
            if (data.photos && data.photos.length > 0) {
                this.applyPexelsWallpaper(data.photos[0], shouldSave);
                return;
            }
            throw new Error('Pexels API 未返回照片。');
        } catch (error) {
            console.error('获取 Pexels 壁纸失败:', error);
            this.setWallpaper(`${FALLBACK_URL}?${Date.now()}`);
        }
    }

    // 应用 Pexels 壁纸：设置背景 + 可选写缓存
    async applyPexelsWallpaper(photo, shouldSave) {
        const wallpaperUrl = photo.src.large2x;
        this.setWallpaper(wallpaperUrl);
        if (shouldSave) {
            await this.cacheWallpaper(photo.id, wallpaperUrl, photo.photographer, photo.alt);
            console.log(`获取并已保存新的随机壁纸 (ID: ${photo.id})`);
        }
    }

    // 壁纸缓存写入（统一入口）
    async cacheWallpaper(id, url, photographer, alt) {
        await chrome.storage.local.set({
            savedWallpaperId: id,
            savedWallpaperUrl: url,
            savedWallpaperData: { id, url, photographer, alt },
        });
    }

    // ---------- Pexels 搜索数据层 ----------

    /**
     * Pexels 搜索（仅数据层，渲染由 app.js 完成）
     * 返回 { photos, totalPages, total, unauthorized }
     */
    async searchPhotos(query, page = 1) {
        if (!this.pexelsApiKey) {
            return { photos: [], totalPages: 1, total: 0, unauthorized: true };
        }

        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${WALLPAPERS_PER_PAGE}&page=${page}&orientation=landscape`;
        try {
            const response = await fetch(url, { headers: { Authorization: this.pexelsApiKey } });
            if (!response.ok) {
                if (response.status === 401 && this.onAuthError) this.onAuthError();
                throw new Error('壁纸搜索失败');
            }

            const data = await response.json();
            this.currentQuery = query;
            this.currentPage = page;
            this.totalWallpapers = data.total_results;
            this.totalPages = Math.max(1, Math.ceil(data.total_results / WALLPAPERS_PER_PAGE));

            return {
                photos: data.photos || [],
                totalPages: this.totalPages,
                total: this.totalWallpapers,
                unauthorized: false,
            };
        } catch (error) {
            console.error('搜索壁纸失败:', error);
            return { photos: null, totalPages: 1, total: 0, unauthorized: false };
        }
    }

    // ---------- 通用 ----------

    // 设置壁纸
    setWallpaper(imageUrl) {
        const container = this.container;
        if (container) {
            container.style.backgroundImage = `url('${imageUrl}')`;
        }
    }

    // 获取分类列表
    getCategories() {
        return this.wallpaperCategories;
    }

    // 设置当前分类
    setCurrentCategory(query) {
        this.currentQuery = query;
        this.currentPage = 1;
    }

    // 获取当前状态
    getCurrentState() {
        return {
            query: this.currentQuery,
            page: this.currentPage,
            totalPages: this.totalPages,
            totalWallpapers: this.totalWallpapers,
        };
    }
}

// 导出模块（含常量，供 UI 层分页计算引用）
WallpaperManager.WALLPAPERS_PER_PAGE = WALLPAPERS_PER_PAGE;
WallpaperManager.FALLBACK_URL = FALLBACK_URL;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WallpaperManager;
} else {
    window.WallpaperManager = WallpaperManager;
}
