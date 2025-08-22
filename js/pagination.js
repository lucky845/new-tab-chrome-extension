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
        this.paginationContainer.style.cssText = `
            position: relative;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        `;
        
        // 创建当前页面容器
        this.currentPageContainer = document.createElement('div');
        this.currentPageContainer.className = 'current-page-container';
        this.currentPageContainer.style.cssText = `
            width: 100%;
            position: relative;
        `;
        
        // 创建分页控件容器
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'pagination-controls';
        this.controlsContainer.style.cssText = `
            position: fixed;
            left: 50%;
            bottom: 40px;
            transform: translateX(-50%);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            z-index: 20;
        `;
        
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
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
            padding: 20px;
            margin-bottom: 20px;
        `;
        
        // 计算当前页的项目
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentPageItems = this.items.slice(startIndex, endIndex);
        
        // 渲染项目
        currentPageItems.forEach((item, index) => {
            const itemElement = this.createItemElement(item, startIndex + index);
            grid.appendChild(itemElement);
        });
        
        // 添加按钮（只在最后一页显示）
        if (this.currentPage === this.getTotalPages()) {
            const addButton = this.createAddButton();
            grid.appendChild(addButton);
        }
        
        this.currentPageContainer.appendChild(grid);
        
        // 初始化当前页的SortableJS
        this.initSortableForPage(grid, this.currentPage);
    }
    
    // 创建项目元素
    createItemElement(item, globalIndex) {
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
        addButton.textContent = '+';
        addButton.title = '添加快捷方式';
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
            onStart: (evt) => {
                console.log(`开始拖拽项目: ${evt.item.textContent.trim()}`);
                evt.item.style.opacity = '0.5';
                
                // 记录拖拽开始时的页面信息
                this.dragStartInfo = {
                    page: pageNumber,
                    itemId: evt.item.dataset.itemId,
                    itemName: evt.item.textContent.trim()
                };
                console.log('拖拽开始信息:', this.dragStartInfo);

                // 关闭跨页检测，不绑定全局指针监听
            },
            
            // 拖拽结束
            onEnd: (evt) => {
                console.log('拖拽结束');
                evt.item.style.opacity = '';
                
                // 清除翻页箭头
                this.hidePageFlipArrow();
                
                // 无全局监听，无需解除

                // 检查是否是跨页面拖拽
                // 仅同页内排序
                this.handleItemMove(evt, pageNumber);
                
                // 清除拖拽开始信息
                this.dragStartInfo = null;
            },
            
            // 项目添加到容器
            onAdd: (evt) => {
                console.log('项目添加到容器');
                // 这里不需要处理，因为onEnd已经处理了跨页面逻辑
            },
            
            // 项目从容器移除
            onRemove: (evt) => {
                console.log('项目从容器移除');
                // 这里不需要处理，因为onEnd已经处理了跨页面逻辑
            },
            
            // 拖拽移动
            onMove: (evt) => {
                // 防止拖拽到添加按钮
                if (evt.related && evt.related.classList.contains('add-quick-access-btn')) {
                    return false;
                }
                
                // 关闭边缘翻页检测
                
                return true;
            }
        });
        
        this.sortableInstances.set(pageNumber, sortableInstance);
        console.log(`第${pageNumber}页SortableJS已初始化`);
    }
    
    // 处理项目移动（同页内排序）
    handleItemMove(evt, pageNumber) {
        console.log(`处理第${pageNumber}页项目移动...`);
        
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
        console.log('同页项目移动处理完成');
    }
    

    
    // 检查网格外拖拽，显示翻页箭头
    checkPageBoundaryDrag(evt) {
        // 已禁用
        if (!this.dragStartInfo) return;
        
        const gridElement = this.currentPageContainer.querySelector('.quick-access-grid');
        if (!gridElement) {
            console.warn('未找到网格元素');
            return;
        }
        
        const gridRect = gridElement.getBoundingClientRect();
        const mouseX = (evt && evt.clientX !== undefined) ? evt.clientX : (evt && evt.touches && evt.touches[0] ? evt.touches[0].clientX : null);
        const mouseY = (evt && evt.clientY !== undefined) ? evt.clientY : (evt && evt.touches && evt.touches[0] ? evt.touches[0].clientY : null);
        
        if (mouseX === null || mouseY === null) return;
        
        const totalPages = this.getTotalPages();
        
        // 调试信息：输出网格边界和鼠标位置
        console.log('网格边界:', {
            left: gridRect.left,
            right: gridRect.right,
            top: gridRect.top,
            bottom: gridRect.bottom
        });
        console.log('鼠标位置:', { x: mouseX, y: mouseY });
        
        // 检查鼠标是否在网格外部
        const isOutsideGrid = mouseX < gridRect.left || mouseX > gridRect.right || 
                             mouseY < gridRect.top || mouseY > gridRect.bottom;
        
        console.log('是否在网格外部:', isOutsideGrid);
        
        if (isOutsideGrid) {
            // 在网格外部，显示翻页箭头
            if (mouseX < gridRect.left && this.currentPage > 1) {
                console.log('检测到左侧外部，显示左箭头');
                this.showPageFlipArrow('left');
            } else if (mouseX > gridRect.right && this.currentPage < totalPages) {
                console.log('检测到右侧外部，显示右箭头');
                this.showPageFlipArrow('right');
            } else {
                console.log('其他外部区域，隐藏箭头');
                this.hidePageFlipArrow();
            }
        } else {
            // 在网格内部，隐藏箭头
            this.hidePageFlipArrow();
        }
        
        // 检查是否移动到箭头上
        this.checkArrowHover(evt);
    }
    
    // 显示翻页箭头
    showPageFlipArrow(direction) {
        return; // 已禁用
        // 如果箭头已存在且方向相同，不重复创建
        if (this.pageFlipArrow && this.pageFlipArrow.dataset.direction === direction) {
            return;
        }
        
        // 移除现有箭头
        this.hidePageFlipArrow();
        
        const arrow = document.createElement('div');
        arrow.className = 'page-flip-arrow';
        arrow.dataset.direction = direction;
        
        const gridElement = this.currentPageContainer.querySelector('.quick-access-grid');
        const gridRect = gridElement.getBoundingClientRect();
        
        arrow.style.cssText = `
            position: fixed;
            top: 50%;
            ${direction === 'left' ? 'left: 50px' : 'right: 50px'};
            transform: translateY(-50%);
            width: 60px;
            height: 60px;
            background: rgba(76, 175, 80, 0.9);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            cursor: pointer;
            animation: arrowPulse 1s infinite;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        arrow.innerHTML = direction === 'left' ? '‹' : '›';
        arrow.title = direction === 'left' ? '拖拽到此处翻到上一页' : '拖拽到此处翻到下一页';
        
        // 添加悬停效果
        arrow.addEventListener('mouseenter', () => {
            arrow.style.background = 'rgba(76, 175, 80, 1)';
            arrow.style.transform = 'translateY(-50%) scale(1.1)';
        });
        
        arrow.addEventListener('mouseleave', () => {
            arrow.style.background = 'rgba(76, 175, 80, 0.9)';
            arrow.style.transform = 'translateY(-50%) scale(1)';
        });
        
        document.body.appendChild(arrow);
        this.pageFlipArrow = arrow;
        
        console.log(`显示${direction === 'left' ? '左' : '右'}翻页箭头`);
        console.log('箭头元素:', arrow);
        console.log('箭头位置:', {
            left: direction === 'left' ? '50px' : 'right: 50px',
            top: '50%',
            transform: 'translateY(-50%)'
        });
    }
    
    // 隐藏翻页箭头
    hidePageFlipArrow() {
        if (this.pageFlipArrow) {
            this.pageFlipArrow.remove();
            this.pageFlipArrow = null;
        }
    }
    
    // 检查是否移动到箭头上
    checkArrowHover(evt) {
        return; // 已禁用
        
        const arrowRect = this.pageFlipArrow.getBoundingClientRect();
        const mouseX = (evt && evt.clientX !== undefined) ? evt.clientX : (evt && evt.touches && evt.touches[0] ? evt.touches[0].clientX : null);
        const mouseY = (evt && evt.clientY !== undefined) ? evt.clientY : (evt && evt.touches && evt.touches[0] ? evt.touches[0].clientY : null);
        
        if (mouseX === null || mouseY === null) return;
        
        // 检查鼠标是否在箭头区域内
        const isOverArrow = mouseX >= arrowRect.left && mouseX <= arrowRect.right &&
                           mouseY >= arrowRect.top && mouseY <= arrowRect.bottom;
        
        if (isOverArrow) {
            // 鼠标在箭头上，执行翻页
            const direction = this.pageFlipArrow.dataset.direction;
            console.log(`鼠标移动到${direction === 'left' ? '左' : '右'}箭头，执行翻页`);
            
            if (direction === 'left') {
                this.previousPage();
            } else {
                this.nextPage();
            }
            
            // 隐藏箭头
            this.hidePageFlipArrow();
        }
    }
    
    // 处理跨页面移动
    handleCrossPageMove(draggedItem, fromPage, toPage) {
        const itemId = draggedItem.dataset.itemId;
        const itemName = draggedItem.textContent.trim();
        
        console.log(`项目 "${itemName}" 从第${fromPage}页移动到第${toPage}页`);
        
        // 计算源页和目标页的项目范围
        const fromStartIndex = (fromPage - 1) * this.itemsPerPage;
        const fromEndIndex = fromStartIndex + this.itemsPerPage;
        const toStartIndex = (toPage - 1) * this.itemsPerPage;
        const toEndIndex = toStartIndex + this.itemsPerPage;
        
        // 找到要移动的项目
        const itemToMove = this.items.find(item => (item.id || item.url) === itemId);
        if (!itemToMove) {
            console.warn('未找到要移动的项目:', itemId);
            return;
        }
        
        // 从源页移除项目
        const fromPageItems = this.items.slice(fromStartIndex, fromEndIndex);
        const fromItemIndex = fromPageItems.findIndex(item => (item.id || item.url) === itemId);
        
        if (fromItemIndex !== -1) {
            // 从源页移除
            this.items.splice(fromStartIndex + fromItemIndex, 1);
            
            // 添加到目标页
            const toPageItems = this.items.slice(toStartIndex, toEndIndex);
            const insertIndex = Math.min(toPageItems.length, this.itemsPerPage - 1);
            this.items.splice(toStartIndex + insertIndex, 0, itemToMove);
            
            console.log('跨页面移动完成，重新渲染页面...');
            
            // 重新渲染相关页面
            this.renderCurrentPage();
            this.renderPaginationControls();
            
            // 调用跨页面移动回调
            this.onCrossPageMove({
                item: itemToMove,
                fromPage,
                toPage,
                newItems: this.items
            });
        }
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
        this.currentPage = 1;
        this.render();
        console.log(`高级分页数据已更新，共${items.length}个项目`);
    }
    
    // 跳转到指定页面
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) {
            return;
        }
        
        this.currentPage = page;
        this.renderCurrentPage();
        this.renderPaginationControls();
        this.onPageChange(page);
        console.log(`切换到第 ${page} 页`);
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
        return Math.ceil(this.items.length / this.itemsPerPage);
    }
    
    // 获取当前页
    getCurrentPage() {
        return this.currentPage;
    }
    
    // 触摸滑动翻页已移除
    bindEvents() {}
    
    // initTouchNavigation 已删除
    
    // 启用/禁用跨页面拖拽
    setCrossPageDrag(enabled) {
        this.enableCrossPageDrag = enabled;
        console.log(`跨页面拖拽已${enabled ? '启用' : '禁用'}`);
        
        // 重新初始化所有页面的SortableJS
        this.sortableInstances.forEach((instance, pageNumber) => {
            instance.destroy();
        });
        this.sortableInstances.clear();
        
        this.renderCurrentPage();
    }
    
    // 销毁组件
    destroy() {
        // 销毁所有SortableJS实例
        this.sortableInstances.forEach(instance => {
            instance.destroy();
        });
        this.sortableInstances.clear();
        
        this.container.innerHTML = '';
        console.log('高级分页组件已销毁');
    }
}
