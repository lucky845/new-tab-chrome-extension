// 常用快捷访问
const defaultSites = [
    { name: 'Google', url: 'https://www.google.com', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.75 8.36,4.73 12.19,4.73C14.03,4.73 15.6,5.33 16.8,6.39L18.83,4.54C16.94,2.83 14.7,2 12.19,2C6.92,2 2.71,6.23 2.71,12C2.71,17.77 6.92,22 12.19,22C17.6,22 21.54,18.33 21.54,12.29C21.54,11.84 21.49,11.45 21.35,11.1Z" /></svg>' },
    { name: 'YouTube', url: 'https://www.youtube.com', icon: '<svg t="1750573150870" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="17200" width="200" height="200"><path d="M960 509.2c0-2.2 0-4.7-0.1-7.6-0.1-8.1-0.3-17.2-0.5-26.9-0.8-27.9-2.2-55.7-4.4-81.9-3-36.1-7.4-66.2-13.4-88.8-12.8-47.9-50.4-85.6-98.3-98.5-28.3-7.6-83.7-12.3-161.7-15.2-37.1-1.4-76.8-2.3-116.5-2.8-13.9-0.2-26.8-0.3-38.4-0.4H497.3c-11.6 0.1-24.5 0.2-38.4 0.4-39.7 0.5-79.4 1.4-116.5 2.8-78 3-133.5 7.7-161.7 15.2-47.8 12.8-85.5 50.5-98.3 98.5-6.1 22.6-10.4 52.7-13.4 88.8-2.2 26.2-3.6 54-4.4 81.9-0.3 9.7-0.4 18.8-0.5 26.9 0 2.9-0.1 5.4-0.1 7.6v5.6c0 2.2 0 4.7 0.1 7.6 0.1 8.1 0.3 17.2 0.5 26.9 0.8 27.9 2.2 55.7 4.4 81.9 3 36.1 7.4 66.2 13.4 88.8 12.8 47.9 50.4 85.7 98.3 98.5 28.2 7.6 83.7 12.3 161.7 15.2 37.1 1.4 76.8 2.3 116.5 2.8 13.9 0.2 26.8 0.3 38.4 0.4H526.7c11.6-0.1 24.5-0.2 38.4-0.4 39.7-0.5 79.4-1.4 116.5-2.8 78-3 133.5-7.7 161.7-15.2 47.9-12.8 85.5-50.5 98.3-98.5 6.1-22.6 10.4-52.7 13.4-88.8 2.2-26.2 3.6-54 4.4-81.9 0.3-9.7 0.4-18.8 0.5-26.9 0-2.9 0.1-5.4 0.1-7.6V512v-2.8z m-72 5.2c0 2.1 0 4.4-0.1 7.1-0.1 7.8-0.3 16.4-0.5 25.7-0.7 26.6-2.1 53.2-4.2 77.9-2.7 32.2-6.5 58.6-11.2 76.3-6.2 23.1-24.4 41.4-47.4 47.5-21 5.6-73.9 10.1-145.8 12.8-36.4 1.4-75.6 2.3-114.7 2.8-13.7 0.2-26.4 0.3-37.8 0.3h-28.6c-11.4-0.1-24.1-0.2-37.8-0.3-39.1-0.5-78.2-1.4-114.7-2.8-71.9-2.8-124.9-7.2-145.8-12.8-23-6.2-41.2-24.4-47.4-47.5-4.7-17.7-8.5-44.1-11.2-76.3-2.1-24.7-3.4-51.3-4.2-77.9-0.3-9.3-0.4-18-0.5-25.7 0-2.7-0.1-5.1-0.1-7.1v-3-1.8c0-2.1 0-4.4 0.1-7.1 0.1-7.8 0.3-16.4 0.5-25.7 0.7-26.6 2.1-53.2 4.2-77.9 2.7-32.2 6.5-58.6 11.2-76.3 6.2-23.1 24.4-41.4 47.4-47.5 21-5.6 73.9-10.1 145.8-12.8 36.4-1.4 75.6-2.3 114.7-2.8 13.7-0.2 26.4-0.3 37.8-0.3h28.6c11.4 0.1 24.1 0.2 37.8 0.3 39.1 0.5 78.2 1.4 114.7 2.8 71.9 2.8 124.9 7.2 145.8 12.8 23 6.2 41.2 24.4 47.4 47.5 4.7 17.7 8.5 44.1 11.2 76.3 2.1 24.7 3.4 51.3 4.2 77.9 0.3 9.3 0.4 18 0.5 25.7 0 2.7 0.1 5.1 0.1 7.1v4.8z" p-id="17201" fill="#ffffff"></path><path d="M423 646l232-135-232-133z" p-id="17202" fill="#ffffff"></path></svg>' },
    { name: 'GitHub', url: 'https://www.github.com', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.83,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z" /></svg>' },
    { name: 'Bilibili', url: 'https://www.bilibili.com', icon: '<svg t="1750573104242" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="16161" width="200" height="200"><path d="M306.005333 117.632L444.330667 256h135.296l138.368-138.325333a42.666667 42.666667 0 1 1 60.373333 60.373333l-78.037333 77.952L789.333333 256A149.333333 149.333333 0 0 1 938.666667 405.333333v341.333334a149.333333 149.333333 0 0 1-149.333334 149.333333h-554.666666A149.333333 149.333333 0 0 1 85.333333 746.666667v-341.333334A149.333333 149.333333 0 0 1 234.666667 256h88.96L245.632 177.962667a42.666667 42.666667 0 0 1 60.373333-60.373334zM789.333333 341.333333h-554.666666a64 64 0 0 0-63.701334 57.856L170.666667 405.333333v341.333334a64 64 0 0 0 57.856 63.701333L234.666667 810.666667h554.666666a64 64 0 0 0 63.701334-57.813334L853.333333 746.666667v-341.333334A64 64 0 0 0 789.333333 341.333333zM341.333333 469.333333a42.666667 42.666667 0 0 1 42.666667 42.666667v85.333333a42.666667 42.666667 0 1 1-85.333333 0v-85.333333a42.666667 42.666667 0 0 1 42.666666-42.666667z m341.333334 0a42.666667 42.666667 0 0 1 42.666666 42.666667v85.333333a42.666667 42.666667 0 1 1-85.333333 0v-85.333333a42.666667 42.666667 0 0 1 42.666667-42.666667z" p-id="16162" fill="#ffffff"></path></svg>' },
    { name: '知乎', url: 'https://www.zhihu.com', icon: '<svg t="1750573074129" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15126" width="200" height="200"><path d="M544.949 561.422s0-71.387-34.779-75.050c-34.779-3.663-142.775 0-142.775 0v-219.654h161.078s-1.83-73.219-32.949-73.219h-261.755l43.93-117.148s-65.897 3.663-89.692 45.761-98.844 252.604-98.844 252.604 25.627 10.983 67.726-20.134c42.101-31.116 56.743-86.033 56.743-86.033l76.879-3.663 1.83 223.316s-133.621-1.83-161.078 0c-27.457 1.83-42.101 75.050-42.101 75.050h203.182s-18.307 124.47-69.557 214.164c-53.085 89.692-151.929 161.078-151.929 161.078s71.387 29.287 140.947-10.983c69.557-42.101 120.811-223.316 120.811-223.316l162.912 203.182s14.643-97.013-1.83-124.47c-18.307-27.457-113.49-137.283-113.49-137.283l-42.101 36.607 29.287-120.811h177.552zM587.050 188.010l-1.83 660.793h65.897l23.795 82.37 115.321-82.37h162.912v-660.793h-366.091zM879.92 775.584h-76.879l-97.013 75.050-21.965-75.050h-20.134v-512.527h215.991v512.527z" fill="#ffffff" p-id="15127"></path></svg>' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: '<svg t="1750573259703" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="20897" width="200" height="200"><path d="M515.84 559.744c-39.936 82.432-94.592 194.048-121.728 244.394667-26.282667 45.824-48.085333 39.722667-65.365333 1.237333-59.989333-141.696-183.168-390.144-241.109334-529.450667-10.709333-25.642667-18.816-42.112-26.410666-48.597333-7.722667-6.4-23.637333-10.24-47.872-11.562667C4.394667 214.741333 0 212.565333 0 208.981333v-19.413333l2.218667-1.92c39.424-0.213333 230.442667 0 230.442666 0l2.176 1.92v18.517333c0 5.077333-3.2 7.509333-9.6 7.509334l-24.064 1.322666c-20.693333 1.237333-31.018667 6.997333-31.018666 18.602667 0 5.76 2.261333 14.08 7.082666 25.642667 46.165333 112.896 205.568 448.896 205.568 448.896l5.802667 1.962666 102.869333-205.226666-20.565333-45.525334-70.741333-139.264s-13.568-27.904-18.261334-37.205333c-31.061333-61.568-30.378667-64.768-61.738666-68.992-8.832-0.981333-13.354667-2.133333-13.354667-6.357333v-19.968l2.56-1.92h183.125333l4.821334 1.578666v19.242667c0 4.48-3.242667 6.4-9.685334 6.4l-13.141333 2.005333c-33.792 2.602667-28.202667 16.256-5.802667 60.672l67.498667 138.752 75.008-149.504c12.501333-27.306667 9.941333-34.176 4.736-40.405333-2.986667-3.584-13.013333-9.386667-34.645333-10.24l-8.576-0.896a9.728 9.728 0 0 1-6.186667-2.176 6.4 6.4 0 0 1-2.858667-5.504v-18.218667l2.602667-1.92c53.205333-0.341333 172.501333 0 172.501333 0l2.517334 1.92v18.602667c0 5.162667-2.517333 7.594667-8.234667 7.594667-27.562667 1.28-33.365333 4.053333-43.648 18.730666-5.12 7.936-16 25.130667-27.562667 44.330667l-98.176 182.314667-2.773333 5.76 119.125333 243.712 7.253334 2.048 187.562666-445.354667c6.570667-18.005333 5.504-30.805333-2.730666-38.186667-8.405333-7.338667-14.762667-11.648-36.565334-12.586666l-17.92-0.682667a10.88 10.88 0 0 1-6.485333-1.92c-1.834667-1.237333-3.072-3.2-3.072-5.077333v-18.602667l2.517333-1.92h211.669334l1.749333 1.92v18.645333c0 5.077333-3.157333 7.68-8.917333 7.68-27.648 1.28-48.085333 7.68-61.568 17.962667-13.397333 10.88-23.765333 26.282667-31.402667 45.525333 0 0-172.501333 395.008-231.509333 526.464-22.4 42.965333-44.928 39.125333-64.128-1.322666-24.362667-49.962667-75.648-161.536-112.896-243.626667l2.261333-1.536z" fill="#ffffff" p-id="20898"></path></svg>' },
    { name: 'Reddit', url: 'https://www.reddit.com', icon: '<svg t="1750573220041" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="19053" width="200" height="200"><path d="M344 568m-56 0a56 56 0 1 0 112 0 56 56 0 1 0-112 0Z" p-id="19054" fill="#ffffff"></path><path d="M626.7 687.7c-23.1 18.2-68.9 37.8-114.7 37.8s-91.6-19.6-114.7-37.8c-14.4-11.3-35.3-8.9-46.7 5.5s-8.9 35.3 5.5 46.7C396.3 771.6 457.5 792 512 792s115.7-20.4 155.9-52.1c14.4-11.4 16.9-32.3 5.5-46.7-11.3-14.4-32.3-16.9-46.7-5.5z" p-id="19055" fill="#ffffff"></path><path d="M960 456c0-61.9-50.1-112-112-112-42.1 0-78.7 23.2-97.9 57.6-57.6-31.5-127.7-51.8-204.1-56.5L612.9 195l127.9 36.9c11.5 32.6 42.6 56.1 79.2 56.1 46.4 0 84-37.6 84-84s-37.6-84-84-84c-32 0-59.8 17.9-74 44.2L603.5 123c-16-4.6-32.8 3.2-39.6 18.4l-90.8 203.9c-74.5 5.2-142.9 25.4-199.2 56.2-19.1-34.3-55.8-57.5-97.9-57.5-61.9 0-112 50.1-112 112 0 45.8 27.5 85.1 66.8 102.5-7.1 21-10.8 43-10.8 65.5 0 154.6 175.5 280 392 280s392-125.4 392-280c0-22.6-3.8-44.5-10.8-65.5C932.5 541.1 960 501.8 960 456zM820 172.5c17.4 0 31.5 14.1 31.5 31.5s-14.1 31.5-31.5 31.5-31.5-14.1-31.5-31.5 14.1-31.5 31.5-31.5zM120 456c0-30.9 25.1-56 56-56 22.3 0 41.6 13.1 50.6 32.1-29.3 22.2-53.5 47.8-71.5 75.9-20.5-8.3-35.1-28.5-35.1-52z m392 381.5c-179.8 0-325.5-95.6-325.5-213.5S332.2 410.5 512 410.5 837.5 506.1 837.5 624 691.8 837.5 512 837.5zM868.8 508c-17.9-28.1-42.2-53.7-71.5-75.9 9-18.9 28.3-32.1 50.6-32.1 30.9 0 56 25.1 56 56 0.1 23.5-14.5 43.7-35.1 52z" p-id="19056" fill="#ffffff"></path><path d="M680 568m-56 0a56 56 0 1 0 112 0 56 56 0 1 0-112 0Z" p-id="19057" fill="#ffffff"></path></svg>' },
    { name: 'V2EX', url: 'https://www.v2ex.com', icon: '<svg t="1750573003922" class="icon" viewBox="0 0 1025 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="14105" width="200" height="200"><path d="M0 360.608V146.304v-0.096c0-39.104 30.688-71.04 69.312-73.056H585.472c13.856 0 26.432 5.6 35.552 14.624l385.472 385.472c11.552 11.616 18.688 27.648 18.688 45.344s-7.136 33.728-18.688 45.344L634.208 935.488a50.24 50.24 0 0 1-35.52 14.624H69.568a73.184 73.184 0 0 1-69.472-72.384v-219.456h512l138.24-134.592a13.184 13.184 0 0 0-0.032-18.304l-138.24-134.592h-512z" p-id="14106" fill="#ffffff"></path></svg>' },
];

document.addEventListener('DOMContentLoaded', async () => {
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

    const handleSearch = async () => {
        const query = searchInput.value.trim();
        if (query) {
            await addSearchTermToHistory(query);
            const url = `${currentSearchEngine.url}${encodeURIComponent(query)}`;
            window.location.href = url;
        }
    };

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // 阻止默认行为，确保我们的异步保存能完成
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

    // --- 搜索引擎 ---
    const updateSelectedEngineDisplay = () => {
        selectedEngine.innerHTML = `${currentSearchEngine.icon}<div class="arrow-down"></div>`;
    };

    const selectSearchEngine = (engine) => {
        currentSearchEngine = engine;
        chrome.storage.local.set({ searchEngine: engine.name });
        updateSelectedEngineDisplay();
        closeSearchDropdown();
    };

    const openSearchDropdown = () => {
        searchEngineDropdown.classList.remove('u-hidden');
        searchEngineSelector.classList.add('open');
    };

    const closeSearchDropdown = () => {
        searchEngineDropdown.classList.add('u-hidden');
        searchEngineSelector.classList.remove('open');
    };
    
    const renderSearchEngineDropdown = () => {
        searchEngineDropdown.innerHTML = '';
        searchEngines.forEach(engine => {
            const item = document.createElement('div');
            item.className = 'search-engine-item';
            item.innerHTML = `${engine.icon}<span>${engine.name}</span>`;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSearchEngine(engine);
            });
            searchEngineDropdown.appendChild(item);
        });
    };

    const loadSearchEngine = () => {
        chrome.storage.local.get('searchEngine', (result) => {
            if (result.searchEngine) {
                const savedEngine = searchEngines.find(e => e.name === result.searchEngine);
                if (savedEngine) {
                    currentSearchEngine = savedEngine;
                }
            }
            updateSelectedEngineDisplay();
        });
    };

    searchEngineSelector.addEventListener('click', (e) => {
        e.stopPropagation();
        if (searchEngineDropdown.classList.contains('u-hidden')) {
            openSearchDropdown();
        } else {
            closeSearchDropdown();
        }
    });
    
    // 当点击输入框时，如果输入框为空，则显示历史记录
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
        if (searchInput.value.trim() === '') {
            renderSearchHistory();
        }
    });

    // 当输入框失去焦点时，检查焦点移动的目标元素
    searchInput.addEventListener('blur', (e) => {
        // 如果焦点转移到了历史记录列表之外的元素，则隐藏列表
        // e.relatedTarget 是下一个获得焦点的元素
        if (!searchHistoryDropdown.contains(e.relatedTarget)) {
            searchHistoryDropdown.classList.add('u-hidden');
        }
    });

    searchInput.addEventListener('input', () => {
        // 用户开始输入时，隐藏历史记录
        if (!searchHistoryDropdown.classList.contains('u-hidden')) {
            searchHistoryDropdown.classList.add('u-hidden');
        }

        if (searchInput.value.length > 0) {
            clearSearchBtn.classList.add('visible');
        } else {
            clearSearchBtn.classList.remove('visible');
        }
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        clearSearchBtn.classList.remove('visible');
    });

    searchSubmitBtn.addEventListener('click', handleSearch);

    loadSearchEngine();
    await loadApiKey(); // 确保在获取壁纸前加载API Key
    fetchAndSetWallpaper();
    initVisibilityToggle();
    renderCategories();
    renderSearchEngineDropdown();
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

    initializeQuickAccess(); // This now handles loading and rendering
    
    // Event listener for the cancel button in the new quick access modal
    cancelQaBtn.addEventListener('click', () => {
        addQuickAccessPanel.classList.add('hidden');
    });

    // Event listener for clicking outside the modal to close it
    addQuickAccessPanel.addEventListener('click', (e) => {
        if (e.target === addQuickAccessPanel) {
            addQuickAccessPanel.classList.add('hidden');
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
        renderQuickAccess(sites);
        addQuickAccessPanel.classList.add('hidden');
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
            qaUrlError.classList.add('hidden');
        } else {
            const urlPattern = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?.*)?(#[-a-z\d_]*)?$/i;
            if (urlPattern.test(url)) {
                qaUrlInput.classList.remove('invalid');
                qaUrlError.classList.add('hidden');
                isUrlValid = true;
            } else {
                qaUrlInput.classList.add('invalid');
                qaUrlError.textContent = '请输入有效的网址。';
                qaUrlError.classList.remove('hidden');
            }
        }

        // Name Validation
        if (name.length === 0) {
            qaNameInput.classList.remove('invalid');
            qaNameError.classList.add('hidden');
        } else {
            if (name.length >= 2 && name.length <= 10) {
                qaNameInput.classList.remove('invalid');
                qaNameError.classList.add('hidden');
                isNameValid = true;
            } else {
                qaNameInput.classList.add('invalid');
                qaNameError.textContent = '名称长度应在 2 到 10 个字符之间。';
                qaNameError.classList.remove('hidden');
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
            qaIconPreviewContainer.classList.remove('hidden');
        } else if (input.match(/\.(jpeg|jpg|gif|png|svg)$/) || input.startsWith('http')) {
            qaIconPreview.innerHTML = `<img src="${input}" alt="Icon Preview">`;
            qaIconPreviewContainer.classList.remove('hidden');
        } else {
            qaIconPreviewContainer.classList.add('hidden');
            qaIconPreview.innerHTML = '';
        }
    });

    quickAccessGrid.addEventListener('click', async (e) => {
        const item = e.target.closest('.quick-access-item');

        if (isDeleteMode) {
            e.preventDefault(); // Prevent navigation when in delete mode
            
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

                addQuickAccessPanel.classList.remove('hidden');
                exitDeleteMode();

            } else if (e.target.classList.contains('delete-btn')) {
                const confirmDelete = window.confirm(`您确定要删除 "${sites[index].name}" 吗？`);
                if (confirmDelete) {
                    sites.splice(index, 1);
                    await new Promise(resolve => chrome.storage.local.set({ quickAccessSites: sites }, resolve));
                    renderQuickAccess(sites); // Re-render
                    // After deleting, we might want to stay in delete mode if there are other items
                    // Or exit if it was the last one. For simplicity, we'll exit.
                    exitDeleteMode();
                }
            }
        } else if (e.target.closest('.add-quick-access-btn')) {
            qaPanelTitle.textContent = '添加快捷方式';
            qaEditIndexInput.value = '-1';
            
            // Reset form for new entry
            qaUrlInput.value = '';
            qaNameInput.value = '';
            qaIconInput.value = '';
            qaIconPreviewContainer.classList.add('hidden');
            qaUrlInput.classList.remove('invalid');
            qaNameInput.classList.remove('invalid');
            qaUrlError.classList.add('hidden');
            qaNameError.classList.add('hidden');
            validateQuickAccessForm();

            addQuickAccessPanel.classList.remove('hidden');
        }
    });

    let isDeleteMode = false;
    let longPressTimer = null;

    const enterDeleteMode = () => {
        if (isDeleteMode) return;
        isDeleteMode = true;
        quickAccessGrid.classList.add('delete-mode');
    };

    const exitDeleteMode = () => {
        if (!isDeleteMode) return;
        isDeleteMode = false;
        quickAccessGrid.classList.remove('delete-mode');
    };

    const clearLongPressTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    quickAccessGrid.addEventListener('mousedown', (e) => {
        if (isDeleteMode) return;
        const item = e.target.closest('.quick-access-item');
        if (item && !item.classList.contains('add-quick-access-btn')) {
            // 设置为1.5秒长按
            longPressTimer = setTimeout(enterDeleteMode, 1500);
        }
    });

    quickAccessGrid.addEventListener('mouseup', clearLongPressTimer);
    quickAccessGrid.addEventListener('mouseleave', clearLongPressTimer);
    quickAccessGrid.addEventListener('dragstart', clearLongPressTimer);
    quickAccessGrid.addEventListener('contextmenu', clearLongPressTimer);

    document.addEventListener('click', (e) => {
        if (isDeleteMode && !e.target.closest('.quick-access-grid')) {
            exitDeleteMode();
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (isDeleteMode && e.key === 'Escape') {
            exitDeleteMode();
        }
    });
});

async function initializeQuickAccess() {
    const data = await new Promise(resolve => chrome.storage.local.get('quickAccessSites', resolve));
    
    if (data.quickAccessSites) {
        renderQuickAccess(data.quickAccessSites);
    } else {
        // First time run: use default sites and save them
        await new Promise(resolve => chrome.storage.local.set({ quickAccessSites: defaultSites }, resolve));
        renderQuickAccess(defaultSites);
    }
}

function renderQuickAccess(sites) {
    const quickAccessGrid = document.getElementById('quick-access-grid');
    quickAccessGrid.innerHTML = '';

    sites.forEach((site, index) => {
        const item = document.createElement('a');
        item.href = site.url;
        item.className = 'quick-access-item';
        item.target = '_blank';
        item.dataset.index = index;

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';
        
        const customIcon = site.icon; // Can be SVG code or a URL

        if (customIcon) {
            if (customIcon.trim().startsWith('<svg')) {
                iconWrapper.innerHTML = customIcon;
                const svg = iconWrapper.querySelector('svg');
                if (svg) {
                    svg.classList.add('icon');
                }
            } else { // Assume it's a URL
                const icon = document.createElement('img');
                icon.src = customIcon;
                icon.className = 'icon';
                icon.alt = `${site.name} Icon`;
                iconWrapper.appendChild(icon);
            }
        } else {
            // Fallback to favicon service
            const icon = document.createElement('img');
            icon.src = `https://www.google.com/s2/favicons?sz=64&domain_url=${site.url}`;
            icon.className = 'icon';
            icon.alt = `${site.name} Icon`;
            
            icon.onerror = () => {
                const fallback = document.createElement('div');
                fallback.className = 'fallback-icon';
                const firstChar = site.name.charAt(0);
                if (/\p{Script=Han}/u.test(firstChar)) {
                    fallback.textContent = firstChar;
                } else {
                    fallback.textContent = firstChar.toUpperCase();
                }
                iconWrapper.innerHTML = '';
                iconWrapper.appendChild(fallback);
            };
            iconWrapper.appendChild(icon);
        }
        
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = site.name;

        item.appendChild(iconWrapper);
        item.appendChild(name);

        const editBtn = document.createElement('div');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '&#9998;'; // Pencil icon
        item.appendChild(editBtn);

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;';
        item.appendChild(deleteBtn);

        quickAccessGrid.appendChild(item);
    });

    const addButton = document.createElement('div');
    addButton.className = 'add-quick-access-btn';
    addButton.textContent = '+';
    addButton.title = '添加快捷方式';
    quickAccessGrid.appendChild(addButton);
} 