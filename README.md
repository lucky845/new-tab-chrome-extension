# New Tab Pro

> 一个纯本地、零后端的浏览器新标签页扩展：每天一张 Bing 壁纸，时钟、天气、待办、便签、番茄钟，一个页面全都有。

![preview](img/preview.png)

**无需任何 API Key 即可完整使用。** 天气走 Open-Meteo、壁纸走 Bing 每日图，全部免密钥；Pexels 与高德只是可选增强。所有数据保存在 `chrome.storage.local`，不联网上报、不收集任何信息。

---

## ✨ 功能

<table>
<tr><td width="50%" valign="top">

**🖼️ 壁纸**
- Bing 每日壁纸，免 Key 开箱即用
- Pexels 搜索（可选 Key）：12 个分类 + 分页浏览
- 缓存优先加载，刷新无闪烁
- 亮度 30%–100%、模糊 0–20px 实时调节

**🔍 搜索**
- 内置 5 个引擎：百度 / Google / Bing / 搜狗 / DuckDuckGo
- 支持自定义搜索引擎（`%s` 占位符）
- 搜索历史：点击填充、单项删除、一键清空

</td><td width="50%" valign="top">

**🎯 快捷方式**
- 每页 10 格，拖拽排序（同页内），右键编辑/删除
- 默认 8 个常用站点，图标外置为独立配置

**🌤️ 天气**
- Open-Meteo 免 Key，自动定位或手动城市
- 高德 Key 可选：填写后切换为高德数据
- 中文天气现象 + 内置 SVG 图标，20 分钟缓存

**⏱️ 小组件（v1.2.0 新增）**
- 时钟 / 日期 / 时段问候
- 待办清单（重要标记、清除已完成）
- 备忘录（自动保存、字数统计）
- 番茄钟（25 分钟专注 / 5 分钟休息）

</td></tr>
</table>

---

## 📦 安装

### 从商店

Edge 加载项商店搜索 **New Tab Pro**。

### 本地加载（推荐开发者）

```bash
git clone https://github.com/lucky845/new-tab-chrome-extension.git
```

1. 打开 `chrome://extensions` 或 `edge://extensions`
2. 打开右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选择仓库目录
4. 新开一个标签页

无需构建、无需 `npm install`——仓库即产物。

---

## ⚙️ 配置

设置面板（右上角齿轮）里所有项都是**可选**的：

| 配置 | 作用 | 不填会怎样 |
| --- | --- | --- |
| Pexels API Key | 解锁壁纸搜索与分类浏览 | 只用 Bing 每日壁纸 |
| 高德 Web 服务 Key | 切换天气数据源为高德 | 使用 Open-Meteo 免费数据 |
| 天气城市 | 固定城市 | 自动定位（失败回退上次城市） |
| 首页标语 | 时钟下方一句话 | 不显示 |
| 自定义搜索引擎 | 添加任意搜索站点 | 仅内置 5 个引擎 |

### 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存设置、壁纸缓存、待办、便签 |
| `geolocation` | 天气自动定位（可拒绝，改用城市名） |
| `host_permissions` | 仅 `bing.com`、`pexels.com`、`amap.com`、`open-meteo.com` |

---

## 🧱 架构

无构建系统，纯 ES2020 + 浏览器全局，方便直接审查代码。

```
newtab.html                 单页结构
├── main.js                 入口（bootstrap，20 行）
└── js/
    ├── app.js              NewTabApp：组合根 + 全部 UI 绑定
    ├── modules/            业务数据层（8 个 manager）
    │   ├── wallpaper-manager.js    壁纸：缓存链 / Bing 免 Key / Pexels 搜索
    │   ├── search-manager.js       搜索：引擎合并 / 历史
    │   ├── quick-access-manager.js 快捷方式：校验 / 分页数据
    │   ├── settings-manager.js     设置：统一存储 + 旧键迁移
    │   ├── weather-manager.js      天气：Open-Meteo / 高德双轨
    │   ├── todo-manager.js         待办
    │   ├── notes-manager.js        便签
    │   └── pomodoro-manager.js     番茄钟状态机
    ├── components/         advanced-pagination / weather-icons / visibility-toggle
    ├── config/             weather-config / default-sites
    ├── constants/          selectors.js（window.SELECTORS 单一来源）
    └── utils/              request（超时/重试/退避）、toast、bing-wallpaper
```

**设计原则**

- **单向依赖**：`main.js → app.js → modules`，manager 不碰 DOM
- **UI 与业务分离**：manager 只做数据与存储，渲染全部在 `app.js`
- **选择器常量化**：所有 `getElementById` 走 `window.SELECTORS`，杜绝拼写错误导致的静默失败
- **失败兜底**：Bing → todaybing → 纯色；天气 → Open-Meteo → 高德 → 缓存

---

## 🛠️ 开发

```bash
npm install        # 仅安装 lint/format 工具，运行扩展不需要
npm run lint       # ESLint 9 flat config
npm run lint:fix
npm run format     # Prettier
```

改完代码在扩展管理页点「刷新」即可生效，无需构建。

---

## 🗺️ 路线图

- [x] 免 API Key 完整可用（v1.1.0）
- [x] 双轨架构合并，main.js 收敛为 bootstrap（v1.1.0）
- [x] 时钟 / 待办 / 便签 / 番茄钟 / 自定义引擎 / 壁纸调节（v1.2.0）
- [ ] 快捷方式文件夹分组
- [ ] 数据导入导出
- [ ] 主题切换

---

## 🤝 贡献

Issue / PR 欢迎。提交前请确保 `npm run lint` 零警告，并遵循「manager 不碰 DOM」的边界。

## 📄 License

[MIT](LICENSE) © lucky845
