# 新标签页扩展 - 模块化架构说明

## 🏗️ 架构概述

本项目已重构为模块化架构，将原本的单一 `main.js` 文件拆分为多个功能模块，提高了代码的可维护性、可测试性和可扩展性。

## 📁 文件结构

```
js/
├── modules/                    # 功能模块目录
│   ├── wallpaper-manager.js    # 壁纸管理模块
│   ├── search-manager.js       # 搜索功能模块
│   ├── quick-access-manager.js # 快捷访问管理模块
│   ├── settings-manager.js     # 设置管理模块
│   ├── theme-manager.js        # 主题管理（浅色/深色/跟随系统/日出日落）
│   ├── backup-manager.js       # 备份导出与导入（前向兼容）
│   └── weather-manager.js      # 天气管理模块（高德）
├── components/                 # 组件目录
│   ├── advanced-pagination.js  # 高级分页组件（单次 DOM 更新）
│   ├── visibility-toggle.js    # 通用密钥可见性切换
│   ├── weather-icons.js        # 天气图标映射与 SVG 生成
│   └── sortable.min.js         # 拖拽组件
├── config/
│   └── weather-config.js       # 天气相关常量（BASE_URL、TTL、限流等）
├── constants/
│   └── selectors.js            # 全局选择器与 ID 常量（window.SELECTORS）
├── utils/
│   ├── request.js              # 统一请求封装（超时/重试/退避/错误解析）
│   ├── liquid-glass.js         # 液态玻璃：WebGL2 折射渲染（FBO 池化 / 累积降噪 / cover 采样）
│   ├── icon-safe.js            # 站点图标清洗 + 近白图标反相
│   └── url-safe.js             # 链接协议白名单（只放行 http(s)，open() 自带 noopener）
├── theme-boot.js               # 首屏主题预置（同步执行，防白闪）
├── app.js                      # 主应用类
└── main.js                     # 入口文件（已简化）
```

## 🔧 模块说明

### 1. WallpaperManager (壁纸管理模块)

- 职责: 管理壁纸的加载、搜索、分类
- 功能:
    - 加载默认壁纸
    - 搜索 Pexels 壁纸
    - 管理壁纸分类
    - 设置当前壁纸

### 2. SearchManager (搜索管理模块)

- 职责: 管理搜索引擎和搜索功能
- 功能:
    - 搜索引擎切换
    - 搜索历史管理（新增单项删除）
    - 执行搜索操作

### 3. QuickAccessManager (快捷访问管理模块)

- 职责: 管理快捷访问项目
- 功能:
    - 增删改查快捷访问
    - 数据持久化
    - 与高级分页组件集成（添加按钮始终为最后一个，禁拖拽）

### 4. SettingsManager (设置管理模块)

- 职责: 管理应用设置（统一的配置读写入口）
- 功能:
    - 设置加载/保存与默认值
    - Pexels/Gaode API Key、天气城市/单位 等配置

### 5. WeatherManager (天气管理模块)

- 职责: 集成高德（AMap）天气，展示与缓存天气
- 功能:
    - 城市名 -> adcode 转换（缓存 TTL）
    - 位置逆地理 -> adcode（含权限提示与超时提示）
    - 天气获取与格式化展示（中文现象映射）
    - 统一请求封装（`utils/request.js`），含超时、重试（指数退避）、错误解析、频率限制（`weather-config.js`）

### 6. ThemeManager (主题管理模块)

- 职责: 管理浅色/深色/跟随系统/日出日落四种主题，只切换 `<html data-theme>`
- 功能:
    - 模式：`auto`（跟随 `prefers-color-scheme`）/ `light` / `dark` / `sun`（日出日落）
    - 首屏零闪烁：`js/theme-boot.js` 在 `<head>` 里同步执行，先读 localStorage 镜像把 `data-theme` 写上，再由 `syncFromStorage()` 用 storage 真值校正
    - 日出日落：复用天气已取的坐标与缓存请求 Open-Meteo `daily=sunrise,sunset`；拿不到就用本地近似（7:00 / 18:00）兜底并在设置里标注「近似」
    - 定时复查：每 60s 一次跨天切换；`auto` 模式额外监听 `matchMedia` 即时响应系统切换
    - 预览-保存：设置面板里切换即时预览，只有「保存」才持久化，关闭面板回滚
- 约束: 所有配色走 CSS token，JS 里不写颜色值；主题只改 `style.css` 末尾两个主题块
    - 壁纸层：`--wallpaper-veil`、`--on-photo-scrim`、`--on-photo-halo`
    - 玻璃层：`--glass-blur/saturate/brightness/contrast`、`--glass-fill` 族、`--glass-card-fill` 族（侧卡专用，见下）、`--glass-sheen`、`--glass-rim*/--glass-shade*`、`--glass-shadow`
    - 语义层：`--accent-ink` / `--on-accent` / `--on-danger` / `--accent-break`。深色主题的 accent 与蓝色按钮都是亮档实色，白字只有 2.1–3.3:1，必须把 `*-ink` 翻成深色
- 玻璃材质的三件事（改之前先读 `style.css` 里对应的注释）:
    1. `--glass-backdrop` 是合成后的整条 backdrop-filter，各元素只引用，不要在局部重新拼
    2. `url(#liquid-refract)` 必须排在 `blur()` 之前，且只在 `@supports` 块里加——半条 `url()` 会让玻璃变全透明
    3. 卡片玻璃（`--glass-card-*`）单独一档：CSS 自定义属性里的 var() 在声明元素上就求值完毕，给 `.side-card` 覆盖 `--glass-saturate` 不会重算 `--glass-backdrop`
- 文字可读性的硬规则: 不用 `opacity` 压文字（它连字形带光晕一起溶进背景），改用 `--text-primary/secondary`；11–14px 小字一律至少 `--text-secondary`

### 7. AdvancedPagination (高级分页组件)

- 变化:
    - 固定每页 10 位：9 项 + 1 个“添加”按钮
    - 渲染合并：`setItems()` 仅触发一次 DOM 更新
    - 跨页拖拽旧逻辑移除，拖拽限制在当页

### 8. 其他组件/常量

- `modules/backup-manager.js`: 数据备份导出/导入，四层兼容（键注册表 / 全量减缓存 / 迁移链 / 未知键保留）
- `theme-boot.js`: 首屏主题预置脚本（同步、非模块，必须在 `style.css` 之前执行）
- `components/visibility-toggle.js`: 通用“显示/隐藏密钥”组件，适配 Pexels/Gaode 输入框
- `components/weather-icons.js`: 将中文天气现象映射到内置 SVG
- `constants/selectors.js`: 中央化所有 dom id/选择器，统一经 `window.SELECTORS` 访问，减少魔法字符串
- `utils/request.js`: 统一 `fetchJSON(url, { timeout, retries, retryDelay, backoff })`
- `utils/liquid-glass.js`: 液态玻璃渲染器。`LiquidGlass`（调度 / 几何 / 累积）与 `GlassRenderer`（WebGL2）。三条约束要记住：① FBO 按尺寸池化，命中不代表内容有效，尺寸切换必须让调用方 reset；② 导出用的默认帧缓冲只增不减（赋值 `canvas.width` 会重建整个绘图缓冲，比建 FBO 更贵），导出按左下角取子矩形；③ 场景采样必须按 `background-size: cover` 反算绘制矩形，直接拿视口尺寸当 uv 会整体错位
- `utils/url-safe.js`: 链接安全工具（`isHttp` / `isImageSource` / `href` / `open`）。快捷方式、自定义搜索引擎、壁纸地址、备份导入的数据都可能带任意协议，统一在这里挡掉 `javascript:` / `data:` 等非 http(s) 地址，`open()` 默认带 `noopener,noreferrer`
- `config/weather-config.js`: 天气 API BASE_URL、缓存 TTL、最小请求间隔等

## 🚀 使用方法

### 基本使用

```javascript
// 创建应用实例
const app = new NewTabApp();

// 初始化应用
await app.init();

// 获取应用状态
const status = app.getStatus();
```

### 模块访问

```javascript
// 访问壁纸管理器
const { wallpaperManager } = app;

// 访问搜索管理器
const { searchManager } = app;

// 访问快捷访问管理器
const { quickAccessManager } = app;

// 访问天气管理器
const { weatherManager } = app;
```

### 统一请求工具

```javascript
import { fetchJSON } from './js/utils/request.js';

const data = await fetchJSON('https://example.com/api', {
    timeout: 10000,
    retries: 2,
    retryDelay: 600,
    backoff: 2,
});
```

## 🔄 迁移指南

### 从旧版本迁移

1. 保留现有功能：原有功能已保留并模块化
2. 渐进式迁移：将散落在 `main.js` 的逻辑迁入对应模块
3. 选择器与配置：
    - DOM id/选择器统一使用 `window.SELECTORS`
    - 配置统一通过 `SettingsManager` 读写
    - 旧键已在启动时一次性迁移与清理

### 添加新功能

1. 创建新模块：在 `js/modules/` 目录下创建新文件
2. 实现模块类：遵循现有的模块结构
3. 集成到主应用：在 `NewTabApp` 中初始化和使用

## 📝 开发规范

### 模块命名

- 文件名: `kebab-case` (如: `wallpaper-manager.js`)
- 类名: `PascalCase` (如: `WallpaperManager`)
- 方法名: `camelCase` (如: `searchWallpapers`)

### 模块结构

```javascript
class ModuleName {
    constructor() {
        // 初始化属性
    }

    // 公共方法
    async init() {
        // 初始化逻辑
    }

    // 私有方法（以下划线开头）
    _privateMethod() {
        // 私有逻辑
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleName;
} else {
    window.ModuleName = ModuleName;
}
```

### 错误处理

- 使用 `try-catch` 包装异步操作
- 提供有意义的错误信息
- 记录错误到控制台

## 🧪 质量与风格

- Lint/Format：项目内置 ESLint + Prettier 与 EditorConfig；执行 `npm run lint`、`npm run format`
- 请求规范：统一通过 `utils/request.js` 发起请求
- 选择器规范：统一通过 `window.SELECTORS` 访问 DOM

## 🔮 未来规划

- TypeScript 支持（类型定义与工具链）
- 单元测试框架（Jest 或 Mocha）
- 更完善的状态管理
- 插件式扩展能力

## 📚 相关文档

- [Chrome 扩展开发指南](https://developer.chrome.com/docs/extensions/)
- [MDN: ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [MDN: 异步编程](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous)

---

如遇问题，请先检查浏览器控制台错误信息与 `manifest.json` 权限/主机权限配置，并确认已正确填写 API Key。
