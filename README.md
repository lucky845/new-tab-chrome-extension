# New Tab Pro

> 一个纯本地、零后端的浏览器新标签页扩展：Picsum 精选壁纸、时钟、天气、待办、便签、番茄钟，左右两翼常驻，一个页面全都有。

![preview](img/preview.png)

**无需任何 API Key 即可完整使用。** 天气走 Open-Meteo、壁纸走 Picsum，全部免密钥；Pexels 与高德只是可选增强（入口在设置最下方）。所有数据保存在 `chrome.storage.local`，不联网上报、不收集任何信息。

---

## ✨ 功能

<table>
<tr><td width="50%" valign="top">

**🖼️ 壁纸**
- Picsum 免 Key 图库（Unsplash 精选）：按页浏览 + 翻页 + 随机换壁纸（默认）；**不支持分类/关键词筛选**（实测服务端忽略 `?q=`），分类需求自动改走 Wallhaven
- Wallhaven 图源可选：设置中切换，**唯一支持分类/关键词真正筛选**的免 Key 图源，需能访问境外网络
- Pexels（可选 Key）：填写后切换为 Pexels 图源
- 缓存优先加载，刷新无闪烁
- 亮度 30%–100%、模糊 0–20px 实时调节

**🔍 搜索**
- 内置 5 个引擎：百度 / Google / Bing / 搜狗 / DuckDuckGo
- 支持自定义搜索引擎（`%s` 占位符）
- 搜索历史：点击填充、单项删除、一键清空

</td><td width="50%" valign="top">

**🎯 快捷方式**
- 每页 10 格，拖拽排序（同页内），右键编辑/删除
- 文件夹分组：右键「新建文件夹…」把站点收纳成组，文件夹显示 2×2 图标预览与数量角标，点击展开、状态栏 ＋ 直接添加
- 右键可将站点「移入文件夹」、重命名/解散文件夹；文件夹内站点可移回主面板
- 默认 8 个常用站点，图标外置为独立配置

**🌤️ 天气**
- Open-Meteo 免 Key，自动定位或手动城市
- 高德 Key 可选（设置最下方）：填写后切换为高德数据
- 中文天气现象 + 内置 SVG 图标，20 分钟缓存

**⏱️ 小组件与主页两翼（v1.3.0）**
- 时钟 / 日期 / 时段问候
- 待办：分类（工作/生活/普通）、截止日期与逾期高亮、拖拽排序、今日完成统计
- 备忘录：多便签、置顶、搜索、自动保存
- 番茄钟：可配置时长、长休息轮转、今日 🍅 统计、提示音、环形进度
- 小工具：时间戳 / JSON / Base64 / URL 编解码 / SHA-256 / 进制 / 大小写 / 去重 / 字数 / 颜色 / 密码 / UUID，纯本地运行
- 左右两翼常驻主页（可在设置中关闭），点 ⤢ 打开完整面板

**💾 备份与恢复（v1.5.0）**
- 设置面板一键导出为单个 JSON 文件（文件名自带时间戳）
- 导入自动校验：应用标识 / schema 版本 / 字段类型，任一不合法整体拒绝，不做部分写入
- 覆盖设置、自定义引擎、快捷方式、待办、便签、番茄钟与壁纸偏好
- 不导出天气与地理缓存（本质是 TTL 缓存，恢复后自动重新获取），备份文件更小
- 导入后自动刷新页面，让各模块重新加载新数据

> **新增功能自动兼容。** 导出走「全量减缓存」而非硬编码白名单：新功能写入的 storage 键**无需改备份代码**就会自动进备份、自动还原。缓存键按精确前缀（`amap_adcode_` / `amap_weather_` / `om_geo_` / `om_weather_` / `om_last_location`）剔除，不用宽泛模式，避免误伤用户数据。
>
> 三层版本兼容：① **旧备份**按迁移链逐级升级（`schemaVersion` 1→2→…），旧文件能被新版本正确解读；② **更新版本的备份**不整体拒绝，已识别的键照常导入；③ **未知键原样保留**写入，不会因当前版本不认识就丢弃未来功能的数据。

**备份格式**

```jsonc
{
  "app": "new-tab-pro",       // 应用标识，导入时校验
  "schemaVersion": 2,          // 当前格式版本
  "exportedAt": "2026-11-12T01:06:22.000Z",
  "extensionVersion": "1.5.0",
  "keys": { "todos": { "type": "array", "label": "待办", "since": 1 } },
  "extras": ["某个未登记的新键"],   // 未登记但已导出的键，供排查
  "skippedCache": ["om_weather_..."], // 被剔除的缓存键，供排查
  "data": { "todos": [], "settings": {} }
}
```

后续功能若要给某个键加上**类型校验**与**可读名**，调用 `backupManager.register(key, { type, label, since })` 即可；不登记也不会丢数据，只是缺少校验。新增格式版本时，在 `migrations` 末尾追加 `{ from: N, to: N+1, migrate }` 并递增 `SCHEMA_VERSION`。

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
| 壁纸图源 | Picsum（默认）/ Wallhaven 二选一 | 默认 Picsum 国内直连稳定但不支持分类筛选；要分类请选 Wallhaven |
| Pexels API Key | 关键词搜索壁纸（Pexels 图源） | 使用所选免 Key 图源浏览 |
| 高德 Web 服务 Key | 切换天气数据源为高德 | 使用 Open-Meteo 免费数据 |
| 天气城市 | 固定城市 | 自动定位（失败回退上次城市） |
| 首页标语 | 时钟下方一句话 | 不显示 |
| 自定义搜索引擎 | 添加任意搜索站点 | 仅内置 5 个引擎 |

### 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存设置、壁纸缓存、待办、便签；导出备份时全量读取 |
| `geolocation` | 天气自动定位（可拒绝，改用城市名） |
| `host_permissions` | 仅 `picsum.photos`、`wallhaven.cc`（可选图源）、`pexels.com`、`amap.com`、`open-meteo.com` |

---

## 🧱 架构

无构建系统，纯 ES2020 + 浏览器全局，方便直接审查代码。

```
newtab.html                 单页结构
├── main.js                 入口（bootstrap，20 行）
└── js/
    ├── app.js              NewTabApp：组合根 + 全部 UI 绑定
    ├── modules/            业务数据层（8 个 manager）
    │   ├── wallpaper-manager.js    壁纸：缓存链 / Picsum 免 Key / Pexels 可选
    │   ├── search-manager.js       搜索：引擎合并 / 历史
    │   ├── quick-access-manager.js 快捷方式：校验 / 分页数据
    │   ├── settings-manager.js     设置：统一存储 + 旧键迁移
    │   ├── weather-manager.js      天气：Open-Meteo / 高德双轨
    │   ├── todo-manager.js         待办
    │   ├── notes-manager.js        便签
    │   ├── pomodoro-manager.js     番茄钟状态机
    │   └── backup-manager.js       数据备份 / 校验 / 恢复
    ├── components/         advanced-pagination / weather-icons / visibility-toggle
    ├── config/             weather-config / default-sites / tools（小工具定义）
    ├── constants/          selectors.js（window.SELECTORS 单一来源）
    └── utils/              request（超时/重试/退避）、toast、dsh-tip、dsh-dialog
```

**设计原则**

- **单向依赖**：`main.js → app.js → modules`，manager 不碰 DOM
- **UI 与业务分离**：manager 只做数据与存储，渲染全部在 `app.js`
- **选择器常量化**：所有 `getElementById` 走 `window.SELECTORS`，杜绝拼写错误导致的静默失败
- **失败兜底**：壁纸 → Pexels(可选) → Picsum 随机 → 保留当前；天气 → Open-Meteo → 高德 → 缓存
- **图源能力如实告知**：Picsum 是纯图库，实测服务端忽略 `?q=`（带不带返回同一批图），因此分类筛选会改走 Wallhaven（真支持 `q=` 检索）；Wallhaven 不可达时回落浏览模式并在侧栏明示「当前图源不支持按分类筛选」，绝不用哈希页码冒充分类结果
- **交互一致**：确认/输入一律走 `dshDialog`（Promise 化，Esc 取消、Enter 确认、Tab 焦点囚禁、校验内联报错），不用会阻塞渲染且无法样式化的原生 `confirm`/`prompt`；危险操作传 `danger: true` 保留红色强调

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
- [x] 左右两翼布局、Picsum 免 Key 图源、Wallhaven 可选、移除 Bing（v1.3.0）
- [x] 小工具面板（12 个纯本地工具）（v1.3.1）
- [x] 快捷方式文件夹分组（v1.3.2）
- [x] 数据导入导出（v1.5.0）
- [x] 统一确认/输入对话框、备份与恢复前向兼容、壁纸分类筛选修复（v1.6.0）
- [ ] 主题切换

---

## 🤝 贡献

Issue / PR 欢迎。提交前请确保 `npm run lint` 零警告，并遵循「manager 不碰 DOM」的边界。

## 📄 License

[MIT](LICENSE) © lucky845
