/**
 * 壁纸管理模块
 * 负责壁纸的加载、搜索、分类管理
 */
class WallpaperManager {
    constructor() {
        this.currentQuery = 'Nature';
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalWallpapers = 0;
        this.pexelsApiKey = '';
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
            { name: '运动', query: 'Sports' }
        ];
        this.lastActiveCategoryQuery = 'Nature';
        this.activeCategoryElement = null;
    }

    // 设置API密钥
    setApiKey(apiKey) {
        this.pexelsApiKey = apiKey;
    }

    // 加载默认壁纸
    async loadDefaultWallpaper() {
        try {
            const wallpaperContainer = document.getElementById('wallpaper');
            if (wallpaperContainer) {
                wallpaperContainer.style.backgroundImage = `url('https://www.todaybing.com/api/today?${new Date().getTime()}')`;
            }
        } catch (error) {
            console.error('加载默认壁纸失败:', error);
        }
    }

    // 搜索壁纸
    async searchWallpapers(query, page = 1) {
        if (!this.pexelsApiKey) {
            console.warn('Pexels API密钥未设置');
            return { wallpapers: [], total: 0 };
        }

        try {
            const response = await fetch(
                `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=18`,
                {
                    headers: {
                        'Authorization': this.pexelsApiKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.totalWallpapers = data.total_results;
            this.totalPages = Math.ceil(this.totalWallpapers / 18);
            this.currentPage = page;
            this.currentQuery = query;

            return {
                wallpapers: data.photos || [],
                total: this.totalWallpapers,
                totalPages: this.totalPages
            };
        } catch (error) {
            console.error('搜索壁纸失败:', error);
            return { wallpapers: [], total: 0 };
        }
    }

    // 设置壁纸
    setWallpaper(imageUrl) {
        const wallpaperContainer = document.getElementById('wallpaper');
        if (wallpaperContainer) {
            wallpaperContainer.style.backgroundImage = `url('${imageUrl}')`;
        }
    }

    // 获取分类列表
    getCategories() {
        return this.wallpaperCategories;
    }

    // 设置当前分类
    setCurrentCategory(query) {
        this.currentQuery = query;
        this.lastActiveCategoryQuery = query;
        this.currentPage = 1;
    }

    // 获取当前状态
    getCurrentState() {
        return {
            query: this.currentQuery,
            page: this.currentPage,
            totalPages: this.totalPages,
            totalWallpapers: this.totalWallpapers
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WallpaperManager;
} else {
    window.WallpaperManager = WallpaperManager;
}
