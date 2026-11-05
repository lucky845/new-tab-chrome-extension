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
                    const icon = document.createElement('img');
                    icon.className = 'icon';
                    icon.alt = '';
                    icon.src =
                        site.icon && /^https?:|<svg/.test(site.icon)
                            ? site.icon
                            : `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(site.url)}`;
                    cell.appendChild(icon);
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
        itemElement.href = item.url;
        itemElement.className = 'quick-access-item';
        itemElement.target = '_blank';
        itemElement.dataset.index = globalIndex;
        itemElement.dataset.itemId = item.id || globalIndex;
        itemElement.dataset.page = this.currentPage;

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';

        if (item.icon) {
            if (item.icon.trim().startsWith('<svg')) {
                iconWrapper.innerHTML = item.icon;
                const svg = iconWrapper.querySelector('svg');
                if (svg) {
                    svg.classList.add('icon');
                }
            } else {
                const icon = document.createElement('img');
                icon.src = item.icon;
                icon.className = 'icon';
                icon.alt = `${item.name} Icon`;
                iconWrapper.appendChild(icon);
            }
        } else {
            const icon = document.createElement('img');
            icon.src = `https://www.google.com/s2/favicons?sz=64&domain_url=${item.url}`;
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
        iconWrapper.textContent = '+';
        iconWrapper.style.fontSize = '32px';
        iconWrapper.style.fontWeight = '300';

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
            animation: 150,
            easing: 'cubic-bezier(1, 0, 0, 1)',

            // 拖拽开始
            onStart: evt => {
                console.log(`开始拖拽项目: ${evt.item.textContent.trim()}`);
                evt.item.style.opacity = '0.5';

                // 记录拖拽开始时的页面信息
                this.dragStartInfo = {
                    page: pageNumber,
                    itemId: evt.item.dataset.itemId,
                    itemName: evt.item.textContent.trim(),
                };
                console.log('拖拽开始信息:', this.dragStartInfo);

                // 关闭跨页检测，不绑定全局指针监听
            },

            // 拖拽结束
            onEnd: evt => {
                console.log('拖拽结束');
                evt.item.style.opacity = '';

                // 处理同页内排序
                this.handleItemMove(evt, pageNumber);

                // 清除拖拽开始信息
                this.dragStartInfo = null;
            },

            // 项目添加到容器
            onAdd: evt => {
                console.log('项目添加到容器');
            },

            // 项目从容器移除
            onRemove: evt => {
                console.log('项目从容器移除');
            },

            // 拖拽移动
            onMove: evt => {
                // 防止拖拽到添加按钮
                if (evt.related && evt.related.classList.contains('add-quick-access-btn')) {
                    return false;
                }

                // 防止拖拽添加按钮本身
                if (evt.dragged && evt.dragged.classList.contains('add-quick-access-btn')) {
                    return false;
                }

                return true;
            },
        });

        this.sortableInstances.set(pageNumber, sortableInstance);
        // 初始化完成
    }

    // 处理项目移动（同页内排序）
    handleItemMove(evt, pageNumber) {
        // 处理同页内排序

        const items = Array.from(evt.to.querySelectorAll('.quick-access-item'));
        const startIndex = (pageNumber - 1) * this.itemsPerPage;

        // 更新当前页的项目顺序
        items.forEach((item, index) => {
            const globalIndex = startIndex + index;
            if (globalIndex < this.items.length) {
                const originalItem = this.items[globalIndex];
                if (originalItem) {
                    this.items[globalIndex] = originalItem;
                }
            }
        });

        // 调用回调函数
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

// 显式挂载到 window（跨 script 全局访问不再依赖经典 script 词法绑定）
window.AdvancedPagination = AdvancedPagination;
