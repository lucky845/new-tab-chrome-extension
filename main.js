document.addEventListener('DOMContentLoaded', async () => {
    const sitesGrid = document.getElementById('sites-grid');
    const searchInput = document.getElementById('search-input');
    const wallpaperContainer = document.getElementById('wallpaper');
    const changeWallpaperBtn = document.getElementById('change-wallpaper-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const toggleVisibilityBtn = document.getElementById('toggle-api-key-visibility');

    // 壁纸面板元素
    const wallpaperSettingsBtn = document.getElementById('wallpaper-settings-btn');
    const wallpaperPanel = document.getElementById('wallpaper-panel');
    const wallpaperSearchInput = document.getElementById('wallpaper-search-input');
    const wallpaperSearchBtn = document.getElementById('wallpaper-search-btn');
    const wallpaperGrid = document.getElementById('wallpaper-grid');
    const paginationButtons = document.getElementById('pagination-buttons');
    const totalResultsInfo = document.getElementById('total-results-info');
    const jumpToPageInput = document.getElementById('jump-to-page-input');
    const closeWallpaperPanelBtn = document.getElementById('close-wallpaper-panel-btn');
    const wallpaperCategoriesSidebar = document.getElementById('wallpaper-categories-sidebar');

    // 常量
    const WALLPAPERS_PER_PAGE = 18;

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
        { name: '旅行', query: 'Travel' }
    ];

    // SVG 图标
    const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    const defaultSites = [
        { title: 'Google', url: 'https://www.google.com' },
        { title: 'Bilibili', url: 'https://www.bilibili.com' },
        { title: 'GitHub', url: 'https://www.github.com' },
        { title: 'V2EX', url: 'https://www.v2ex.com' },
        { title: 'YouTube', url: 'https://www.youtube.com' },
        { title: 'Twitter', url: 'https://www.twitter.com' },
        { title: 'Reddit', url: 'https://www.reddit.com' },
        { title: 'Wikipedia', url: 'https://www.wikipedia.org' },
    ];

    // --- API密钥处理 ---
    const saveApiKey = (key) => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ pexelsApiKey: key }, () => {
                pexelsApiKey = key;
                resolve();
            });
        });
    };

    const loadApiKey = () => {
        return new Promise((resolve) => {
            chrome.storage.local.get('pexelsApiKey', (result) => {
                if (result.pexelsApiKey) {
                    pexelsApiKey = result.pexelsApiKey;
                    apiKeyInput.value = pexelsApiKey;
                }
                resolve(pexelsApiKey);
            });
        });
    };

    const openSettingsPanel = async () => {
        const currentKey = await loadApiKey();
        apiKeyInput.value = currentKey || '';
        settingsPanel.classList.remove('hidden');
    };

    const closeSettingsPanel = () => {
        settingsPanel.classList.add('hidden');
    };

    // 壁纸面板控制
    const openWallpaperPanel = () => {
        wallpaperPanel.classList.remove('hidden');
        if (wallpaperGrid.childElementCount === 0) {
            searchWallpapers('Nature', 1);
        }
    };

    const closeWallpaperPanel = () => {
        wallpaperPanel.classList.add('hidden');
        wallpaperSearchInput.value = ''; // 清空搜索框
    
        // 如果当前查询不是一个预设分类，则恢复到上次的分类
        const currentQueryIsACategory = wallpaperCategories.some(c => c.query === currentWallpaperQuery);
        if (!currentQueryIsACategory) {
            searchWallpapers(lastActiveCategoryQuery, 1);
        }
    };

    // 初始化可见性切换器
    const initVisibilityToggle = () => {
        toggleVisibilityBtn.innerHTML = eyeOffIcon;

        toggleVisibilityBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleVisibilityBtn.innerHTML = eyeIcon;
            } else {
                apiKeyInput.type = 'password';
                toggleVisibilityBtn.innerHTML = eyeOffIcon;
            }
        });
    };

    // 壁纸搜索和渲染
    const searchWallpapers = async (query, page) => {
        if (!pexelsApiKey) {
            showWallpaperPanel();
            alert('请先在设置中输入 Pexels API 密钥');
            return;
        }

        currentWallpaperQuery = query;
        currentWallpaperPage = page;

        // 更新UI中的高亮分类
        if (activeCategoryElement) {
            activeCategoryElement.classList.remove('active');
        }
        const newActiveCategory = wallpaperCategoriesSidebar.querySelector(`[data-category="${query}"]`);
        if (newActiveCategory) {
            newActiveCategory.classList.add('active');
            activeCategoryElement = newActiveCategory;
            lastActiveCategoryQuery = query; // 更新最后点击的分类
        } else {
            activeCategoryElement = null; // 如果是自定义搜索，则没有高亮分类
        }

        wallpaperGrid.innerHTML = '正在加载...';
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
            wallpaperGrid.innerHTML = '加载失败，请检查API密钥或网络。';
        }
    };

    const renderWallpaperGrid = (photos) => {
        wallpaperGrid.innerHTML = '';
        photos.forEach(photo => {
            const img = document.createElement('img');
            img.src = photo.src.medium;
            img.alt = photo.alt;
            img.addEventListener('click', () => {
                wallpaperContainer.style.backgroundImage = `url('${photo.src.large2x}')`;
                // 保存被选中壁纸的ID
                chrome.storage.local.set({ savedWallpaperId: photo.id }, () => {
                    console.log(`已保存壁纸ID: ${photo.id}`);
                });
                closeWallpaperPanel();
            });
            wallpaperGrid.appendChild(img);
        });
    };

    const updatePagination = () => {
        paginationButtons.innerHTML = ''; // 清空旧按钮
    
        // 辅助函数：创建按钮
        const createButton = (text, page, isDisabled = false, isActive = false, isEllipsis = false) => {
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
            if (page) {
                button.addEventListener('click', () => searchWallpapers(currentWallpaperQuery, page));
            }
            return button;
        };
    
        // 上一页按钮
        paginationButtons.appendChild(createButton('上一页', currentWallpaperPage - 1, currentWallpaperPage === 1));
    
        // 页码按钮逻辑
        const pagesToShow = getPaginationRange(currentWallpaperPage, totalPages);
        pagesToShow.forEach(page => {
            if (page === '...') {
                paginationButtons.appendChild(createButton('', null, false, false, true));
            } else {
                paginationButtons.appendChild(createButton(page, page, false, page === currentWallpaperPage));
            }
        });
    
        // 下一页按钮
        paginationButtons.appendChild(createButton('下一页', currentWallpaperPage + 1, currentWallpaperPage >= totalPages));
    
        // 更新信息
        const maxResults = totalPages * WALLPAPERS_PER_PAGE;
        totalResultsInfo.textContent = `共 ${totalPages} 页 / ${totalWallpapers > maxResults ? `~${maxResults}`: totalWallpapers} 个`;
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
            console.log('Pexels API 密钥未设置，请在设置中添加。');
            openSettingsPanel();
            wallpaperContainer.style.backgroundImage = `url('https://www.todaybing.com/api/today?${new Date().getTime()}')`;
            return;
        }
    
        // 1. 尝试加载已保存的壁纸
        const result = await new Promise(resolve => chrome.storage.local.get('savedWallpaperId', resolve));
        if (result.savedWallpaperId) {
            const success = await fetchWallpaperById(result.savedWallpaperId, apiKey);
            if (success) {
                return; // 成功加载，函数结束
            }
        }
    
        // 2. 如果没有保存的壁纸或加载失败，则获取随机壁纸
        await fetchRandomWallpaper(apiKey, true); // 首次加载，获取并保存
    };
    
    const fetchWallpaperById = async (id, apiKey) => {
        const url = `https://api.pexels.com/v1/photos/${id}`;
        try {
            const response = await fetch(url, { headers: { Authorization: apiKey } });
            if (!response.ok) {
                console.error(`获取已保存壁纸(ID: ${id})失败，状态: ${response.status}。将移除该ID。`);
                await new Promise(resolve => chrome.storage.local.remove('savedWallpaperId', resolve));
                return false;
            }
            const photo = await response.json();
            wallpaperContainer.style.backgroundImage = `url('${photo.src.large2x}')`;
            console.log(`成功加载已保存的壁纸 (ID: ${id})`);
            return true;
        } catch (error) {
            console.error('获取已保存壁纸时网络错误:', error);
            return false;
        }
    };
    
    const fetchRandomWallpaper = async (apiKey, shouldSave = false) => {
        const queries = ['Nature', 'Cityscape', 'Technology', 'Abstract', 'Ocean', 'Forest', 'Mountains', 'Sky', 'Wallpaper'];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        const page = Math.floor(Math.random() * 100) + 1;
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(randomQuery)}&orientation=landscape&per_page=1&page=${page}`;
    
        try {
            const response = await fetch(url, { headers: { Authorization: apiKey } });
    
            if (!response.ok) {
                if(response.status === 401) {
                    console.error('Pexels API 密钥无效或已过期。');
                    openSettingsPanel();
                }
                throw new Error(`Pexels API 请求失败: ${response.status}`);
            }
    
            const data = await response.json();
            if (data.photos && data.photos.length > 0) {
                const photo = data.photos[0];
                wallpaperContainer.style.backgroundImage = `url('${photo.src.large2x}')`;
                if (shouldSave) {
                    await new Promise(resolve => {
                        chrome.storage.local.set({ savedWallpaperId: photo.id }, resolve);
                        console.log(`获取并已保存新的随机壁纸ID: ${photo.id}`);
                    });
                }
            } else {
                throw new Error('Pexels API 未返回照片。');
            }
        } catch (error) {
            console.error('获取 Pexels 壁纸失败:', error);
            wallpaperContainer.style.backgroundImage = `url('https://www.todaybing.com/api/today?${new Date().getTime()}')`;
        }
    };

    const renderSites = (sites) => {
        sitesGrid.innerHTML = '';
        sites.forEach(site => {
            const siteItem = document.createElement('a');
            siteItem.href = site.url;
            siteItem.className = 'site-item';
            siteItem.target = '_blank';

            const siteIcon = document.createElement('div');
            siteIcon.className = 'site-icon';
            // 简单的文本图标，取标题第一个字
            siteIcon.textContent = site.title.substring(0, 1);

            const siteTitle = document.createElement('div');
            siteTitle.className = 'site-title';
            siteTitle.textContent = site.title;

            siteItem.appendChild(siteIcon);
            siteItem.appendChild(siteTitle);
            sitesGrid.appendChild(siteItem);
        });
    };

    const loadSites = () => {
        chrome.storage.sync.get({ sites: defaultSites }, (data) => {
            renderSites(data.sites);
        });
    };
    
    const handleSearch = () => {
        const query = searchInput.value;
        if (query) {
            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            window.location.href = url;
        }
    };

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    changeWallpaperBtn.addEventListener('click', async () => {
        const apiKey = await loadApiKey();
        if (apiKey) {
            await fetchRandomWallpaper(apiKey, true); // 获取新壁纸并保存
        } else {
            fetchAndSetWallpaper(); // 触发 "no key" 逻辑
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
    
    wallpaperSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = wallpaperSearchInput.value.trim();
            if(query) {
                searchWallpapers(query, 1);
            } else {
                // 如果搜索框为空，则恢复到上次选择的分类
                searchWallpapers(lastActiveCategoryQuery, 1);
            }
        }
    });

    jumpToPageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const page = parseInt(jumpToPageInput.value, 10);
            if (page >= 1 && page <= totalPages) {
                searchWallpapers(currentWallpaperQuery, page);
                jumpToPageInput.value = '';
                jumpToPageInput.blur();
            } else {
                alert(`请输入 1 到 ${totalPages} 之间的页码。`);
            }
        }
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const newKey = apiKeyInput.value.trim();
        if (newKey) {
            await saveApiKey(newKey);
            closeSettingsPanel();
            fetchAndSetWallpaper();
        } else {
            alert('API 密钥不能为空！');
        }
    });

    settingsPanel.addEventListener('click', (e) => {
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

    loadSites();
    await loadApiKey(); // 确保在获取壁纸前加载API Key
    fetchAndSetWallpaper();
    initVisibilityToggle();
    renderCategories();
}); 