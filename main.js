// 全局应用实例
let app = null;



document.addEventListener('DOMContentLoaded', async () => {
    // 初始化应用
    try {
        app = new NewTabApp();
        await app.init();
        console.log('应用状态:', app.getStatus());
        
        // 设置全局引用，供删除功能使用
        window.app = app;
    } catch (error) {
        console.error('应用初始化失败:', error);
    }

    // 获取必要的DOM元素
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
    
    // 搜索相关元素
    const searchEngineSelector = document.getElementById('search-engine-selector');
    const selectedEngine = document.getElementById('selected-engine');
    const searchEngineDropdown = document.getElementById('search-engine-dropdown');
    const searchSubmitBtn = document.getElementById('search-submit-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchHistoryDropdown = document.getElementById('search-history-dropdown');
    const historyItemsContainer = document.getElementById('history-items-container');
    const clearHistoryContainer = document.getElementById('clear-history-container');
    const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');
    
    // Quick Access Modal elements
    const addQuickAccessPanel = document.getElementById('add-quick-access-panel');
    const qaUrlInput = document.getElementById('qa-url-input');
    const qaNameInput = document.getElementById('qa-name-input');
    const qaIconInput = document.getElementById('qa-icon-input');
    const saveQaBtn = document.getElementById('save-qa-btn');
    const cancelQaBtn = document.getElementById('cancel-qa-btn');
    const qaUrlError = document.getElementById('qa-url-error');
    const qaNameError = document.getElementById('qa-name-error');
    const qaIconPreviewContainer = document.getElementById('qa-icon-preview-container');
    const qaIconPreview = document.getElementById('qa-icon-preview');
    const qaPanelTitle = document.getElementById('qa-panel-title');
    const qaEditIndexInput = document.getElementById('qa-edit-index');

    // 常量
    const WALLPAPERS_PER_PAGE = 18;
    const MAX_HISTORY_ITEMS = 10;
    const searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    const clearIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const searchEngines = [
        { name: 'Baidu', icon: `<svg t="1750565499301" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1565" width="200" height="200"><path d="M345.706 297.423c15.35 12.792 35.817 20.467 53.726 17.908 20.467 0 38.375-10.233 53.725-23.025 17.91-15.35 30.7-35.817 40.934-58.842C512 189.97 512 136.245 496.65 90.194c-10.234-30.7-28.142-58.842-53.726-76.75C427.574 3.21 404.548-1.906 384.081 0.652c-12.791 2.558-25.583 7.675-38.375 15.35-23.025 15.35-38.376 40.934-48.61 66.518-12.791 46.05-15.35 92.101-2.557 138.152 10.233 28.142 25.583 56.284 51.167 76.75z m255.837 2.558c17.909 15.35 40.934 25.584 63.96 25.584 20.466 2.558 38.375-2.558 56.283-12.792 17.909-10.233 33.26-25.584 43.493-43.492 12.792-20.467 23.025-40.934 30.7-63.96 5.117-17.908 7.675-38.375 5.117-58.842-2.559-28.142-15.35-53.726-33.259-76.751-12.792-15.35-28.142-30.7-46.05-38.376-12.792-5.116-28.143-10.233-40.935-7.675-17.908 2.559-33.258 12.792-46.05 23.026-17.909 15.35-33.259 33.258-43.493 53.725-10.233 17.909-20.466 38.376-23.025 61.401-2.558 25.584-2.558 51.168 2.559 74.193 5.116 23.025 12.791 46.05 30.7 63.96zM245.929 509.768c17.91-15.35 28.143-35.818 35.818-56.285 10.233-33.258 10.233-66.517 7.675-99.776 0-12.792-5.117-25.584-10.234-38.376-12.792-28.142-35.817-53.725-63.959-69.076-23.025-10.233-46.05-15.35-66.518-10.233-25.583 2.558-46.05 20.467-61.4 40.934-20.467 28.142-30.7 63.96-35.818 97.218-2.558 20.467 0 40.934 5.117 61.4 7.675 30.701 23.025 58.843 46.05 79.31 17.91 15.35 40.935 23.026 63.96 23.026 28.142 0 56.284-7.675 79.31-28.142z m736.811-76.752c-2.558-20.467-7.675-38.375-17.908-56.284-10.234-20.467-28.143-40.934-48.61-51.167-23.025-12.792-51.167-15.35-76.75-12.792-12.792 2.558-28.143 5.117-40.935 12.792-17.908 10.233-30.7 28.142-40.933 48.609-10.234 25.584-15.35 53.726-15.35 81.868 0 25.583 0 53.726 7.674 79.31 5.117 17.908 15.35 38.375 33.26 48.608 17.908 15.35 40.933 20.467 63.959 23.026 17.908 2.558 38.375 2.558 56.284-2.559 17.908-5.116 35.817-15.35 46.05-30.7 12.792-15.35 20.467-35.817 23.026-53.726 12.792-30.7 10.233-58.842 10.233-86.985zM911.106 819.33c-2.559-35.817-20.467-71.634-46.05-99.776-5.118-5.117-10.234-10.234-17.91-15.35-33.258-28.142-66.517-58.843-99.776-89.543-33.259-33.26-63.96-69.076-92.101-107.452-20.467-33.259-48.61-63.96-86.985-81.868-23.025-10.233-51.167-15.35-76.751-12.792-46.05 5.117-86.985 30.7-115.127 66.518-7.675 7.675-12.791 17.909-17.908 28.142-20.467 30.7-46.05 61.401-74.193 86.985-15.35 15.35-30.7 28.142-46.05 40.934-7.676 7.675-17.91 15.35-25.584 23.025-30.7 23.025-61.401 53.726-79.31 86.985-12.792 23.025-20.467 48.609-23.025 76.75 0 23.026 2.558 46.051 10.233 66.518 7.675 23.026 17.909 46.051 33.26 63.96 25.583 30.7 63.958 51.167 102.334 53.725 48.609 2.559 97.218 0 143.269-7.675 20.467-2.558 40.934-10.233 63.959-12.792 46.05-5.116 92.101-2.558 135.594 10.234 35.817 12.792 74.192 17.909 112.568 20.467 38.375 2.558 79.31-2.558 115.127-23.025 25.583-12.792 46.05-35.818 58.842-61.401 20.467-33.26 30.7-71.635 25.584-112.569zM481.3 924.224H363.615c-12.792 0-25.584 0-38.376-2.559-25.584-5.117-48.61-20.467-63.96-43.492-12.791-15.35-20.466-33.259-23.025-53.726a246.563 246.563 0 0 1 0-61.4c5.117-23.026 17.909-43.493 33.26-58.843 12.791-12.792 30.7-23.026 48.608-30.7 7.675-2.56 15.35-5.117 23.026-5.117h69.076v-97.219h66.517c2.559 120.244 2.559 237.929 2.559 353.056z m263.512 0H583.634c-17.908-2.559-33.258-7.676-46.05-17.909-15.35-12.792-23.026-33.259-23.026-51.167v-173.97h66.518v161.178c0 7.675 2.558 12.792 7.675 17.908 5.117 5.117 12.792 7.675 20.467 7.675h69.076V678.62h66.518v245.604z" fill="#306CFF" p-id="1566"></path><path d="M340.59 734.904c-12.793 5.117-25.585 15.35-33.26 30.7-5.116 12.792-7.675 25.584-7.675 38.376 0 15.35 5.117 30.7 12.792 43.492 10.234 15.35 28.142 25.584 46.05 23.026h53.727V732.346H353.38c-2.558-2.559-7.675 0-12.792 2.558z" fill="#306CFF" p-id="1567"></path></svg>`, url: 'https://www.baidu.com/s?wd=' },
        { name: 'Google', icon: `<svg t="1750565700259" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2559" width="200" height="200"><path d="M214.101333 512c0-32.512 5.546667-63.701333 15.36-92.928L57.173333 290.218667A491.861333 491.861333 0 0 0 4.693333 512c0 79.701333 18.858667 154.88 52.394667 221.610667l172.202667-129.066667A290.56 290.56 0 0 1 214.101333 512" fill="#FBBC05" p-id="2560"></path><path d="M516.693333 216.192c72.106667 0 137.258667 25.002667 188.458667 65.962667L854.101333 136.533333C763.349333 59.178667 646.997333 11.392 516.693333 11.392c-202.325333 0-376.234667 113.28-459.52 278.826667l172.373334 128.853333c39.68-118.016 152.832-202.88 287.146666-202.88" fill="#EA4335" p-id="2561"></path><path d="M516.693333 807.808c-134.357333 0-247.509333-84.864-287.232-202.88l-172.288 128.853333c83.242667 165.546667 257.152 278.826667 459.52 278.826667 124.842667 0 244.053333-43.392 333.568-124.757333l-163.584-123.818667c-46.122667 28.458667-104.234667 43.776-170.026666 43.776" fill="#34A853" p-id="2562"></path><path d="M1005.397333 512c0-29.568-4.693333-61.44-11.648-91.008H516.650667V614.4h274.602666c-13.696 65.962667-51.072 116.650667-104.533333 149.632l163.541333 123.818667c93.994667-85.418667 155.136-212.650667 155.136-375.850667" fill="#4285F4" p-id="2563"></path></svg>`, url: 'https://www.google.com/search?q=' },
        { name: 'Bing', icon: `<svg t="1750565754331" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4482" width="200" height="200"><path d="M340.5824 70.109867L102.536533 0.682667v851.217066L340.650667 643.345067V70.109867zM102.536533 851.7632l238.045867 171.6224 580.881067-340.923733V411.784533L102.536533 851.831467z" fill="#1296db" p-id="4483"></path><path d="M409.463467 255.3856l113.732266 238.933333 138.8544 56.866134 259.413334-139.400534-506.0608-156.330666z" fill="#1296db" p-id="4484"></path></svg>`, url: 'https://www.bing.com/search?q=' },
        { name: 'Sogou', icon: `<svg t="1750565827458" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6537" width="200" height="200"><path d="M1015.062344 508.169576c0-280.897756-227.27182-508.169576-508.169576-508.169576C228.548628 0 1.276808 227.27182 1.276808 508.169576s227.27182 508.169576 508.169576 508.169576c66.394015 0 130.234414-12.76808 191.521197-38.304239 76.608479-30.643392 145.55611-81.715711 199.182045-148.109726 71.501247-86.822943 114.912718-199.182045 114.912718-321.755611zM677.985037 939.730673c-56.179551 17.875312-109.805486 30.643392-168.538653 30.643392-255.361596 0-462.204489-206.842893-462.204489-462.204489S254.084788 45.965087 509.446384 45.965087 971.650873 252.80798 971.650873 508.169576c0 112.359102-40.857855 217.057357-109.805486 298.773067-48.518703 58.733167-112.359102 104.698254-183.86035 132.78803z" fill="#FA4D23" p-id="6538"></path><path d="M499.23192 699.690773s-183.860349 2.553616-286.004987-91.930174L205.566085 737.995012s607.760599 219.610973 612.86783-132.788029c0 0 12.76808-84.269327-206.842893-143.002494 0 0-86.822943-20.428928-183.860349-76.608479 0 0-53.625935-61.286783 99.591023-48.518703 181.306733 15.321696 275.790524 61.286783 275.790523 61.286783V283.451372s-413.685786-155.770574-574.563591 22.982543c0 0-53.625935 81.715711 2.553616 132.78803s168.538653 114.912718 316.648379 153.216958c0-2.553616 191.521197 86.822943-48.518703 107.25187z" fill="#FA4D23" p-id="6539"></path></svg>`, url: 'https://www.sogou.com/web?query=' },
        { name: 'DuckDuckGo', icon: `<svg t="1750565847235" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7705" width="200" height="200"><path d="M28.16 509.44c0 268.8 217.6 486.4 486.4 486.4s486.4-217.6 486.4-486.4-217.6-486.4-486.4-486.4-486.4 217.6-486.4 486.4z" fill="#CC6633" p-id="7706"></path><path d="M64 512c0 247.296 200.704 448 448 448s448-200.704 448-448-200.704-448-448-448S64 264.704 64 512z" fill="#FFFFFF" p-id="7707"></path><path d="M934.912 516.096c0 199.68-138.24 367.616-324.096 412.672-11.264-21.504-22.016-42.496-31.232-59.904 31.744 28.16 70.144 38.912 91.648 25.6 27.648-16.896 37.376-78.848-5.632-135.168-13.312 0.512-30.72 2.56-50.176 8.192-27.648 8.192-48.128 20.992-61.44 30.72-11.776-17.92-28.16-48.64-36.352-89.6-6.656-33.28-5.12-61.952-2.56-81.408 14.848 10.24 113.664 43.52 162.816 42.496s129.536-30.72 120.832-54.784-88.576 20.992-172.544 13.312c-61.952-5.632-72.704-33.28-58.88-53.76 17.408-25.6 48.64 4.608 100.352-10.752 51.712-15.36 124.416-43.008 151.04-58.368 61.952-34.816-26.112-49.152-46.592-39.424-19.968 9.216-88.064 26.624-120.32 34.304 17.92-62.976-25.088-172.544-73.216-220.672-15.872-15.872-39.424-25.6-66.56-30.72-10.24-14.336-27.136-28.16-51.2-40.448-46.08-24.064-98.304-32.768-149.504-24.064h-2.56c-6.144 1.024-9.728 3.584-14.848 4.096 6.144 0.512 29.184 11.264 44.032 17.408-7.168 3.072-16.896 4.608-24.576 7.68-3.072 0.512-5.632 1.024-8.704 2.56-7.168 3.072-12.8 15.36-12.288 21.504 34.816-3.584 86.528-1.024 124.416 10.24-26.624 3.584-51.2 10.752-69.12 19.968-0.512 0.512-1.024 0.512-2.048 1.024-2.048 1.024-4.608 1.536-6.144 2.56-56.832 29.696-81.92 99.84-67.072 183.808 13.312 75.776 69.12 336.384 95.232 460.288-164.352-56.32-282.624-214.016-282.624-399.36 0-235.008 190.464-424.96 424.96-424.96s424.96 190.464 424.96 424.96z" fill="#DE5833" p-id="7708"></path><path d="M357.376 446.976c0 17.408 14.336 31.744 31.744 31.744s31.744-14.336 31.744-31.744c0-17.408-14.336-31.744-31.744-31.744s-31.744 14.336-31.744 31.744zM599.552 401.408c-14.848-0.512-27.648 11.264-28.16 26.112-0.512 14.848 11.264 27.648 26.112 28.16h2.048c14.848 0 27.136-12.288 27.136-27.136s-12.288-27.136-27.136-27.136z m-201.728-45.568s-23.552-10.752-46.592 3.584c-23.04 14.848-22.016 29.696-22.016 29.696s-12.288-27.136 20.48-40.448c32.256-13.824 48.64 7.168 48.128 7.168z m218.112-2.048s-16.896-9.728-30.208-9.728c-27.136 0.512-34.816 12.288-34.816 12.288s4.608-28.672 39.424-23.04c11.264 2.56 20.992 9.728 25.6 20.48z" fill="#336699" p-id="7709"></path><path d="M549.376 522.24c24.576-9.728 35.328-9.728 74.24-17.408 24.576-5.12 56.832-11.776 94.72-23.552 30.208-9.216 36.864-13.824 56.32-15.36 26.112-2.048 62.464 1.024 66.56 15.36 2.048 6.656-4.608 13.824-10.24 20.48-14.336 16.384-32.256 22.016-61.44 30.72-36.352 11.264-38.912 11.264-51.2 15.36-58.368 18.432-55.296 23.552-76.8 25.6-38.912 3.584-60.928-12.8-71.68 0-6.656 8.192-4.608 22.016 0 30.72 6.656 11.776 19.968 15.36 40.96 20.48 25.6 6.144 46.08 5.632 51.2 5.12 18.432-1.024 31.744-4.608 51.2-10.24 40.96-11.776 52.736-21.504 71.68-15.36 3.584 1.024 19.456 6.144 20.48 15.36 2.048 18.432-53.76 43.52-102.4 51.2-47.104 7.168-86.528-2.56-97.28-5.12-7.168-2.048-19.968-6.144-46.08-15.36-29.696-10.24-37.376-13.824-46.08-20.48-9.216-7.168-23.04-17.92-25.6-35.84-2.56-18.432 9.216-33.28 15.36-40.96 9.216-11.264 21.504-20.992 46.08-30.72z" fill="#FDD20A" p-id="7710"></path><path d="M523.776 798.72c4.096-3.584 9.216-7.168 15.36-10.24 11.776-6.144 22.528-9.216 30.72-10.24-1.536 3.584-3.584 6.656-5.12 10.24 14.336-7.168 29.696-13.824 46.08-20.48 25.088-10.24 49.152-18.432 71.68-25.6 7.68 12.288 22.016 36.864 25.6 71.68 3.584 35.328-5.12 63.488-10.24 76.8-6.144 3.584-32.768 17.408-66.56 10.24s-51.712-30.208-56.32-35.84c-1.536 5.12-3.584 10.24-5.12 15.36-5.632 1.024-14.848 2.048-25.6 0-11.776-2.048-20.48-7.168-25.6-10.24-24.064 11.776-47.616 24.064-71.68 35.84-3.584 4.608-9.728 6.656-15.36 5.12-7.68-2.048-10.24-9.728-10.24-10.24-5.632-16.896-11.264-37.888-15.36-61.44-4.096-25.088-5.12-47.616-5.12-66.56-2.048-6.144 0.512-12.8 5.12-15.36s9.728-0.512 10.24 0c18.944 2.56 44.544 7.68 71.68 20.48 13.824 6.656 26.112 13.824 35.84 20.48z" fill="#66CC33" p-id="7711"></path></svg>`, url: 'https://duckduckgo.com/?q=' },
    ];

    // 状态管理
    let pexelsApiKey = '';
    let currentSearchEngine = searchEngines[0];
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

    const renderWallpaperGrid = (photos) => {
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
                    chrome.storage.local.set({
                        savedWallpaperId: photo.id,
                        savedWallpaperUrl: wallpaperUrl,
                        savedWallpaperData: {
                            id: photo.id,
                            url: wallpaperUrl,
                            photographer: photo.photographer,
                            alt: photo.alt
                        }
                    }, resolve);
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
            return button;
        };
    
        // 上一页按钮
        const prevButton = createButton('上一页', currentWallpaperPage - 1, currentWallpaperPage === 1);
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
        const nextButton = createButton('下一页', currentWallpaperPage + 1, currentWallpaperPage >= totalPages);
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
    
        // 1. 尝试加载已缓存的壁纸
        const result = await new Promise(resolve => chrome.storage.local.get(['savedWallpaperId', 'savedWallpaperUrl', 'savedWallpaperData'], resolve));
        
        if (result.savedWallpaperUrl) {
            // 优先使用缓存的URL，避免网络请求
            wallpaperContainer.style.backgroundImage = `url('${result.savedWallpaperUrl}')`;
            console.log('使用缓存的壁纸URL');
            
            // 异步验证壁纸是否仍然有效
            if (result.savedWallpaperId) {
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
                console.error(`获取已保存壁纸(ID: ${id})失败，状态: ${response.status}。将移除该ID。`);
                await new Promise(resolve => chrome.storage.local.remove(['savedWallpaperId', 'savedWallpaperUrl', 'savedWallpaperData'], resolve));
                return false;
            }
            const photo = await response.json();
            const wallpaperUrl = photo.src.large2x;
            wallpaperContainer.style.backgroundImage = `url('${wallpaperUrl}')`;
            
            // 保存壁纸信息到缓存
            await new Promise(resolve => {
                chrome.storage.local.set({
                    savedWallpaperId: photo.id,
                    savedWallpaperUrl: wallpaperUrl,
                    savedWallpaperData: {
                        id: photo.id,
                        url: wallpaperUrl,
                        photographer: photo.photographer,
                        alt: photo.alt
                    }
                }, resolve);
            });
            
            console.log(`成功加载并缓存壁纸 (ID: ${id})`);
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
                const wallpaperUrl = photo.src.large2x;
                wallpaperContainer.style.backgroundImage = `url('${wallpaperUrl}')`;
                
                if (shouldSave) {
                    await new Promise(resolve => {
                        chrome.storage.local.set({
                            savedWallpaperId: photo.id,
                            savedWallpaperUrl: wallpaperUrl,
                            savedWallpaperData: {
                                id: photo.id,
                                url: wallpaperUrl,
                                photographer: photo.photographer,
                                alt: photo.alt
                            }
                        }, resolve);
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

    // --- 搜索历史 ---
    const getSearchHistory = async () => {
        return new Promise((resolve) => {
            chrome.storage.local.get({ searchHistory: [] }, (data) => {
                resolve(data.searchHistory);
            });
        });
    };

    const saveSearchHistory = async (history) => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ searchHistory: history }, () => {
                resolve();
            });
        });
    };

    const addSearchTermToHistory = async (term) => {
        let history = await getSearchHistory();
        // 移除已存在的相同项，以移动到顶部
        history = history.filter(item => item !== term);
        // 添加到最前面
        history.unshift(term);
        // 保持最大数量
        if (history.length > MAX_HISTORY_ITEMS) {
            history.pop();
        }
        await saveSearchHistory(history);
    };

    const removeSearchTermFromHistory = async (term) => {
        let history = await getSearchHistory();
        history = history.filter(item => item !== term);
        await saveSearchHistory(history);
        await renderSearchHistory(); // 重新渲染
    };

    const renderSearchHistory = async () => {
        const history = await getSearchHistory();
        historyItemsContainer.innerHTML = '';

        if (history.length === 0) {
            searchHistoryDropdown.classList.add('u-hidden');
            clearHistoryContainer.classList.add('u-hidden');
            return;
        }

        clearHistoryContainer.classList.remove('u-hidden');

        history.forEach(term => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const text = document.createElement('span');
            text.className = 'history-text';
            text.textContent = term;
            text.addEventListener('click', () => {
                searchInput.value = term;
                handleSearch();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-history-btn';
            deleteBtn.innerHTML = `&times;`; // 使用 HTML 实体 "×"
            deleteBtn.title = '删除此条记录';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到输入框的 blur 事件
                removeSearchTermFromHistory(term);
            });

            item.appendChild(text);
            item.appendChild(deleteBtn);
            historyItemsContainer.appendChild(item);
        });

        searchHistoryDropdown.classList.remove('u-hidden');
    };

    // 搜索功能已移至模块化架构，事件绑定在 app.js 中处理

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

    // 搜索引擎显示更新已移至模块化架构

    // 搜索引擎选择功能已移至模块化架构
    
    // 搜索引擎下拉菜单渲染已移至模块化架构

    // 搜索引擎功能已移至模块化架构，在 app.js 中处理
    await loadApiKey(); // 确保在获取壁纸前加载API Key
    
    // 添加调试信息
    console.log('开始初始化壁纸...');
    const cachedData = await new Promise(resolve => chrome.storage.local.get(['savedWallpaperId', 'savedWallpaperUrl', 'savedWallpaperData'], resolve));
    console.log('缓存的壁纸数据:', cachedData);
    
    fetchAndSetWallpaper();
    initVisibilityToggle();
    renderCategories();
    // 搜索引擎相关功能已在模块化架构中处理
    searchSubmitBtn.innerHTML = searchIcon;
    clearSearchBtn.innerHTML = clearIcon;

    clearAllHistoryBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        
        // 添加二次确认
        if (window.confirm('您确定要清空所有搜索记录吗？此操作无法撤销。')) {
            await saveSearchHistory([]);
            await renderSearchHistory();
        }
    });

    // 快捷访问功能已移至模块化架构，在 app.js 中处理
    
    // Event listener for the cancel button in the new quick access modal
    cancelQaBtn.addEventListener('click', () => {
        addQuickAccessPanel.classList.add('u-hidden');
    });

    // Event listener for clicking outside the modal to close it
    addQuickAccessPanel.addEventListener('click', (e) => {
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
        
        const data = await new Promise(resolve => chrome.storage.local.get({ quickAccessSites: [] }, resolve));
        const sites = data.quickAccessSites;

        if (editIndex > -1) {
            sites[editIndex] = newSite; // Update existing
        } else {
            sites.push(newSite); // Add new
        }
        
        await new Promise(resolve => chrome.storage.local.set({ quickAccessSites: sites }, resolve));
        
        // 重新渲染快捷访问列表
        if (window.app && window.app.renderQuickAccess) {
            window.app.renderQuickAccess();
        }
        
        addQuickAccessPanel.classList.add('u-hidden');
    });

    const quickAccessGrid = document.getElementById('quick-access-grid');

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
            const urlPattern = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?.*)?(#[-a-z\d_]*)?$/i;
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

    quickAccessGrid.addEventListener('click', async (e) => {
        const item = e.target.closest('.quick-access-item');

        if (e.target.classList.contains('edit-btn') || e.target.classList.contains('delete-btn')) {
            e.preventDefault(); // Prevent navigation when clicking edit/delete buttons
            
            // 检查item是否存在，避免null错误
            if (!item) return;
            
            const index = parseInt(item.dataset.index, 10);
            const data = await new Promise(resolve => chrome.storage.local.get({ quickAccessSites: [] }, resolve));
            const sites = data.quickAccessSites;

            if (e.target.classList.contains('edit-btn')) {
                const siteToEdit = sites[index];

                qaPanelTitle.textContent = '编辑快捷方式';
                qaEditIndexInput.value = index;
                qaUrlInput.value = siteToEdit.url;
                qaNameInput.value = siteToEdit.name;
                qaIconInput.value = siteToEdit.icon || '';
                
                qaIconInput.dispatchEvent(new Event('input')); // Trigger preview
                validateQuickAccessForm();

                addQuickAccessPanel.classList.remove('u-hidden');
                exitDeleteMode();

            } else if (e.target.classList.contains('delete-btn')) {
                // 显示自定义删除确认弹窗
                const deleteModal = document.getElementById('delete-confirm-modal');
                const deleteConfirmText = document.getElementById('delete-confirm-text');
                const deleteConfirmDelete = document.getElementById('delete-confirm-delete');
                const deleteConfirmCancel = document.getElementById('delete-confirm-cancel');
                
                if (deleteModal && deleteConfirmText && deleteConfirmDelete && deleteConfirmCancel) {
                    deleteConfirmText.textContent = `您确定要删除 "${sites[index].name}" 吗？`;
                    deleteModal.classList.remove('u-hidden');
                    
                    // 绑定删除确认事件
                    const handleDelete = async () => {
                    sites.splice(index, 1);
                    await new Promise(resolve => chrome.storage.local.set({ quickAccessSites: sites }, resolve));
                        
                        // 重新渲染快捷访问列表
                        if (window.app && window.app.renderQuickAccess) {
                            window.app.renderQuickAccess();
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
            }
        } else if (e.target.closest('.add-quick-access-btn')) {
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
        editOption.onmouseover = () => editOption.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        editOption.onmouseout = () => editOption.style.backgroundColor = 'transparent';
        editOption.onclick = async () => {
            const data = await new Promise(resolve => chrome.storage.local.get({ quickAccessSites: [] }, resolve));
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
        deleteOption.onmouseover = () => deleteOption.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
        deleteOption.onmouseout = () => deleteOption.style.backgroundColor = 'transparent';
        deleteOption.onclick = async () => {
            // 显示自定义删除确认弹窗
            const deleteModal = document.getElementById('delete-confirm-modal');
            const deleteConfirmText = document.getElementById('delete-confirm-text');
            const deleteConfirmDelete = document.getElementById('delete-confirm-delete');
            const deleteConfirmCancel = document.getElementById('delete-confirm-cancel');
            
            if (deleteModal && deleteConfirmText && deleteConfirmDelete && deleteConfirmCancel) {
                deleteConfirmText.textContent = `您确定要删除 "${siteName}" 吗？`;
                deleteModal.classList.remove('u-hidden');
                menu.remove(); // 隐藏右键菜单
                
                // 绑定删除确认事件
                const handleDelete = async () => {
                    const data = await new Promise(resolve => chrome.storage.local.get({ quickAccessSites: [] }, resolve));
                    const sites = data.quickAccessSites;
                    sites.splice(index, 1);
                    await new Promise(resolve => chrome.storage.local.set({ quickAccessSites: sites }, resolve));
                    
                    // 重新渲染快捷访问列表
                    if (window.app && window.app.renderQuickAccess) {
                        window.app.renderQuickAccess();
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
        const closeMenu = (e) => {
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
    quickAccessGrid.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.quick-access-item');
        if (item && !item.classList.contains('add-quick-access-btn')) {
            showContextMenu(e, item);
        }
    });






});

// 快捷访问功能已移至模块化架构，在 app.js 中处理

// 传统渲染方式已移除，使用模块化架构
