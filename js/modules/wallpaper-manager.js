/**
 * 壁纸管理模块
 * 壁纸域唯一业务归属：默认壁纸加载（Picsum 免 Key / Pexels 可选增强）、
 * 双源搜索数据层、随机换图、缓存校验。
 * UI 渲染（面板、网格、分页控件）由 app.js 通过回调/直接调用完成。
 */
// 模块常量（static class field 语法不被当前 espree 解析，改用类外赋值）
const WALLPAPERS_PER_PAGE = 18;

class WallpaperManager {
    constructor() {
        this.pexelsApiKey = '';
        this.currentQuery = 'Nature';
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalWallpapers = 0;
        this.wallpaperSource = 'picsum'; // 壁纸图源：picsum | wallhaven（由 settings 同步）
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
    // fetchAndSetWallpaper 每次刷新/新建都会走一遍，而 settings 在一次会话里
    // 不会自己变 —— 加 30s TTL，避免每次调用都多一次 storage 往返（真实扩展里
    // 每次 IPC 约 2-5ms，加上序列化并不白给）。force=true 可强制重读。
    async syncApiKey(force = false) {
        const now = Date.now();
        if (!force && this._apiKeySyncedAt && now - this._apiKeySyncedAt < 30000) {
            return this.pexelsApiKey;
        }
        try {
            const data = await chrome.storage.local.get(['settings']);
            this.pexelsApiKey = (data.settings && data.settings.pexelsApiKey) || '';
            this.wallpaperSource =
                data.settings && data.settings.wallpaperSource === 'wallhaven'
                    ? 'wallhaven'
                    : 'picsum';
        } catch (error) {
            console.error('同步壁纸密钥失败:', error);
        }
        this._apiKeySyncedAt = Date.now();
        return this.pexelsApiKey;
    }

    get container() {
        return document.getElementById('wallpaper');
    }

    // ---------- 默认壁纸链路 ----------

    /**
     * 主入口：加载并应用壁纸
     * 优先级：缓存 URL → 仅缓存 ID（Pexels 来源）→ Picsum/Pexels 随机
     */
    async fetchAndSetWallpaper() {
        await this.syncApiKey();

        // 1. 尝试加载已缓存的壁纸
        const result = await chrome.storage.local.get([
            'savedWallpaperId',
            'savedWallpaperUrl',
            'savedWallpaperData',
            'savedWallpaperBlob',
            'savedWallpaperBlobUrl',
        ]);

        // 1a. 有本地烤好的 dataURL → 零网络请求直接出图（最快路径）
        //     校验 savedWallpaperBlobUrl 与当前壁纸 URL 一致：不一致说明缓存是
        //     上一张的（比如用户在别处换了壁纸但没走 setWallpaper），宁可用 URL。
        if (
            result.savedWallpaperBlob &&
            result.savedWallpaperBlobUrl === result.savedWallpaperUrl
        ) {
            this.setWallpaper(result.savedWallpaperBlob);
            console.log('[壁纸] 命中本地缓存，零请求');
            return;
        }

        if (result.savedWallpaperUrl) {
            // 优先使用缓存的URL，避免网络请求
            this.setWallpaper(result.savedWallpaperUrl);
            console.log('使用缓存的壁纸URL');

            // 异步验证：Picsum 图床链接长期有效无需验证；Pexels 来源的缓存需验证 ID 有效性
            const savedId = String(result.savedWallpaperId || '');
            const isPexelsWallpaper =
                savedId.length > 0 && !savedId.startsWith('pic_') && !savedId.startsWith('wh_');
            if (isPexelsWallpaper && this.pexelsApiKey) {
                setTimeout(async () => {
                    const isValid = await this.validateWallpaperById(
                        result.savedWallpaperId,
                        this.pexelsApiKey
                    );
                    if (!isValid) {
                        console.log('缓存的壁纸已失效，获取新壁纸');
                        await this.fetchRandomWallpaper(true);
                    }
                }, 100);
            }
            return;
        }

        // 2. 如果有 Pexels ID 但没有 URL，尝试按 ID 恢复
        const savedId = String(result.savedWallpaperId || '');
        if (result.savedWallpaperId && !result.savedWallpaperUrl) {
            if (savedId.startsWith('pic_')) {
                // Picsum 记录异常（无 URL）：清掉重来
                await chrome.storage.local.remove([
                    'savedWallpaperId',
                    'savedWallpaperUrl',
                    'savedWallpaperData',
                ]);
            } else if (this.pexelsApiKey) {
                const success = await this.fetchWallpaperById(
                    result.savedWallpaperId,
                    this.pexelsApiKey
                );
                if (success) {
                    return;
                }
            }
        }

        // 3. 没有保存的壁纸或恢复失败：随机壁纸（有 Key 走 Pexels，无 Key 走 Picsum）
        await this.fetchRandomWallpaper(true);
    }

    // 验证 Pexels 壁纸是否仍然有效
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

    // 仅剩 Pexels 缓存 ID 时的恢复路径
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
     * "换一张"：有 Key 走 Pexels 随机；无 Key 走 Picsum 随机（免密钥）。
     * 失败时回落另一源，全部失败则保留当前壁纸。
     */
    async fetchRandomWallpaper(shouldSave = false) {
        const randomQuery =
            this.RANDOM_QUERIES[Math.floor(Math.random() * this.RANDOM_QUERIES.length)];

        if (this.pexelsApiKey) {
            const page = Math.floor(Math.random() * 100) + 1;
            const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(randomQuery)}&orientation=landscape&per_page=1&page=${page}`;
            try {
                const response = await fetch(url, {
                    headers: { Authorization: this.pexelsApiKey },
                });
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
            } catch (error) {
                console.error('Pexels 随机壁纸失败，回落 Picsum:', error.message);
            }
        }

        // Wallhaven 图源（可选）随机
        if (this.wallpaperSource === 'wallhaven') {
            const result = await this.searchWallhaven(
                randomQuery,
                Math.floor(Math.random() * 20) + 1
            );
            if (result.photos && result.photos.length > 0) {
                const photo = result.photos[Math.floor(Math.random() * result.photos.length)];
                this.applyPexelsWallpaper(photo, shouldSave);
                console.log(`已应用 Wallhaven 随机壁纸 (ID: ${photo.id})`);
                return;
            }
            console.warn('Wallhaven 随机失败，回落 Picsum:', result.error || '无结果');
        }

        // Picsum 随机（默认 / 回落）
        try {
            const randomSeed = Math.floor(Math.random() * 1e9);
            const part1 = Math.floor(Math.random() * 1084);
            const part2 = Math.floor(Math.random() * 1084);
            let wallpaperUrl = `https://picsum.photos/seed/${randomSeed}/1920/1080`;
            // 这里原本有一次 HEAD 探测（id/${part1}/1200/675，8s 超时），
            // 目的是拿更"稳定"的 id URL，但它排在设背景之前 —— 图床不可达时
            // 用户要干等 8 秒才看到壁纸开始加载。实测 seed URL 与 id URL
            // 可用性一样（都是同一个图床），探测纯属负收益，直接删掉。
            void part1;
            void part2;
            this.setWallpaper(wallpaperUrl);
            if (shouldSave) {
                await this.cacheWallpaper(
                    `pic_random_${randomSeed}`,
                    wallpaperUrl,
                    'Picsum',
                    '随机精选摄影'
                );
            }
            console.log(`已应用 Picsum 随机壁纸: ${wallpaperUrl}`);
        } catch (error) {
            console.error('随机壁纸获取失败，保留当前壁纸:', error.message);
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
     * 壁纸搜索（仅数据层，渲染由 app.js 完成）
     * 双源：有 Pexels Key 走 Pexels；无 Key 按设置走 Picsum（默认）或 Wallhaven（可选）。
     * 返回 { photos, totalPages, total, unauthorized, source }
     */
    async searchPhotos(query, page = 1) {
        if (!this.pexelsApiKey) {
            const q = (query || '').trim();

            // Picsum 是无关键词能力的精选图库（实测 ?q= 被服务端忽略，带不带返回同一批图）。
            // 早先实现把分类词哈希成页码，让「海洋」落到图库某一页——那页和图无关，
            // 用户看到的就是「筛选内容与分类不匹配」。现在按下述优先级处理：
            //   1) 有分类/搜索词 → 改走 Wallhaven（真支持 q= 关键词检索）
            //   2) Wallhaven 不可达 → 回落 Picsum 浏览，但标记 categorySupported=false，
            //      由 UI 如实告知「当前图源不支持按分类筛选」，绝不假装筛过
            if (q && this.wallpaperSource === 'picsum') {
                const wallhaven = await this.searchWallhaven(q, page);
                if (wallhaven.photos && wallhaven.photos.length > 0) {
                    this.categorySupported = true;
                    return wallhaven;
                }
                const browsing = await this.searchPicsum(page);
                return { ...browsing, categorySupported: false, requestedCategory: q };
            }

            // 走到这里说明要么没分类词（纯浏览），要么图源已是 wallhaven
            const result =
                this.wallpaperSource === 'wallhaven'
                    ? await this.searchWallhaven(query, page)
                    : await this.searchPicsum(page);
            this.categorySupported = this.wallpaperSource === 'wallhaven' || !q;
            if (!q && this.wallpaperSource !== 'wallhaven') {
                result.source = 'picsum';
            }
            return { ...result, categorySupported: this.categorySupported };
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
                source: 'pexels',
            };
        } catch (error) {
            console.error('搜索壁纸失败:', error);
            return { photos: null, totalPages: 1, total: 0, unauthorized: false, source: 'pexels' };
        }
    }

    /**
     * Picsum Photos 免 Key 图库浏览（https://picsum.photos，Unsplash 精选图，国内直连可达）
     * 说明：Picsum 是纯图库，**不提供关键词/分类检索**（实测 ?q=ocean 与不带 q 返回同一批图）。
     * 因此这里只做「按页码浏览」，不接受分类词——分类筛选由 searchPhotos 改走 Wallhaven 完成。
     * 早先实现把分类词哈希成页码，导致点「海洋」看到的其实是图库第 N 页的无关图片，已废弃。
     * 结果映射为 Pexels 同构格式，渲染层零感知。
     */
    async searchPicsum(page = 1) {
        const PICSUM_TOTAL_PAGES = 60; // 图库约 1080 张，每页 18 张
        const realPage = ((page - 1) % PICSUM_TOTAL_PAGES) + 1;

        try {
            const response = await fetch(
                `https://picsum.photos/v2/list?page=${realPage}&limit=${WALLPAPERS_PER_PAGE}`,
                { signal: AbortSignal.timeout(12000) }
            );
            if (!response.ok) {
                throw new Error(`Picsum 请求失败（${response.status}）`);
            }

            const list = await response.json();
            if (!Array.isArray(list) || list.length === 0) {
                throw new Error('Picsum 返回空列表');
            }

            this.currentPage = page;
            this.totalWallpapers = PICSUM_TOTAL_PAGES * WALLPAPERS_PER_PAGE;
            this.totalPages = PICSUM_TOTAL_PAGES;

            const photos = list.map(item => {
                const id = String(item.id);
                return {
                    id: `pic_${id}`,
                    src: {
                        // 渲染层网格用 medium 作缩略图，应用壁纸用 large2x/original
                        original: `https://picsum.photos/id/${id}/1920/1080`,
                        large2x: `https://picsum.photos/id/${id}/1920/1080`,
                        large: `https://picsum.photos/id/${id}/1280/720`,
                        medium: `https://picsum.photos/id/${id}/640/360`,
                        small: `https://picsum.photos/id/${id}/320/180`,
                        landscape: `https://picsum.photos/id/${id}/1920/1080`,
                        tiny: `https://picsum.photos/id/${id}/160/90`,
                    },
                    photographer: item.author || 'Picsum',
                    alt: `${item.author || 'Picsum'} 摄影作品`,
                    avg_color: '#4EC2C6',
                    width: 1920,
                    height: 1080,
                };
            });

            return {
                photos,
                totalPages: this.totalPages,
                total: this.totalWallpapers,
                unauthorized: false,
                source: 'picsum',
            };
        } catch (error) {
            console.error('Picsum 图库加载失败:', error);
            return {
                photos: null,
                totalPages: 1,
                total: 0,
                unauthorized: false,
                source: 'picsum',
                error: error?.message || '图库加载失败',
            };
        }
    }

    /**
     * Wallhaven 免 Key 搜索（可选图源，https://wallhaven.cc/api/v1）
     * 支持关键词搜索；需能访问境外网络（wallhaven.cc 国内直连不稳定）。
     * 仅 general 分类 + SFW（purity=100），横屏 1920x1080 起。结果映射为 Pexels 同构格式。
     */
    async searchWallhaven(query, page = 1) {
        const q = (query || '').trim();
        const params = new URLSearchParams({
            categories: '100',
            purity: '100',
            atleast: '1920x1080',
            per_page: String(WALLPAPERS_PER_PAGE),
            page: String(page),
        });
        if (q) {
            params.set('q', q);
            params.set('sorting', 'relevance');
        } else {
            params.set('sorting', 'toplist');
            params.set('topRange', '1M');
        }

        try {
            const response = await fetch(`https://wallhaven.cc/api/v1/search?${params}`, {
                signal: AbortSignal.timeout(12000),
            });
            if (response.status === 429) {
                throw new Error('Wallhaven 请求太频繁，请稍后再试');
            }
            if (!response.ok) {
                throw new Error(`Wallhaven 请求失败（${response.status}）`);
            }

            const data = await response.json();
            this.currentQuery = q || this.currentQuery;
            this.currentPage = page;
            this.totalWallpapers = data.meta?.total ?? data.data.length;
            this.totalPages = Math.max(1, data.meta?.last_page ?? 1);

            const photos = (data.data || []).map(item => ({
                id: `wh_${item.id}`,
                src: {
                    original: item.path,
                    large2x: item.path,
                    large: item.thumbs?.original || item.path,
                    medium: item.thumbs?.large || item.path,
                    small: item.thumbs?.small || item.path,
                    landscape: item.path,
                    tiny: item.thumbs?.small || item.path,
                },
                photographer: 'Wallhaven',
                alt: `Wallhaven ${item.resolution || ''} 壁纸`.trim(),
                avg_color: (item.colors && item.colors[0]) || '#4EC2C6',
                width: item.dimension_x,
                height: item.dimension_y,
            }));

            return {
                photos,
                totalPages: this.totalPages,
                total: this.totalWallpapers,
                unauthorized: false,
                source: 'wallhaven',
            };
        } catch (error) {
            console.error('Wallhaven 搜索失败:', error);
            return {
                photos: null,
                totalPages: 1,
                total: 0,
                unauthorized: false,
                source: 'wallhaven',
                error: 'Wallhaven 不可访问。该图源需要能访问境外网络，可在设置中切回 Picsum。',
            };
        }
    }

    // ---------- 通用 ----------

    // 设置壁纸
    setWallpaper(imageUrl) {
        const container = this.container;
        if (!container) return;
        // 壁纸地址可能来自备份导入：只接受 http(s) / data:image / 扩展内相对路径，
        // 否则不给 background-image 赋值（非法协议会变成远程探测或注入面）
        if (window.UrlSafe && !window.UrlSafe.isImageSource(imageUrl)) {
            console.warn('[壁纸] 地址协议不受支持，已忽略:', imageUrl);
            return;
        }
        container.style.backgroundImage = `url('${imageUrl}')`;
        // 液态玻璃光学层要采样壁纸做折射，换壁纸时同步刷新场景纹理
        if (this.liquidGlass && imageUrl) this.liquidGlass.setScene(imageUrl);

        // 壁纸是否真的解码出来了 —— background-image 赋了值不代表图下载成功。
        // 预热一次并记录，UI 可据此提示"壁纸加载失败"，而不是让用户对着
        // 一片 --canvas-loading 渐变猜。不阻塞调用方。
        this._trackImageLoad(imageUrl);
    }

    /**
     * 预热并追踪壁纸是否加载成功。
     * 用 Image 走浏览器缓存：这里成功的话，background-image 那边命中缓存直接出图，
     * 不会产生第二次网络请求。
     *
     * 加载成功后顺带把这张图烤成 dataURL 存进 storage（见 _storeWallpaperBlob）——
     * 用户切壁纸的那一刻就是唯一一次真正需要下载的时刻，之后每次刷新/新建标签页
     * 都直接读本地数据，零网络请求。图床连不上（picsum 在国内就是常态）时
     * 也不再是一片渐变兜底。
     */
    _trackImageLoad(imageUrl) {
        if (!imageUrl || typeof Image === 'undefined') return;
        // dataURL 已经在本地了，没必要再转存一遍
        if (imageUrl.startsWith('data:')) {
            this.lastImageState = 'ok';
            return;
        }
        const img = new Image();
        img.decoding = 'async';
        // 图床跨域，不设 crossOrigin 时 canvas 读像素会被污染（toDataURL 抛 SecurityError）
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.lastImageState = 'ok';
            // 烤缓存不再依赖这张 img（canvas 方案会被 302 跨域污染烧出噪点），
            // 单独开 fetch 拿原始字节。img 仍要加载，因为它预热了浏览器 HTTP 缓存。
            this._storeWallpaperBlob(imageUrl);
        };
        img.onerror = () => {
            this.lastImageState = 'error';
            console.warn('[壁纸] 图片加载失败:', imageUrl);
        };
        img.src = imageUrl;
    }

    /**
     * 把已加载的壁纸转成 dataURL 存入 storage.local，供下次直接使用。
     *
     * 为什么用 dataURL 而不是原 URL：storage.local 只存 JSON 值，存不了 Blob；
     * dataURL 是字符串，读出来直接能赋给 background-image，不需要再走网络，
     * 也不需要 blob: 协议（manifest 的 img-src 里没有 blob:）。
     *
     * 体积：base64 比原图大约 1.33 倍。storage.local 默认配额 10MB，
     * 所以超过 BLOB_MAX_BYTES 的图直接跳过（宁可不缓存，也不能写失败把
     * 整个 storage 搞挂）。只保留最新的这一张，写入前不带旧键 —— 天然覆盖。
     */
    _storeWallpaperBlob(imageUrl) {
        // 用 fetch 拿原始字节再转 base64，**不走 canvas**。
        //
        // 为什么不用 canvas：图床普遍 302 跳 CDN（picsum → images.picsum.photos /
        // fastly，pexels → images.pexels.com），重定向链里只要有一跳没回
        // Access-Control-Allow-Origin，浏览器就把这张图当「污染画布」处理 ——
        // drawImage 不报错，toDataURL 却拿到一张雪花噪点的坏图，写进缓存后
        // 每次刷新都拿它当壁纸。用户看到的就是「壁纸变成一团噪点」。
        //
        // fetch 走的是扩展的 host_permissions（manifest 里已补 *.picsum.photos、
        // images.pexels.com 等 CDN 域），不需要图床回 ACAO，拿到的是原样字节。
        // 顺带也不做重编码：JPEG 原图直接存，体积和画质都是原厂的。
        const MAX = WallpaperManager.BLOB_MAX_BYTES;

        fetch(imageUrl, { credentials: 'omit', cache: 'force-cache' })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const type = response.headers.get('content-type') || '';
                if (!/^image\//i.test(type)) throw new Error(`非图片响应: ${type}`);
                return response.blob();
            })
            .then(blob => {
                if (blob.size > MAX) {
                    console.log(`[壁纸] 原图 ${Math.round(blob.size / 1024)}KB 超过缓存上限，跳过`);
                    return null;
                }
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error || new Error('读取失败'));
                    reader.readAsDataURL(blob);
                });
            })
            .then(dataUrl => {
                if (!dataUrl) return;
                return chrome.storage.local
                    .set({
                        savedWallpaperBlob: dataUrl,
                        savedWallpaperBlobUrl: imageUrl, // 记录来源，用于判断缓存是否还对应当前壁纸
                    })
                    .then(() => {
                        console.log(
                            `[壁纸] 已缓存到本地（${Math.round(dataUrl.length / 1024)}KB，原样字节），下次零请求`
                        );
                    });
            })
            .catch(error => {
                // 无 host_permissions / 网络失败 / 超配额 —— 放弃缓存，壁纸照常显示
                console.warn('[壁纸] 本地缓存生成失败:', error && error.message);
            });
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
// 本地壁纸缓存上限：storage.local 默认配额 10MB，留足余量给其他键。
// base64 比原图大 33%，所以 3.6MB 的 dataURL ≈ 2.7MB 原图。
WallpaperManager.BLOB_MAX_BYTES = 3.6 * 1024 * 1024;
// 缓存前把图缩到这个宽度：1920 已能铺满常见屏幕，且大幅压小体积。
WallpaperManager.BLOB_MAX_WIDTH = 1920;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WallpaperManager;
} else {
    window.WallpaperManager = WallpaperManager;
}
