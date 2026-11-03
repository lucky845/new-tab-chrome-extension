// 全局应用实例
let app = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 初始化应用
    try {
        app = new NewTabApp();
        await app.init();

        // 设置全局引用，供删除功能使用
        window.app = app;
    } catch (error) {
        console.error('应用初始化失败:', error);
    }

    // 获取必要的DOM元素
    const wallpaperContainer = document.getElementById(window.SELECTORS.wallpaperContainer);
    const changeWallpaperBtn = document.getElementById(window.SELECTORS.changeWallpaperBtn);
    const settingsBtn = document.getElementById(window.SELECTORS.settingsBtn);
    const settingsPanel = document.getElementById(window.SELECTORS.settingsPanel);
    const apiKeyInput = document.getElementById(window.SELECTORS.pexelsApiKeyInput);
    const weatherApiKeyInput = document.getElementById(window.SELECTORS.weatherApiKeyInput);
    const saveSettingsBtn = document.getElementById(window.SELECTORS.saveSettingsBtn);
    const closeSettingsBtn = document.getElementById(window.SELECTORS.closeSettingsBtn);
    const toggleVisibilityBtn = document.getElementById(window.SELECTORS.pexelsToggleBtn);

    // 壁纸面板元素
    const wallpaperSettingsBtn = document.getElementById(window.SELECTORS.wallpaperSettingsBtn);
    const wallpaperPanel = document.getElementById(window.SELECTORS.wallpaperPanel);
    const wallpaperSearchInput = document.getElementById(window.SELECTORS.wallpaperSearchInput);
    const wallpaperSearchBtn = document.getElementById(window.SELECTORS.wallpaperSearchBtn);
    const wallpaperGrid = document.getElementById(window.SELECTORS.wallpaperGrid);
    const paginationButtons = document.getElementById(window.SELECTORS.paginationButtons);
    const totalResultsInfo = document.getElementById(window.SELECTORS.totalResultsInfo);
    const jumpToPageInput = document.getElementById(window.SELECTORS.jumpToPageInput);
    const closeWallpaperPanelBtn = document.getElementById(window.SELECTORS.closeWallpaperPanelBtn);
    const wallpaperCategoriesSidebar = document.getElementById(
        window.SELECTORS.wallpaperCategoriesSidebar
    );

    // 搜索相关元素（搜索交互由 app.js + searchManager 模块化处理）
    const searchSubmitBtn = document.getElementById(window.SELECTORS.searchSubmitBtn);
    const clearSearchBtn = document.getElementById(window.SELECTORS.clearSearchBtn);

    // Quick Access Modal elements
    const addQuickAccessPanel = document.getElementById(window.SELECTORS.addQuickAccessPanel);
    const qaUrlInput = document.getElementById(window.SELECTORS.qaUrlInput);
    const qaNameInput = document.getElementById(window.SELECTORS.qaNameInput);
    const qaIconInput = document.getElementById(window.SELECTORS.qaIconInput);
    const saveQaBtn = document.getElementById(window.SELECTORS.saveQaBtn);
    const cancelQaBtn = document.getElementById(window.SELECTORS.cancelQaBtn);
    const qaUrlError = document.getElementById(window.SELECTORS.qaUrlError);
    const qaNameError = document.getElementById(window.SELECTORS.qaNameError);
    const qaIconPreviewContainer = document.getElementById(window.SELECTORS.qaIconPreviewContainer);
    const qaIconPreview = document.getElementById(window.SELECTORS.qaIconPreview);
    const qaPanelTitle = document.getElementById(window.SELECTORS.qaPanelTitle);
    const qaEditIndexInput = document.getElementById(window.SELECTORS.qaEditIndexInput);

    // 常量
    const WALLPAPERS_PER_PAGE = 18;
    const searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    const clearIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    // 状态管理
    let pexelsApiKey = '';
    let currentWallpaperQuery = 'Nature';
    let currentWallpaperPage = 1;
    let activeCategoryElement = null;
    let lastActiveCategoryQuery = 'Nature'; // 记住上次选择的分类
    let totalPages = 1;
    let totalWallpapers = 0;

    const wallpaperCategories = [
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

    // SVG 图标（密钥可见性切换由 visibility-toggle 组件处理）

    // --- API密钥处理 ---
    const saveApiKey = async key => {
        const existing = await new Promise(r => chrome.storage.local.get(['settings'], r));
        const merged = { ...(existing.settings || {}), pexelsApiKey: key };
        await new Promise(resolve => chrome.storage.local.set({ settings: merged }, resolve));
        pexelsApiKey = key;
    };

    const loadApiKey = () => {
        return new Promise(resolve => {
            chrome.storage.local.get(['settings'], result => {
                let key = result.settings && result.settings.pexelsApiKey;
                if (key) {
                    pexelsApiKey = key;
                    if (apiKeyInput) apiKeyInput.value = pexelsApiKey;
                }
                resolve(pexelsApiKey);
            });
        });
    };

    // 一次性迁移与清理旧键，确保仅使用 settings
    const migrateLegacySettings = async () => {
        const legacyKeys = ['pexelsApiKey', 'weatherCity', 'temperatureUnit', 'weatherApiKey'];
        const data = await new Promise(r =>
            chrome.storage.local.get(['settings', ...legacyKeys], r)
        );
        const settings = { ...(data.settings || {}) };
        let changed = false;
        legacyKeys.forEach(k => {
            if (typeof data[k] !== 'undefined' && data[k] !== null && data[k] !== '') {
                settings[k] = data[k];
                changed = true;
            }
        });
        if (changed) {
            await new Promise(r => chrome.storage.local.set({ settings }, r));
            await new Promise(r => chrome.storage.local.remove(legacyKeys, r));
            console.log('已迁移并清理旧设置键:', legacyKeys);
        }
    };

    const openSettingsPanel = async () => {
        const currentKey = await loadApiKey();
        apiKeyInput.value = currentKey || '';
        settingsPanel.classList.remove('u-hidden');
    };

    const closeSettingsPanel = () => {
        settingsPanel.classList.add('u-hidden');
    };

    // 壁纸面板控制
    const openWallpaperPanel = () => {
        wallpaperPanel.classList.remove('u-hidden');
        if (wallpaperGrid.childElementCount === 0) {
            searchWallpapers('Nature', 1);
        }
    };

    const closeWallpaperPanel = () => {
        wallpaperPanel.classList.add('u-hidden');
        wallpaperSearchInput.value = ''; // 清空搜索框

        // 如果当前查询不是一个预设分类，则恢复到上次的分类
        const currentQueryIsACategory = wallpaperCategories.some(
            c => c.query === currentWallpaperQuery
        );
        if (!currentQueryIsACategory) {
            searchWallpapers(lastActiveCategoryQuery, 1);
        }
    };

    // 初始化可见性切换器
    const initVisibilityToggle = () => {
        // 使用通用模块进行绑定
        import('./js/components/visibility-toggle.js')
            .then(({ initVisibilityToggle }) => {
                initVisibilityToggle(apiKeyInput, toggleVisibilityBtn, {});
                const toggleWeatherBtn = document.getElementById('toggle-weather-key-visibility');
                if (toggleWeatherBtn && weatherApiKeyInput) {
                    initVisibilityToggle(weatherApiKeyInput, toggleWeatherBtn, {});
                }
            })
            .catch(() => {
                // 回退：不影响其他功能
            });
    };

    // 壁纸搜索和渲染
    const searchWallpapers = async (query, page) => {
        if (!pexelsApiKey) {
            // 未配置 Pexels Key：显示引导信息（Pexels 搜索为可选增强功能，壁纸仍由 Bing 提供）
            openWallpaperPanel();
            const wallpaperLoading = document.getElementById('wallpaper-loading');
            if (wallpaperLoading) wallpaperLoading.classList.add('u-hidden');
            const wallpaperGrid = document.getElementById('wallpaper-grid');
            if (wallpaperGrid) {
                wallpaperGrid.innerHTML =
                    '<div class="wallpaper-empty-hint">壁纸搜索需要 Pexels API 密钥（可选功能）。<br>当前新标签页已默认使用 Bing 每日壁纸，无需任何密钥。<br>如需解锁搜索与分类功能，请在设置中填写免费的 Pexels API 密钥。</div>';
            }
            return;
        }

        currentWallpaperQuery = query;
        currentWallpaperPage = page;

        // 更新UI中的高亮分类
        if (activeCategoryElement) {
            activeCategoryElement.classList.remove('active');
        }
        const newActiveCategory = wallpaperCategoriesSidebar.querySelector(
            `[data-category="${query}"]`
        );
        if (newActiveCategory) {
            newActiveCategory.classList.add('active');
            activeCategoryElement = newActiveCategory;
            lastActiveCategoryQuery = query; // 更新最后点击的分类
        } else {
            activeCategoryElement = null; // 如果是自定义搜索，则没有高亮分类
        }

        // 显示加载状态
        const wallpaperLoading = document.getElementById('wallpaper-loading');
        const wallpaperGrid = document.getElementById('wallpaper-grid');
        if (wallpaperLoading) wallpaperLoading.classList.remove('u-hidden');
        if (wallpaperGrid) wallpaperGrid.innerHTML = '';
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${WALLPAPERS_PER_PAGE}&page=${page}&orientation=landscape`;

        try {
            const response = await fetch(url, { headers: { Authorization: pexelsApiKey } });
            if (!response.ok) throw new Error('壁纸搜索失败');

            const data = await response.json();
            renderWallpaperGrid(data.photos);

            totalPages = Math.ceil(data.total_results / WALLPAPERS_PER_PAGE);
            totalWallpapers = data.total_results;
            updatePagination();
        } catch (error) {
            console.error('搜索壁纸时出错:', error);
            // 隐藏加载状态
            const wallpaperLoading = document.getElementById('wallpaper-loading');
            if (wallpaperLoading) wallpaperLoading.classList.add('u-hidden');
            wallpaperGrid.innerHTML = '加载失败，请检查API密钥或网络。';
        }
    };

    const renderWallpaperGrid = photos => {
        // 隐藏加载状态
        const wallpaperLoading = document.getElementById('wallpaper-loading');
        const wallpaperGrid = document.getElementById('wallpaper-grid');
        if (wallpaperLoading) wallpaperLoading.classList.add('u-hidden');
        if (wallpaperGrid) wallpaperGrid.innerHTML = '';
        photos.forEach(photo => {
            const img = document.createElement('img');
            img.src = photo.src.medium;
            img.alt = photo.alt;
            img.addEventListener('click', async () => {
                const wallpaperUrl = photo.src.large2x;
                wallpaperContainer.style.backgroundImage = `url('${wallpaperUrl}')`;

                // 保存被选中壁纸的完整信息到缓存
                await new Promise(resolve => {
                    chrome.storage.local.set(
                        {
                            savedWallpaperId: photo.id,
                            savedWallpaperUrl: wallpaperUrl,
                            savedWallpaperData: {
                                id: photo.id,
                                url: wallpaperUrl,
                                photographer: photo.photographer,
                                alt: photo.alt,
                            },
                        },
                        resolve
                    );
                });

                console.log(`已保存并缓存壁纸 (ID: ${photo.id})`);
                closeWallpaperPanel();
            });
            if (wallpaperGrid) wallpaperGrid.appendChild(img);
        });
    };

    const updatePagination = () => {
        paginationButtons.innerHTML = ''; // 清空旧按钮

        // 辅助函数：创建按钮
        const createButton = (
            text,
            page,
            isDisabled = false,
            isActive = false,
            isEllipsis = false
        ) => {
            if (isEllipsis) {
                const span = document.createElement('span');
                span.textContent = '...';
                return span;
            }

            const button = document.createElement('button');
            button.innerHTML = text;
            button.disabled = isDisabled;
            if (isActive) {
                button.classList.add('active');
            }
            return button;
        };

        // 上一页按钮
        const prevButton = createButton(
            '上一页',
            currentWallpaperPage - 1,
            currentWallpaperPage === 1
        );
        if (prevButton && !prevButton.disabled) {
            prevButton.addEventListener('click', () => {
                currentWallpaperPage = currentWallpaperPage - 1;
                updatePagination();
                searchWallpapers(currentWallpaperQuery, currentWallpaperPage);
            });
        }
        paginationButtons.appendChild(prevButton);

        // 页码按钮逻辑
        const pagesToShow = getPaginationRange(currentWallpaperPage, totalPages);
        pagesToShow.forEach(page => {
            if (page === '...') {
                paginationButtons.appendChild(createButton('', null, false, false, true));
            } else {
                const pageButton = createButton(page, page, false, page === currentWallpaperPage);
                if (pageButton && page !== '...') {
                    pageButton.addEventListener('click', () => {
                        // 立即更新当前页码
                        currentWallpaperPage = page;
                        // 立即更新分页显示
                        updatePagination();
                        // 然后搜索壁纸
                        searchWallpapers(currentWallpaperQuery, page);
                    });
                }
                paginationButtons.appendChild(pageButton);
            }
        });

        // 下一页按钮
        const nextButton = createButton(
            '下一页',
            currentWallpaperPage + 1,
            currentWallpaperPage >= totalPages
        );
        if (nextButton && !nextButton.disabled) {
            nextButton.addEventListener('click', () => {
                currentWallpaperPage = currentWallpaperPage + 1;
                updatePagination();
                searchWallpapers(currentWallpaperQuery, currentWallpaperPage);
            });
        }
        paginationButtons.appendChild(nextButton);

        // 更新信息
        const maxResults = totalPages * WALLPAPERS_PER_PAGE;
        totalResultsInfo.textContent = `共 ${totalPages} 页 / ${totalWallpapers > maxResults ? `~${maxResults}` : totalWallpapers} 个`;
        jumpToPageInput.max = totalPages;
    };

    const getPaginationRange = (current, total) => {
        const delta = 2;
        const range = [];
        for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
            range.push(i);
        }

        if (current - delta > 2) {
            range.unshift('...');
        }
        if (current + delta < total - 1) {
            range.push('...');
        }

        range.unshift(1);
        if (total > 1) {
            range.push(total);
        }

        return [...new Set(range)]; // Set to remove duplicates if total pages is small
    };

    // 主壁纸功能
    const fetchAndSetWallpaper = async () => {
        const apiKey = await loadApiKey();

        if (!apiKey) {
            // 未配置 Pexels Key：默认使用 Bing 每日壁纸（无需密钥，开箱即用）
            await fetchBingWallpaper(false);
            return;
        }

        // 1. 尝试加载已缓存的壁纸
        const result = await new Promise(resolve =>
            chrome.storage.local.get(
                ['savedWallpaperId', 'savedWallpaperUrl', 'savedWallpaperData'],
                resolve
            )
        );

        if (result.savedWallpaperUrl) {
            // 优先使用缓存的URL，避免网络请求
            wallpaperContainer.style.backgroundImage = `url('${result.savedWallpaperUrl}')`;
            console.log('使用缓存的壁纸URL');

            // 异步验证壁纸是否仍然有效（Bing 壁纸的官方 CDN 链接长期有效，无需走 Pexels 验证）
            const isBingWallpaper =
                result.savedWallpaperData && result.savedWallpaperData.source === 'bing';
            if (result.savedWallpaperId && !isBingWallpaper) {
                setTimeout(async () => {
                    const isValid = await validateWallpaperById(result.savedWallpaperId, apiKey);
                    if (!isValid) {
                        console.log('缓存的壁纸已失效，获取新壁纸');
                        await fetchRandomWallpaper(apiKey, true);
                    }
                }, 100);
            }
            return;
        }

        // 2. 如果有ID但没有URL，尝试获取URL
        if (result.savedWallpaperId && !result.savedWallpaperUrl) {
            const success = await fetchWallpaperById(result.savedWallpaperId, apiKey);
            if (success) {
                return;
            }
        }

        // 3. 如果没有保存的壁纸或加载失败，则获取随机壁纸
        await fetchRandomWallpaper(apiKey, true);
    };

    // 验证壁纸是否仍然有效
    const validateWallpaperById = async (id, apiKey) => {
        const url = `https://api.pexels.com/v1/photos/${id}`;
        try {
            const response = await fetch(url, { headers: { Authorization: apiKey } });
            return response.ok;
        } catch (error) {
            console.error('验证壁纸时网络错误:', error);
            return false;
        }
    };

    const fetchWallpaperById = async (id, apiKey) => {
        const url = `https://api.pexels.com/v1/photos/${id}`;
        try {
            const response = await fetch(url, { headers: { Authorization: apiKey } });
            if (!response.ok) {
                console.error(
                    `获取已保存壁纸(ID: ${id})失败，状态: ${response.status}。将移除该ID。`
                );
                await new Promise(resolve =>
                    chrome.storage.local.remove(
                        ['savedWallpaperId', 'savedWallpaperUrl', 'savedWallpaperData'],
                        resolve
                    )
                );
                return false;
            }
            const photo = await response.json();
            const wallpaperUrl = photo.src.large2x;
            wallpaperContainer.style.backgroundImage = `url('${wallpaperUrl}')`;

            // 保存壁纸信息到缓存
            await new Promise(resolve => {
                chrome.storage.local.set(
                    {
                        savedWallpaperId: photo.id,
                        savedWallpaperUrl: wallpaperUrl,
                        savedWallpaperData: {
                            id: photo.id,
                            url: wallpaperUrl,
                            photographer: photo.photographer,
                            alt: photo.alt,
                        },
                    },
                    resolve
                );
            });

            console.log(`成功加载并缓存壁纸 (ID: ${id})`);
            return true;
        } catch (error) {
            console.error('获取已保存壁纸时网络错误:', error);
            return false;
        }
    };

    const fetchRandomWallpaper = async (apiKey, shouldSave = false) => {
        const queries = [
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
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        const page = Math.floor(Math.random() * 100) + 1;
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(randomQuery)}&orientation=landscape&per_page=1&page=${page}`;

        try {
            const response = await fetch(url, { headers: { Authorization: apiKey } });

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Pexels API 密钥无效或已过期。');
                    openSettingsPanel();
                }
                throw new Error(`Pexels API 请求失败: ${response.status}`);
            }

            const data = await response.json();
            if (data.photos && data.photos.length > 0) {
                const photo = data.photos[0];
                const wallpaperUrl = photo.src.large2x;
                wallpaperContainer.style.backgroundImage = `url('${wallpaperUrl}')`;

                if (shouldSave) {
                    await new Promise(resolve => {
                        chrome.storage.local.set(
                            {
                                savedWallpaperId: photo.id,
                                savedWallpaperUrl: wallpaperUrl,
                                savedWallpaperData: {
                                    id: photo.id,
                                    url: wallpaperUrl,
                                    photographer: photo.photographer,
                                    alt: photo.alt,
                                },
                            },
                            resolve
                        );
                    });
                    console.log(`获取并已保存新的随机壁纸 (ID: ${photo.id})`);
                }
            } else {
                throw new Error('Pexels API 未返回照片。');
            }
        } catch (error) {
            console.error('获取 Pexels 壁纸失败:', error);
            wallpaperContainer.style.backgroundImage = `url('https://www.todaybing.com/api/today?${new Date().getTime()}')`;
        }
    };

    // 通过 Bing 官方接口获取壁纸（无需任何 API Key）
    const fetchBingWallpaper = async (isRandom = true) => {
        try {
            const photo = isRandom
                ? await window.BingWallpaper.fetchRandom()
                : await window.BingWallpaper.fetchDaily();
            if (photo && photo.url) {
                wallpaperContainer.style.backgroundImage = `url('${photo.url}')`;
                const bingId = `bing_${photo.startdate || Date.now()}`;
                await new Promise(resolve => {
                    chrome.storage.local.set(
                        {
                            savedWallpaperId: bingId,
                            savedWallpaperUrl: photo.url,
                            savedWallpaperData: {
                                id: bingId,
                                url: photo.url,
                                photographer: 'Bing Daily Wallpaper',
                                alt: photo.title || photo.copyright || '',
                                source: 'bing',
                            },
                        },
                        resolve
                    );
                });
                console.log(`已应用 Bing 壁纸: ${photo.title || photo.url}`);
                return;
            }
        } catch (error) {
            console.error('获取 Bing 壁纸失败:', error);
        }
        // 兜底：第三方今日壁纸接口
        wallpaperContainer.style.backgroundImage = `url('https://www.todaybing.com/api/today?${new Date().getTime()}')`;
    };

    changeWallpaperBtn.addEventListener('click', async () => {
        const apiKey = await loadApiKey();
        if (apiKey) {
            await fetchRandomWallpaper(apiKey, true); // 获取新壁纸并保存
        } else {
            // 未配置 Pexels Key：从 Bing 壁纸池随机换一张（无需密钥）
            await fetchBingWallpaper(true);
        }
    });
    settingsBtn.addEventListener('click', openSettingsPanel);
    closeSettingsBtn.addEventListener('click', closeSettingsPanel);

    wallpaperSettingsBtn.addEventListener('click', openWallpaperPanel);
    closeWallpaperPanelBtn.addEventListener('click', closeWallpaperPanel);

    wallpaperSearchBtn.addEventListener('click', () => {
        const query = wallpaperSearchInput.value.trim();
        if (query) {
            searchWallpapers(query, 1);
        } else {
            // 如果搜索框为空，则恢复到上次选择的分类
            searchWallpapers(lastActiveCategoryQuery, 1);
        }
    });

    wallpaperSearchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            const query = wallpaperSearchInput.value.trim();
            if (query) {
                searchWallpapers(query, 1);
            } else {
                // 如果搜索框为空，则恢复到上次选择的分类
                searchWallpapers(lastActiveCategoryQuery, 1);
            }
        }
    });

    jumpToPageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            const page = parseInt(jumpToPageInput.value, 10);
            if (page >= 1 && page <= totalPages) {
                searchWallpapers(currentWallpaperQuery, page);
                jumpToPageInput.value = '';
                jumpToPageInput.blur();
            } else {
                window.showToast(`请输入 1 到 ${totalPages} 之间的页码。`);
            }
        }
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const newKey = apiKeyInput.value.trim();
        const weatherCity =
            document.getElementById(window.SELECTORS.weatherCityInput)?.value.trim() || '';
        const weatherApiKey =
            document.getElementById(window.SELECTORS.weatherApiKeyInput)?.value.trim() || '';

        try {
            // Pexels Key 为可选项：填写即保存，清空即移除（回到 Bing 免密钥模式）
            await saveApiKey(newKey);

            // 保存天气城市与天气API Key
            // 统一写入集中 settings（避免双写）
            const existing = await new Promise(resolve =>
                chrome.storage.local.get(['settings'], resolve)
            );
            const merged = { ...(existing.settings || {}) };
            if (weatherApiKey) merged.weatherApiKey = weatherApiKey;
            merged.weatherCity = weatherCity; // 可为空字符串，表示自动定位
            await chrome.storage.local.set({ settings: merged });

            // 更新天气管理器的城市设置
            if (window.app && window.app.weatherManager) {
                if (weatherApiKey && window.app.weatherManager.setApiKey) {
                    window.app.weatherManager.setApiKey(weatherApiKey);
                }
                // 触发天气刷新（会自动读取最新API Key）
                if (weatherCity) {
                    await window.app.weatherManager.setCity(weatherCity);
                } else {
                    await window.app.weatherManager.useCurrentLocation();
                }
            }

            closeSettingsPanel();
            fetchAndSetWallpaper();
            console.log('设置已保存');
            window.showToast('设置已保存', 'success');
        } catch (error) {
            console.error('保存设置失败:', error);
            window.showToast('保存设置失败，请重试', 'error');
        }
    });

    settingsPanel.addEventListener('click', e => {
        if (e.target === settingsPanel) {
            closeSettingsPanel();
        }
    });

    // --- 壁纸分类 ---
    const renderCategories = () => {
        const title = document.createElement('h4');
        title.textContent = '推荐分类';
        const categoryList = document.createElement('ul');

        wallpaperCategories.forEach(category => {
            const categoryItem = document.createElement('li');
            categoryItem.textContent = category.name;
            categoryItem.dataset.category = category.query;

            categoryItem.addEventListener('click', () => {
                wallpaperSearchInput.value = ''; // 清空搜索框
                searchWallpapers(category.query, 1);
            });
            categoryList.appendChild(categoryItem);
        });

        wallpaperCategoriesSidebar.innerHTML = ''; // 清空现有内容
        wallpaperCategoriesSidebar.appendChild(title);
        wallpaperCategoriesSidebar.appendChild(categoryList);
    };

    // 搜索引擎功能已移至模块化架构，在 app.js 中处理
    await migrateLegacySettings();
    await loadApiKey(); // 确保在获取壁纸前加载API Key

    // 添加调试信息
    console.log('开始初始化壁纸...');
    fetchAndSetWallpaper();
    initVisibilityToggle();
    renderCategories();
    // 搜索引擎相关功能已在模块化架构中处理
    searchSubmitBtn.innerHTML = searchIcon;
    clearSearchBtn.innerHTML = clearIcon;

    // 搜索历史清空已由 app.js bindSearchEvents() 统一绑定（searchManager.clearHistory）

    // Event listener for the cancel button in the new quick access modal
    cancelQaBtn.addEventListener('click', () => {
        addQuickAccessPanel.classList.add('u-hidden');
    });

    // Event listener for clicking outside the modal to close it
    addQuickAccessPanel.addEventListener('click', e => {
        if (e.target === addQuickAccessPanel) {
            addQuickAccessPanel.classList.add('u-hidden');
        }
    });

    // Event listener for the save button
    saveQaBtn.addEventListener('click', async () => {
        let url = qaUrlInput.value.trim();
        const name = qaNameInput.value.trim();
        const icon = qaIconInput.value.trim();
        const editIndex = parseInt(qaEditIndexInput.value, 10);

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        const newSite = { name, url, icon: icon || null };

        const data = await new Promise(resolve =>
            chrome.storage.local.get({ quickAccessSites: [] }, resolve)
        );
        const sites = data.quickAccessSites;

        if (editIndex > -1) {
            sites[editIndex] = newSite; // Update existing
        } else {
            sites.push(newSite); // Add new
        }

        await new Promise(resolve =>
            chrome.storage.local.set({ quickAccessSites: sites }, resolve)
        );

        // 重新渲染快捷访问列表
        if (
            window.app &&
            window.app.quickAccessManager &&
            window.app.quickAccessManager.pagination
        ) {
            // 直接调用分页组件的setItems方法，避免重复渲染
            window.app.quickAccessManager.pagination.setItems(sites);
        }

        addQuickAccessPanel.classList.add('u-hidden');
    });

    const quickAccessGrid = document.getElementById(window.SELECTORS.quickAccessGrid);

    const validateQuickAccessForm = () => {
        const url = qaUrlInput.value.trim();
        const name = qaNameInput.value.trim();
        let isUrlValid = false;
        let isNameValid = false;

        // URL Validation
        if (url.length === 0) {
            qaUrlInput.classList.remove('invalid');
            qaUrlError.classList.add('u-hidden');
        } else {
            const urlPattern =
                /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?.*)?(#[-a-z\d_]*)?$/i;
            if (urlPattern.test(url)) {
                qaUrlInput.classList.remove('invalid');
                qaUrlError.classList.add('u-hidden');
                isUrlValid = true;
            } else {
                qaUrlInput.classList.add('invalid');
                qaUrlError.textContent = '请输入有效的网址。';
                qaUrlError.classList.remove('u-hidden');
            }
        }

        // Name Validation
        if (name.length === 0) {
            qaNameInput.classList.remove('invalid');
            qaNameError.classList.add('u-hidden');
        } else {
            if (name.length >= 2 && name.length <= 10) {
                qaNameInput.classList.remove('invalid');
                qaNameError.classList.add('u-hidden');
                isNameValid = true;
            } else {
                qaNameInput.classList.add('invalid');
                qaNameError.textContent = '名称长度应在 2 到 10 个字符之间。';
                qaNameError.classList.remove('u-hidden');
            }
        }

        saveQaBtn.disabled = !(isUrlValid && isNameValid);
    };

    qaUrlInput.addEventListener('input', validateQuickAccessForm);
    qaNameInput.addEventListener('input', validateQuickAccessForm);

    qaIconInput.addEventListener('input', () => {
        const input = qaIconInput.value.trim();
        if (input.startsWith('<svg')) {
            qaIconPreview.innerHTML = input;
            qaIconPreviewContainer.classList.remove('u-hidden');
        } else if (input.match(/\.(jpeg|jpg|gif|png|svg)$/) || input.startsWith('http')) {
            qaIconPreview.innerHTML = `<img src="${input}" alt="Icon Preview">`;
            qaIconPreviewContainer.classList.remove('u-hidden');
        } else {
            qaIconPreviewContainer.classList.add('u-hidden');
            qaIconPreview.innerHTML = '';
        }
    });

    quickAccessGrid.addEventListener('click', async e => {
        // 编辑/删除快捷方式由右键菜单（showContextMenu）处理；
        // 分页组件渲染的卡片不含 edit/delete 按钮，历史遗留的分支已移除
        if (e.target.closest('.add-quick-access-btn')) {
            qaPanelTitle.textContent = '添加快捷方式';
            qaEditIndexInput.value = '-1';

            // Reset form for new entry
            qaUrlInput.value = '';
            qaNameInput.value = '';
            qaIconInput.value = '';
            qaIconPreviewContainer.classList.add('u-hidden');
            qaIconPreview.innerHTML = ''; // 清空图标预览内容
            qaUrlInput.classList.remove('invalid');
            qaNameInput.classList.remove('invalid');
            qaUrlError.classList.add('u-hidden');
            qaNameError.classList.add('u-hidden');
            validateQuickAccessForm();

            addQuickAccessPanel.classList.remove('u-hidden');
        }
    });

    // 右键菜单功能
    function showContextMenu(e, item) {
        e.preventDefault();

        // 移除现有的右键菜单
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // 创建右键菜单
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px 0;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            min-width: 120px;
            font-size: 14px;
            color: #000000;
        `;

        // 获取项目信息
        const index = parseInt(item.dataset.index, 10);
        const siteName = item.querySelector('.name').textContent;

        // 编辑选项
        const editOption = document.createElement('div');
        editOption.textContent = '编辑';
        editOption.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        editOption.onmouseover = () => (editOption.style.backgroundColor = 'rgba(0, 0, 0, 0.1)');
        editOption.onmouseout = () => (editOption.style.backgroundColor = 'transparent');
        editOption.onclick = async () => {
            const data = await new Promise(resolve =>
                chrome.storage.local.get({ quickAccessSites: [] }, resolve)
            );
            const sites = data.quickAccessSites;
            const siteToEdit = sites[index];

            qaPanelTitle.textContent = '编辑快捷方式';
            qaEditIndexInput.value = index;
            qaUrlInput.value = siteToEdit.url;
            qaNameInput.value = siteToEdit.name;
            qaIconInput.value = siteToEdit.icon || '';

            qaIconInput.dispatchEvent(new Event('input'));
            validateQuickAccessForm();
            addQuickAccessPanel.classList.remove('u-hidden');
            menu.remove();
        };

        // 删除选项
        const deleteOption = document.createElement('div');
        deleteOption.textContent = '删除';
        deleteOption.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            color: #e74c3c;
        `;
        deleteOption.onmouseover = () =>
            (deleteOption.style.backgroundColor = 'rgba(231, 76, 60, 0.1)');
        deleteOption.onmouseout = () => (deleteOption.style.backgroundColor = 'transparent');
        deleteOption.onclick = async () => {
            // 显示自定义删除确认弹窗
            const deleteModal = document.getElementById(window.SELECTORS.deleteConfirmModal);
            const deleteConfirmText = document.getElementById(window.SELECTORS.deleteConfirmText);
            const deleteConfirmDelete = document.getElementById(
                window.SELECTORS.deleteConfirmDelete
            );
            const deleteConfirmCancel = document.getElementById(
                window.SELECTORS.deleteConfirmCancel
            );

            if (deleteModal && deleteConfirmText && deleteConfirmDelete && deleteConfirmCancel) {
                deleteConfirmText.textContent = `您确定要删除 "${siteName}" 吗？`;
                deleteModal.classList.remove('u-hidden');
                menu.remove(); // 隐藏右键菜单

                // 绑定删除确认事件
                const handleDelete = async () => {
                    const data = await new Promise(resolve =>
                        chrome.storage.local.get({ quickAccessSites: [] }, resolve)
                    );
                    const sites = data.quickAccessSites;
                    sites.splice(index, 1);
                    await new Promise(resolve =>
                        chrome.storage.local.set({ quickAccessSites: sites }, resolve)
                    );

                    // 重新渲染快捷访问列表
                    if (
                        window.app &&
                        window.app.quickAccessManager &&
                        window.app.quickAccessManager.pagination
                    ) {
                        // 直接调用分页组件的setItems方法，避免重复渲染
                        window.app.quickAccessManager.pagination.setItems(sites);
                    }

                    // 隐藏弹窗并清理事件
                    deleteModal.classList.add('u-hidden');
                    deleteConfirmDelete.removeEventListener('click', handleDelete);
                    deleteConfirmCancel.removeEventListener('click', handleCancel);
                };

                // 绑定取消事件
                const handleCancel = () => {
                    deleteModal.classList.add('u-hidden');
                    deleteConfirmDelete.removeEventListener('click', handleDelete);
                    deleteConfirmCancel.removeEventListener('click', handleCancel);
                };

                deleteConfirmDelete.addEventListener('click', handleDelete);
                deleteConfirmCancel.addEventListener('click', handleCancel);
            }
            menu.remove();
        };

        // 添加选项到菜单
        menu.appendChild(editOption);
        menu.appendChild(deleteOption);

        // 设置菜单位置
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        // 添加到页面
        document.body.appendChild(menu);

        // 点击其他地方关闭菜单
        const closeMenu = e => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        // 延迟添加事件监听器，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    // 添加右键菜单事件监听器
    quickAccessGrid.addEventListener('contextmenu', e => {
        const item = e.target.closest('.quick-access-item');
        if (item && !item.classList.contains('add-quick-access-btn')) {
            showContextMenu(e, item);
        }
    });
});

// 快捷访问功能已移至模块化架构，在 app.js 中处理

// 传统渲染方式已移除，使用模块化架构
