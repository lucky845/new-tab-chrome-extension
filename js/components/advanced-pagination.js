/**
 * 高级分页组件
 */
class AdvancedPagination {
    constructor(container, options = {}) {
        this.container = container;
        this.items = options.items || [];
        this.itemsPerPage = options.itemsPerPage || 10;
        this.currentPage = 1;
        this.sortableInstances = new Map(); // 存储每页的Sortable实例
        this.onPageChange = options.onPageChange || (() => {});
        this.onItemMove = options.onItemMove || (() => {});
        this.onItemMerge = options.onItemMerge || (() => {});
        // 跨页面拖拽已移除
        this._renderScheduled = false;

        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
        console.log('高级分页组件初始化完成');
    }

    // 渲染分页内容
    render() {
        this.container.innerHTML = '';

        // 创建分页容器
        this.paginationContainer = document.createElement('div');
        this.paginationContainer.className = 'advanced-pagination';

        // 创建当前页面容器
        this.currentPageContainer = document.createElement('div');
        this.currentPageContainer.className = 'current-page-container';

        // 创建分页控件容器
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'pagination-controls';

        this.paginationContainer.appendChild(this.currentPageContainer);
        this.paginationContainer.appendChild(this.controlsContainer);
        this.container.appendChild(this.paginationContainer);

        this.renderCurrentPage();
        this.renderPaginationControls();
    }

    // 渲染当前页面
    renderCurrentPage() {
        this.currentPageContainer.innerHTML = '';

        // 创建当前页面的网格
        const grid = document.createElement('div');
        grid.className = 'quick-access-grid';

        // 计算当前页的项目（每页最多显示10个项目，包括添加按钮）
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentPageItems = this.items.slice(startIndex, endIndex);

        // 渲染项目
        currentPageItems.forEach((item, index) => {
            const itemElement = this.createItemElement(item, startIndex + index);
            grid.appendChild(itemElement);
        });

        // 添加按钮：如果当前页项目少于10个，则显示添加按钮
        // 如果当前页项目达到10个，添加按钮移到下一页
        if (currentPageItems.length < this.itemsPerPage) {
            const addButton = this.createAddButton();
            grid.appendChild(addButton);
        }

        this.currentPageContainer.appendChild(grid);

        // 初始化当前页的SortableJS
        this.initSortableForPage(grid, this.currentPage);
    }

    // 创建项目元素
    createItemElement(item, globalIndex) {
        // 文件夹：渲染为 2x2 迷你预览格，点击由 app 层接管弹层
        if (item.isFolder) {
            const folderElement = document.createElement('div');
            folderElement.className = 'quick-access-item folder-item';
            folderElement.dataset.index = globalIndex;
            folderElement.dataset.isFolder = 'true';
            folderElement.dataset.page = this.currentPage;
            folderElement.title = item.name;

            const preview = document.createElement('div');
            preview.className = 'folder-preview';
            const items = item.items || [];
            for (let i = 0; i < 4; i += 1) {
                const cell = document.createElement('div');
                cell.className = 'folder-cell';
                const site = items[i];
                if (site) {
                    if (site.icon && site.icon.trim().startsWith('<svg')) {
                        // 内嵌 SVG：走 IconSafe 白名单重建，不能直接 innerHTML
                        const svg = window.IconSafe && window.IconSafe.parseSvg(site.icon);
                        if (svg) {
                            svg.classList.add('icon');
                            cell.appendChild(svg);
                        }
                    } else {
                        const icon = document.createElement('img');
                        icon.className = 'icon';
                        icon.alt = '';
                        icon.loading = 'lazy';
                        icon.decoding = 'async';
                        icon.referrerPolicy = 'no-referrer';
                        icon.src =
                            site.icon && /^https?:/.test(site.icon)
                                ? site.icon
                                : `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(site.url)}`;
                        icon.onerror = () => {
                            cell.innerHTML = '';
                            const fb = document.createElement('span');
                            fb.className = 'folder-cell-fallback';
                            fb.textContent = site.name.charAt(0);
                            cell.appendChild(fb);
                        };
                        cell.appendChild(icon);
                    }
                }
                preview.appendChild(cell);
            }
            folderElement.appendChild(preview);

            const folderName = document.createElement('span');
            folderName.className = 'name';
            folderName.textContent = item.name;
            folderElement.appendChild(folderName);

            if (items.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'folder-count';
                badge.textContent = String(items.length);
                folderElement.appendChild(badge);
            }

            return folderElement;
        }

        const itemElement = document.createElement('a');
        // 只把 http(s) 写进 href：快捷方式数据可能来自备份导入，协议不可信
        itemElement.href = window.UrlSafe ? window.UrlSafe.href(item.url) : item.url;
        itemElement.className = 'quick-access-item';
        itemElement.target = '_blank';
        // target=_blank 显式带 noopener：不把 window.opener 交给目标站点
        itemElement.rel = 'noopener noreferrer';
        itemElement.dataset.index = globalIndex;
        itemElement.dataset.itemId = item.id || globalIndex;
        itemElement.dataset.page = this.currentPage;

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';

        if (item.icon) {
            if (item.icon.trim().startsWith('<svg')) {
                // 同上：白名单重建，杜绝 on* 属性与 <script>
                const svg = window.IconSafe && window.IconSafe.parseSvg(item.icon);
                if (svg) {
                    svg.classList.add('icon');
                    iconWrapper.appendChild(svg);
                }
            } else {
                const icon = window.IconSafe && window.IconSafe.parseImage(item.icon);
                if (icon) {
                    icon.className = 'icon';
                    icon.alt = `${item.name} Icon`;
                    iconWrapper.appendChild(icon);
                }
            }
        } else {
            const icon = document.createElement('img');
            // 与 app.js 的 favicon 保持一致：lazy + async decode，
            // 避免国内不可达的 google s2 图片阻塞 window.load（标签页持续转圈）。
            icon.loading = 'lazy';
            icon.decoding = 'async';
            icon.referrerPolicy = 'no-referrer';
            // 必须 encode：URL 自带 ?a=1&b=2 时，未转义的 & 会串成 s2 的第二个参数，图标就取错了
            icon.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(item.url)}`;
            icon.className = 'icon';
            icon.alt = `${item.name} Icon`;

            icon.onerror = () => {
                const fallback = document.createElement('div');
                fallback.className = 'fallback-icon';
                const firstChar = item.name.charAt(0);
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
        name.textContent = item.name;

        itemElement.appendChild(iconWrapper);
        itemElement.appendChild(name);

        return itemElement;
    }

    // 创建添加按钮
    createAddButton() {
        const addButton = document.createElement('div');
        addButton.className = 'add-quick-access-btn';
        addButton.title = '添加快捷方式';

        // 创建图标包装器，与快捷访问项目保持一致
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';
        iconWrapper.textContent = '＋';

        // 创建名称，与快捷访问项目保持一致
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = '添加';

        addButton.appendChild(iconWrapper);
        addButton.appendChild(name);

        // 添加点击事件，显示添加快捷访问弹窗
        addButton.addEventListener('click', () => {
            if (window.app && window.app.showAddQuickAccessModal) {
                window.app.showAddQuickAccessModal();
            }
        });

        return addButton;
    }

    // 高亮指针下方的合并目标
    // 合并需悬停时长（毫秒，类外赋值，见文件末尾）

    // 从事件里取指针坐标（兼容鼠标 / 触摸）
    static pointerOf(evt) {
        if (!evt) return null;
        const oe = evt.originalEvent || evt;
        if (typeof oe.clientX === 'number') return { x: oe.clientX, y: oe.clientY };
        const t = (oe.changedTouches && oe.changedTouches[0]) || (oe.touches && oe.touches[0]);
        if (t) return { x: t.clientX, y: t.clientY };
        return null;
    }

    // 指针是否落在格子「中心区」内（阈值：默认内缩 30%，即中心 40% 区域）
    static inCenterZone(rect, pointer, inset = 0.15) {
        if (!rect || !pointer) return false;
        const dx = rect.width * inset;
        const dy = rect.height * inset;
        return (
            pointer.x >= rect.left + dx &&
            pointer.x <= rect.right - dx &&
            pointer.y >= rect.top + dy &&
            pointer.y <= rect.bottom - dy
        );
    }

    /**
     * 手机式合并判定（阈值）：
     * 1) 指针必须落在目标格子「中心区」（内缩 30%）——擦边不算
     * 2) 必须在同一目标上停留 >= HOVER_MS —— 快速划过不算
     * 判定由 onStart 启动的定时器驱动（指针静止时 onMove 不再触发，不能只靠事件）
     */
    updateMergeCandidate(grid, draggedEl) {
        const pointer = this._dragPointer;
        if (!pointer) return;

        // 拖拽过程中布局会实时重排（格子互换位置），因此必须使用「拖拽开始时快照」的坐标
        const snapshot = this._dragSnapshot || [];
        const candidates = snapshot.filter(entry => entry.el !== draggedEl && entry.el.isConnected);

        let hit = null;
        for (const entry of candidates) {
            const r = entry.rect;
            const inside =
                pointer.x >= r.left &&
                pointer.x <= r.right &&
                pointer.y >= r.top &&
                pointer.y <= r.bottom;
            if (inside) {
                hit = entry.el;
                break;
            }
        }

        // 目标变化 → 重置计时与视觉
        if (hit !== this._hoverCandidate) {
            this._hoverCandidate = hit;
            this._hoverSince = hit ? Date.now() : 0;
            this._mergeTargetIndex = null;
            grid.querySelectorAll('.merge-target, .merge-candidate').forEach(el =>
                el.classList.remove('merge-target', 'merge-candidate')
            );
        }

        if (!hit) return;

        if (Date.now() - this._hoverSince < AdvancedPagination.HOVER_MS) {
            hit.classList.add('merge-candidate');
            hit.classList.remove('merge-target');
            this._mergeTargetIndex = null;
            return;
        }

        hit.classList.remove('merge-candidate');
        hit.classList.add('merge-target');
        this._mergeTargetIndex = parseInt(hit.dataset.index, 10);
    }

    // 为指定页面初始化SortableJS
    initSortableForPage(grid, pageNumber) {
        if (typeof Sortable === 'undefined') {
            console.warn('SortableJS未加载，拖拽功能将不可用');
            return;
        }

        // 销毁之前的实例
        if (this.sortableInstances.has(pageNumber)) {
            this.sortableInstances.get(pageNumber).destroy();
        }

        // 创建新的Sortable实例
        const sortableInstance = new Sortable(grid, {
            draggable: '.quick-access-item',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            // 桌面鼠标也需要拖拽延迟：否则按住不动约 600ms 就会进入"合并"态，
            // 松手即弹出"新建文件夹"，属于高频误操作
            delay: 180,
            delayOnTouchOnly: false,
            animation: 150,
            easing: 'cubic-bezier(1, 0, 0, 1)',
            // 手机式合并：拖拽中高亮指针下的目标图标
            onMove: evt => {
                const p = AdvancedPagination.pointerOf(evt);
                if (p) this._dragPointer = p;
                if (evt.dragged) this.updateMergeCandidate(grid, evt.dragged);
                if (evt.related && evt.related.classList.contains('add-quick-access-btn')) {
                    return false;
                }
                if (evt.dragged && evt.dragged.classList.contains('add-quick-access-btn')) {
                    return false;
                }
                return true;
            },

            // 拖拽开始
            onStart: evt => {
                evt.item.style.opacity = '0.5';
                this._hoverCandidate = null;
                this._hoverSince = 0;
                this._dragSnapshot = null;
                this._mergeTargetIndex = null;
                // 记录拖拽开始时所有格子的位置（拖拽中布局会重排，实时 rect 不可用）
                this._dragSnapshot = [...grid.querySelectorAll('.quick-access-item')].map(el => ({
                    el,
                    rect: el.getBoundingClientRect(),
                }));

                // 指针静止时 onMove 不触发，用定时器持续判定悬停阈值
                clearInterval(this._mergeTimer);
                this._mergeTimer = setInterval(() => {
                    this.updateMergeCandidate(grid, evt.item);
                }, 120);

                // 记录拖拽开始时的页面信息
                this.dragStartInfo = {
                    page: pageNumber,
                    itemId: evt.item.dataset.itemId,
                    itemName: evt.item.textContent.trim(),
                };
                console.log('拖拽开始信息:', this.dragStartInfo);

                // 关闭跨页检测，不绑定全局指针监听
            },

            // 拖拽结束：落在另一个图标上 → 合并成文件夹；否则按位置排序
            // 注意：Sortable 在 onEnd 之前已把元素移到目标位置，此时指针下是被拖元素本身，
            // 因此必须使用 onMove 阶段记录的目标索引，不能在 onEnd 里重新做命中检测
            onEnd: evt => {
                evt.item.style.opacity = '';
                clearInterval(this._mergeTimer);
                this._mergeTimer = null;
                grid.querySelectorAll('.merge-target, .merge-candidate').forEach(el =>
                    el.classList.remove('merge-target', 'merge-candidate')
                );
                this._hoverCandidate = null;
                this._hoverSince = 0;

                const draggedIndex = parseInt(evt.item.dataset.index, 10);
                const targetIndex = this._mergeTargetIndex;
                this._dragPointer = null;
                this._mergeTargetIndex = null;
                this.dragStartInfo = null;

                if (
                    Number.isInteger(targetIndex) &&
                    Number.isInteger(draggedIndex) &&
                    targetIndex !== draggedIndex
                ) {
                    // 合并失败/用户取消时，Sortable 已经把 DOM 换过位置，
                    // 必须按数据重渲染把图标还原，否则界面和数据对不上
                    Promise.resolve(this.onItemMerge(draggedIndex, targetIndex))
                        .then(merged => {
                            if (!merged) this.renderCurrentPage();
                        })
                        .catch(err => {
                            console.error('合并回调异常:', err);
                            this.renderCurrentPage();
                        });
                    return;
                }

                this.handleItemMove(evt, pageNumber);
            },

            // 项目添加到容器（跨页拖拽当前关闭，保留钩子）
            onAdd: () => {},

            // 项目从容器移除（跨页拖拽当前关闭，保留钩子）
            onRemove: () => {},
        });

        this.sortableInstances.set(pageNumber, sortableInstance);
        // 初始化完成
    }

    // 处理项目移动（同页内排序）
    // 以 DOM 中的 data-index 取回被拖动的原始条目，再按新顺序写回 items，
    // 不能原地自赋值（那样数组永远不变，刷新后顺序回滚）
    handleItemMove(evt, pageNumber) {
        const nodes = Array.from(evt.to.querySelectorAll('.quick-access-item'));
        const startIndex = (pageNumber - 1) * this.itemsPerPage;

        // 按 DOM 顺序取出对应的原始条目（"＋"按钮没有 data-index，天然被排除）
        const pageItems = nodes
            .map(node => parseInt(node.dataset.index, 10))
            .filter(Number.isInteger)
            .map(globalIndex => this.items[globalIndex])
            .filter(Boolean);

        if (pageItems.length === 0) return;

        const next = this.items.slice();
        next.splice(startIndex, pageItems.length, ...pageItems);
        this.items = next;

        this.onItemMove(this.items);
    }

    // 渲染分页控件
    renderPaginationControls() {
        const totalPages = this.getTotalPages();

        this.controlsContainer.innerHTML = '';

        // 始终渲染分页按钮（即使只有一页），但禁用前后按钮

        // 上一页按钮
        const prevButton = document.createElement('button');
        prevButton.innerHTML = '‹';
        prevButton.className = 'page-btn prev-btn';
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener('click', () => this.previousPage());
        this.controlsContainer.appendChild(prevButton);

        // 页码按钮
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.className = 'page-btn';
            pageButton.classList.toggle('active', i === this.currentPage);

            pageButton.addEventListener('click', () => this.goToPage(i));
            this.controlsContainer.appendChild(pageButton);
        }

        // 下一页按钮
        const nextButton = document.createElement('button');
        nextButton.innerHTML = '›';
        nextButton.className = 'page-btn next-btn';
        nextButton.disabled = this.currentPage === totalPages;
        nextButton.addEventListener('click', () => this.nextPage());
        this.controlsContainer.appendChild(nextButton);

        // 额外信息已移除
    }

    // 设置项目数据
    setItems(items) {
        this.items = items;

        // 检查当前页是否超出新的总页数范围，如果是则调整到最后一页
        const newTotalPages = this.getTotalPages();
        if (this.currentPage > newTotalPages) {
            this.currentPage = newTotalPages;
        }

        // 如果已有分页结构，只更新内容，不重新创建
        if (this.currentPageContainer) {
            this.renderCurrentPage();
            this.renderPaginationControls();
        } else {
            // 首次创建时才调用 render()
            this.render();
        }

        // 数据已更新
    }

    // 跳转到指定页面
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) {
            return;
        }

        this.currentPage = page;
        this.queueRender(true);
        this.onPageChange(page);
        // 切换完成
    }

    // 上一页
    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    // 下一页
    nextPage() {
        const totalPages = this.getTotalPages();
        if (this.currentPage < totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    // 获取总页数
    getTotalPages() {
        // 计算实际需要的页数
        const pagesFromItems = Math.ceil(this.items.length / this.itemsPerPage);

        // 如果项目数量刚好填满一页，需要第二页来放置添加按钮
        if (this.items.length > 0 && this.items.length % this.itemsPerPage === 0) {
            return pagesFromItems + 1;
        }

        return Math.max(pagesFromItems, 1);
    }

    // 获取当前页
    getCurrentPage() {
        return this.currentPage;
    }

    // 触摸滑动翻页已移除
    bindEvents() {}

    // initTouchNavigation 已删除

    // 销毁组件
    destroy() {
        // 销毁所有SortableJS实例
        this.sortableInstances.forEach(instance => {
            instance.destroy();
        });
        this.sortableInstances.clear();

        this.container.innerHTML = '';
        // 销毁完成
    }

    // 合并渲染，避免短时间重复渲染
    queueRender(updateControls = true) {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        requestAnimationFrame(() => {
            this._renderScheduled = false;
            if (!this.currentPageContainer) return;
            this.renderCurrentPage();
            if (updateControls) this.renderPaginationControls();
        });
    }
}

// 合并悬停阈值（毫秒）
AdvancedPagination.HOVER_MS = 520;

// 显式挂载到 window（跨 script 全局访问不再依赖经典 script 词法绑定）
window.AdvancedPagination = AdvancedPagination;
