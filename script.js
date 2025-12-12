/**
 * SimpleDiaryApp - v5.5 (美观样式最终整合版)
 * -------------------------------------------
 * - [UI还原] 完全基于用户偏好的 v5.0 美观样式进行开发。
 * - [功能整合] 将 v5.4 的所有功能逻辑（智能字体解析、自定义日记本字体等）无缝对接到 v5.0 的HTML结构上。
 * - [需求实现] 彻底移除“站酷快乐体”预设，不再作为可选字体。
 * - [需求实现] 3D日记本默认中文字体更新为指定CSS，英文字体更新为 Sacramento 花体。
 * - [修复] 修正了所有DOM元素选择器，以匹配旧版HTML的ID和类名。
 * - [优化] 统一了字体管理逻辑，用户添加的字体可同时用于全局和日记本。
 */
class SimpleDiaryApp {
    constructor() {
        this.constructor.defaultSettings = {
            theme: 'light',
            fontId: 'sans-serif',
            customFonts: [], // 结构: { name: '别名', family: '真实font-family', url: '...' }
            bookFont: {
                chinese: { name: '站酷高端黑', family: 'zcool-gdh', url: 'https://fontsapi.zeoseven.com/96/main/result.css' },
                english: { name: 'Sacramento', family: 'Sacramento', url: 'https://fonts.googleapis.com/css2?family=Sacramento&display=swap' }
            },
            profile: {
                name: '匿名用户',
                signature: '这个人很神秘，什么也没说。',
                avatar: ''
            },
            timeFormat: 'relative',
            sortOrder: 'newest'
        };

        this.entries = [];
        this.settings = JSON.parse(JSON.stringify(this.constructor.defaultSettings));

        // [关键改动] 移除了 handwritten
        this.fontMap = {
            'sans-serif': { name: "思源黑体", font: "'Noto Sans SC', sans-serif" },
            'serif': { name: "思源宋体", font: "'Noto Serif SC', serif" }
        };
        
        // 状态变量
        this.isBookOpen = false; this.isBookAnimating = false; this.isPageAnimating = false; this.areFontsRendered = false; this.isSaving = false; this.isFetching = false;
        this.currentBookEntries = []; this.currentPageIndex = 0; this.currentDeletingEntryId = null; this.searchDebounceTimer = null;

        this.init();
    }

    // --- 1. 初始化与数据处理 ---
    init() {
        this.loadData();
        this.loadCustomFonts();
        this.setupEventListeners();
        this.applySettings();
        this.applyBookFonts();
        this.updateProfileDisplay();
        this.renderEntries();
        this.checkInitialState();
        document.getElementById('loading-overlay').classList.add('hidden');
    }
    
    checkInitialState() {
        if (!localStorage.getItem('diaryAppVisited')) {
            this.showModal('welcome-modal');
        }
    }

    loadData() {
        try {
            const savedData = localStorage.getItem('diaryAppData');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.entries = data.entries || [];
                // 深度合并设置，确保新旧版本兼容
                const mergedSettings = this.mergeDeep(
                    JSON.parse(JSON.stringify(this.constructor.defaultSettings)), 
                    data.settings || {}
                );
                // [兼容性处理] 转换旧的自定义字体格式
                mergedSettings.customFonts = (mergedSettings.customFonts || []).map(font => {
                    if (typeof font === 'object' && font !== null && !font.family && font.name) {
                        return { name: font.name, family: font.name, url: font.url }; 
                    }
                    return font;
                });
                this.settings = mergedSettings;
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showToast('加载本地数据失败', 'error');
        }
    }

    saveData() {
        try {
            localStorage.setItem('diaryAppData', JSON.stringify({
                entries: this.entries,
                settings: this.settings
            }));
        } catch (error) {
            console.error('保存数据失败:', error);
            this.showToast('保存数据失败', 'error');
        }
    }

    setupEventListeners() {
        const bind = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler.bind(this));
        
        // 核心操作按钮
        bind('open-entry-form-btn', 'click', () => this.openEntryForm());
        bind('toggle-3d-view-btn', 'click', this.toggle3DView);
        bind('profile-btn', 'click', this.openProfileModal);
        bind('settings-btn', 'click', this.openSettingsModal);
        
        // 搜索
        bind('search-input', 'input', this.handleSearch);
        bind('clear-search-btn', 'click', this.clearSearch);

        // 写日记模态框
        bind('close-entry-form-btn', 'click', this.closeEntryForm);
        bind('save-entry-btn', 'click', this.saveEntry);
        bind('toggle-tags-input-btn', 'click', this.toggleTagsInput);
        
        // 删除确认模态框
        bind('cancel-delete-btn', 'click', this.closeConfirmationModal);
        bind('confirm-delete-btn', 'click', this.confirmDeleteEntry);
        
        // 个人资料模态框
        bind('close-profile-btn', 'click', this.closeProfileModal);
        bind('edit-profile-btn', 'click', this.openEditProfileModal);
        
        // 编辑个人资料模态框
        bind('cancel-edit-profile-btn', 'click', this.closeEditProfileModal);
        bind('save-profile-btn', 'click', this.saveProfile);
        bind('profile-avatar-upload-trigger', 'click', () => document.getElementById('profile-avatar-file-input')?.click());
        bind('profile-avatar-file-input', 'change', (e) => this.handleAvatarUpload(e));
        
        // 设置模态框
        bind('close-settings-btn', 'click', this.closeSettingsModal);
        bind('save-settings-btn', 'click', this.saveSettings);
        bind('export-data-btn', 'click', this.exportData);
        bind('import-data-btn', 'click', () => document.getElementById('import-file-input')?.click());
        bind('import-file-input', 'change', (e) => this.importData(e));
        bind('clear-all-data-btn', 'click', this.openClearDataModal);
        
        // 字体管理
        bind('add-custom-font-btn', 'click', this.addCustomFont);
        
        // 清除数据模态框
        bind('cancel-clear-data-btn', 'click', this.closeClearDataModal);
        bind('confirm-clear-data-btn', 'click', this.confirmClearAllData);
        bind('clear-data-confirm-input', 'input', (e) => this.checkClearDataInput(e.target));
        
        // 欢迎页和滚动
        bind('close-welcome-btn', 'click', this.closeWelcomeModal);
        bind('scroll-to-top-btn', 'click', this.scrollToTop);
        
        // 3D日记本控制
        bind('prev-page-btn', 'click', () => this.changePage(-1));
        bind('next-page-btn', 'click', () => this.changePage(1));
        bind('close-book-btn', 'click', this.closeBookView);

        // 事件委托（更高效）
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', e => e.target === modal && this.closeModal(modal.id));
        });
        
        document.getElementById('font-options-container')?.addEventListener('click', this.handleFontSelection.bind(this));
        
        document.getElementById('custom-font-list')?.addEventListener('click', e => {
            const deleteBtn = e.target.closest('.delete-font-btn');
            if (deleteBtn) {
                this.deleteCustomFont(parseInt(deleteBtn.dataset.index, 10));
            }
        });
        
        document.getElementById('settings-nav-list')?.addEventListener('click', e => {
            const tab = e.target.closest('li');
            if (tab) this.switchSettingsTab(tab);
        });
        
        document.querySelector('.theme-grid')?.addEventListener('click', e => {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) this.selectTheme(themeOption.dataset.theme);
        });
        
        // 全局事件
        window.addEventListener('scroll', () => {
            const btn = document.getElementById('scroll-to-top-btn');
            if (window.scrollY > 300) btn.classList.add('show');
            else btn.classList.remove('show');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal-overlay.active');
                if (activeModal) this.closeModal(activeModal.id);
            }
        });
    }
    
    // --- 2. 日记核心功能 ---
    saveEntry() {
        if (this.isSaving) return;
        const saveBtn = document.getElementById('save-entry-btn');
        const content = document.getElementById('diary-textarea').value.trim();
        if (!content) {
            this.showToast('日记内容不能为空哦', 'error');
            return;
        }

        this.isSaving = true;
        saveBtn.disabled = true;
        saveBtn.textContent = '发布中...';

        setTimeout(() => {
            const tags = document.getElementById('entry-tags-input').value.split(',').map(t => t.trim()).filter(Boolean);
            const entryId = document.getElementById('editing-entry-id').value;
            const now = new Date().toISOString();
            if (entryId) {
                const entry = this.entries.find(e => e.id === entryId);
                if (entry) {
                    entry.content = content;
                    entry.tags = tags;
                    entry.updatedAt = now;
                    this.showToast('日记已更新');
                }
            } else {
                this.entries.unshift({ id: this.generateId(), content, tags, createdAt: now, updatedAt: now });
                this.showToast('日记已发布');
            }
            this.saveData();
            this.renderEntries();
            this.updateProfileDisplay();
            this.closeEntryForm();

            this.isSaving = false;
            saveBtn.disabled = false;
            saveBtn.textContent = '发布';
        }, 300);
    }

    deleteEntry(entryId) {
        this.currentDeletingEntryId = entryId;
        this.openModal('confirmation-modal');
    }

    confirmDeleteEntry() {
        if (this.currentDeletingEntryId) {
            this.entries = this.entries.filter(e => e.id !== this.currentDeletingEntryId);
            this.saveData();
            this.renderEntries();
            this.updateProfileDisplay();
            this.showToast('日记已删除', 'info');
        }
        this.closeConfirmationModal();
    }

    // --- 3. 渲染与视图 ---
    renderEntries(query = '') {
        const container = document.getElementById('diary-thread');
        let filteredEntries = [...this.entries];
        if (query) {
            const lowerQuery = query.toLowerCase();
            filteredEntries = filteredEntries.filter(e =>
                e.content.toLowerCase().includes(lowerQuery) ||
                (e.tags && e.tags.some(t => t.toLowerCase().includes(lowerQuery)))
            );
        }
        filteredEntries.sort((a, b) => this.settings.sortOrder === 'oldest'
            ? new Date(a.createdAt) - new Date(b.createdAt)
            : new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        if (filteredEntries.length === 0) {
            container.innerHTML = `<div class="empty-message"><h3>${query ? '没有找到相关日记' : '还没有日记'}</h3><p>${query ? '换个关键词试试？' : '点击“写新日记”开始记录吧！'}</p></div>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        filteredEntries.forEach((entry, index) => fragment.appendChild(this.createEntryElement(entry, index)));
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    createEntryElement(entry, index) {
        const div = document.createElement('div');
        div.className = 'diary-entry';
        div.style.animationDelay = `${index * 0.05}s`;
        const tagsHtml = (entry.tags && entry.tags.length > 0)
            ? `<div class="entry-tags">${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
            : '';
        div.innerHTML = `
            <div class="entry-meta">
                <div class="author-info">
                    <div class="avatar">${this.getAvatarHtml(this.settings.profile.avatar, this.settings.profile.name)}</div>
                    <span>${this.settings.profile.name}</span>
                </div>
                <div class="entry-metadata-details">
                    <span class="timestamp" title="${new Date(entry.createdAt).toLocaleString()}">${this.getFormattedTime(entry.createdAt)}</span>
                </div>
                ${tagsHtml}
                <div class="entry-actions">
                    <button class="icon-btn edit-btn" title="编辑"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button class="icon-btn delete-btn" title="删除"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                </div>
            </div>
            <div class="entry-content">${this.formatContent(entry.content)}</div>`;
        div.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); this.openEntryForm(entry.id); });
        div.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); this.deleteEntry(entry.id); });
        return div;
    }

    // --- 4. 3D日记本 ---
    toggle3DView() {
        if (this.isBookAnimating) return; 
        this.isBookOpen ? this.closeBookView() : this.openBookView();
    }

    openBookView() {
        this.isBookAnimating = true;
        this.isBookOpen = true;
        document.getElementById('diary-thread').classList.add('hidden');
        document.getElementById('diary-book-3d').classList.remove('hidden');
        this.renderBookPages();
        
        setTimeout(() => {
            document.querySelector('.book-cover').classList.add('opened');
            setTimeout(() => {
                document.querySelector('.book-pages').classList.add('visible');
                this.isBookAnimating = false;
            }, 500);
        }, 100);
    }

    closeBookView() {
        this.isBookAnimating = true;
        this.isBookOpen = false;
        document.querySelector('.book-cover').classList.remove('opened');
        document.querySelector('.book-pages').classList.remove('visible');
        
        setTimeout(() => {
            document.getElementById('diary-book-3d').classList.add('hidden');
            document.getElementById('diary-thread').classList.remove('hidden');
            this.isBookAnimating = false;
        }, 800);
    }

    renderBookPages() {
        const container = document.querySelector('#diary-book-3d .pages-container');
        this.currentBookEntries = [...this.entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (this.currentBookEntries.length === 0) {
            container.innerHTML = `<div class="book-page"><div class="empty-page"><h3>日记本是空的</h3><p>快去写下第一篇日记吧！</p></div></div>`;
            this.currentPageIndex = -1;
        } else {
            const fragment = document.createDocumentFragment();
            this.currentBookEntries.forEach((entry, i) => {
                const page = document.createElement('div');
                page.className = 'book-page';
                page.style.zIndex = this.currentBookEntries.length - i;
                page.innerHTML = `
                    <div class="page-content-wrapper">
                        <div class="page-header"><div class="page-date">${this.getFormattedTime(entry.createdAt, 'full')}</div></div>
                        <div class="page-content">${this.formatContent(entry.content)}</div>
                        <div class="page-number">${i + 1} / ${this.currentBookEntries.length}</div>
                    </div>`;
                fragment.appendChild(page);
            });
            container.innerHTML = '';
            container.appendChild(fragment);
            this.currentPageIndex = 0;
        }
        this.updatePageIndicator();
    }
    
    changePage(direction) {
        if (this.isPageAnimating) return;
        const newIndex = this.currentPageIndex + direction;
    
        if (newIndex >= 0 && newIndex < this.currentBookEntries.length) {
            this.isPageAnimating = true;
            const pages = document.querySelectorAll('.book-page');
            
            if (direction > 0) {
                pages[this.currentPageIndex].classList.add('flipped');
            } else {
                pages[newIndex].classList.remove('flipped');
            }
    
            this.currentPageIndex = newIndex;
            this.updatePageIndicator();
            setTimeout(() => { this.isPageAnimating = false; }, 800);
        }
    }
    
    updatePageIndicator() {
        document.getElementById('current-page').textContent = this.currentPageIndex >= 0 ? `第 ${this.currentPageIndex + 1} 页` : '封面';
        document.getElementById('prev-page-btn').disabled = this.currentPageIndex <= 0;
        document.getElementById('next-page-btn').disabled = this.currentPageIndex >= this.currentBookEntries.length - 1;
    }
    
    // --- 5. 个人资料 ---
    updateProfileDisplay() {
        const profile = this.settings.profile;
        const avatarHtml = this.getAvatarHtml(profile.avatar, profile.name);
        document.getElementById('header-avatar-display').innerHTML = avatarHtml;
        document.getElementById('profile-display-avatar').innerHTML = avatarHtml;
        document.getElementById('profile-display-name').textContent = profile.name || '匿名用户';
        document.getElementById('profile-display-signature').textContent = profile.signature || '这个人很神秘...';
        document.getElementById('total-entries').textContent = this.entries.length;
        document.getElementById('total-words').textContent = this.entries.reduce((sum, e) => sum + e.content.length, 0);
        const sortedEntries = [...this.entries].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        document.getElementById('latest-entry').textContent = sortedEntries.length > 0 ? this.getFormattedTime(sortedEntries[0].updatedAt || sortedEntries[0].createdAt) : '-';
    }

    saveProfile() {
        this.settings.profile.name = document.getElementById('profile-username-input').value.trim();
        this.settings.profile.signature = document.getElementById('profile-signature-input').value.trim();
        this.saveData();
        this.updateProfileDisplay();
        this.renderEntries();
        this.closeEditProfileModal();
        this.showToast('个人资料已保存');
    }

    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            this.settings.profile.avatar = e.target.result;
            this.updateAvatarPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    updateAvatarPreview(imageData = this.settings.profile.avatar) {
        const previewArea = document.getElementById('profile-avatar-preview-area');
        if (previewArea) {
            previewArea.innerHTML = this.getAvatarHtml(imageData, document.getElementById('profile-username-input').value);
        }
    }

    // --- 6. 设置 ---
    async saveSettings() {
        this.settings.theme = document.querySelector('.theme-option.active')?.dataset.theme || 'light';
        const activeFont = document.querySelector('.font-option.active');
        if (activeFont) this.settings.fontId = activeFont.dataset.fontId;
        this.settings.timeFormat = document.querySelector('input[name="timeFormat"]:checked').value;
        this.settings.sortOrder = document.querySelector('input[name="sortOrder"]:checked').value;
        
        // 保存日记本字体
        const zhUrl = document.getElementById('book-font-zh-url-input').value.trim();
        const enUrl = document.getElementById('book-font-en-url-input').value.trim();
        
        try {
            if (zhUrl && zhUrl !== this.settings.bookFont.chinese.url) {
                this.settings.bookFont.chinese = await this.parseFontInfo(zhUrl);
            } else if (!zhUrl) {
                this.settings.bookFont.chinese = { name: '', family: '', url: '' };
            }
            if (enUrl && enUrl !== this.settings.bookFont.english.url) {
                this.settings.bookFont.english = await this.parseFontInfo(enUrl);
            } else if (!enUrl) {
                this.settings.bookFont.english = { name: '', family: '', url: '' };
            }
        } catch (error) {
            this.showToast(`保存日记本字体失败: ${error.message}`, 'error');
        }

        this.saveData();
        this.applySettings();
        this.applyBookFonts();
        this.renderEntries();
        this.showToast('设置已保存');
        this.closeModal('settings-modal');
    }
    
    selectTheme(theme) {
        document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
        document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active');
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    // --- 7. 字体管理 ---
    handleFontSelection(event) {
        const fontOption = event.target.closest('.font-option');
        if (fontOption) this.selectFont(fontOption);
    }

    selectFont(fontEl) {
        document.querySelectorAll('.font-option').forEach(el => el.classList.remove('active'));
        fontEl.classList.add('active');
        const fontId = fontEl.dataset.fontId;
        
        let fontFamilyToApply = this.fontMap[fontId]?.font;

        if (fontId.startsWith('custom-')) {
            const index = parseInt(fontId.split('-')[1], 10);
            const customFont = this.settings.customFonts[index];
            if (customFont) {
                fontFamilyToApply = `'${customFont.family}', sans-serif`;
            }
        }
        document.body.style.fontFamily = fontFamilyToApply;
    }
    
    applySettings() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        
        const fullFontMap = {};
        Object.entries(this.fontMap).forEach(([id, config]) => fullFontMap[id] = config.font);
         this.settings.customFonts.forEach((font, index) => {
            fullFontMap[`custom-${index}`] = `'${font.family}', sans-serif`;
        });
        const fontToApply = fullFontMap[this.settings.fontId] || this.fontMap['sans-serif'].font;
        if (document.body.style.fontFamily !== fontToApply) {
            document.body.style.fontFamily = fontToApply;
        }
    }

    loadCustomFonts() {
        document.querySelectorAll('link[data-custom-font]').forEach(link => link.remove());
        this.settings.customFonts.forEach(font => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = font.url;
            link.dataset.customFont = "true";
            document.head.appendChild(link);
        });
        this.areFontsRendered = false; // Force re-render of options
    }

    renderFontOptions() {
        const container = document.getElementById('font-options-container');
        const customList = document.getElementById('custom-font-list');
        if (!container || !customList) return;

        container.innerHTML = '';
        customList.innerHTML = '';
        
        // Render preset fonts
        Object.entries(this.fontMap).forEach(([id, config]) => {
            const fontOption = document.createElement('div');
            fontOption.className = `font-option`;
            fontOption.dataset.fontId = id;
            fontOption.innerHTML = `<div class="font-preview ${id}">${config.name}</div><span>${config.name}</span><small>${config.description||''}</small>`;
            container.appendChild(fontOption);
        });
        
        // Render custom fonts
        this.settings.customFonts.forEach((font, index) => {
            const fontId = `custom-${index}`;
            const fontOption = document.createElement('div');
            fontOption.className = 'font-option custom-font-option';
            fontOption.dataset.fontId = fontId;
            fontOption.innerHTML = `<div class="font-preview" style="font-family: '${font.family}', sans-serif;">${font.name}</div><span>${font.name}</span><small>自定义</small>`;
            container.appendChild(fontOption);
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${font.name}</span> <button class="delete-font-btn" data-index="${index}">&times;</button>`;
            customList.appendChild(listItem);
        });

        // Re-apply active state
        const activeOption = container.querySelector(`.font-option[data-font-id="${this.settings.fontId}"]`);
        if (activeOption) activeOption.classList.add('active');

        this.areFontsRendered = true;
    }
    
    async parseFontInfo(url, userGivenName = '') {
        if (!url) throw new Error('URL不能为空');
        try { new URL(url); } catch (_) { if (!url.startsWith('data:')) throw new Error('无效的URL'); }

        let cssText = '';
        if (url.startsWith('data:')) {
             const parts = url.split(',');
             if (parts.length < 2) throw new Error('无效的Data URL格式');
             cssText = decodeURIComponent(parts[1]);
        } else {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`网络请求失败: ${res.statusText}`);
            cssText = await res.text();
        }
        
        const match = cssText.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/);
        if (!match || !match[1]) throw new Error('未能在文件中找到字体名称');
        
        const family = match[1].trim();
        const simpleName = userGivenName || family.split(',')[0].replace(/['"]/g, '').trim();
        
        return { name: simpleName, family: family, url };
    }

    async addCustomFont() {
        const nameInput = document.getElementById('custom-font-name-input');
        const urlInput = document.getElementById('custom-font-url-input');
        const addBtn = document.getElementById('add-custom-font-btn');
    
        const userGivenName = nameInput.value.trim();
        const url = urlInput.value.trim();
    
        if (!url) { this.showToast('字体链接不能为空', 'error'); return; }
    
        addBtn.disabled = true; addBtn.textContent = '解析中...';
    
        try {
            const fontInfo = await this.parseFontInfo(url, userGivenName);
            this.settings.customFonts.push(fontInfo);
            this.saveData();
            this.loadCustomFonts();
            this.renderFontOptions();
            this.showToast(`字体 "${fontInfo.name}" 已添加`);
            nameInput.value = ''; urlInput.value = '';
    
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            addBtn.disabled = false; addBtn.textContent = '添加';
        }
    }

    deleteCustomFont(index) {
        const font = this.settings.customFonts[index];
        if (confirm(`确定要删除字体 "${font.name}" 吗？`)) {
            const deletedFontId = `custom-${index}`;
            this.settings.customFonts.splice(index, 1);
            if(this.settings.fontId === deletedFontId){
                this.settings.fontId = 'sans-serif';
            } else if (this.settings.fontId.startsWith('custom-')) {
                const oldIndex = parseInt(this.settings.fontId.split('-')[1], 10);
                if (oldIndex > index) {
                    this.settings.fontId = `custom-${oldIndex - 1}`;
                }
            }
            this.saveData();
            this.loadCustomFonts();
            this.renderFontOptions();
            this.applySettings();
            this.showToast(`字体 "${font.name}" 已删除`);
        }
    }

    applyBookFonts() {
        document.querySelectorAll('style[data-book-font]').forEach(el => el.remove());
        
        const createStyle = (id, font) => {
            if (!font || !font.url) return;
            const style = document.createElement('style');
            style.dataset.bookFont = id;
            if (font.url.startsWith('data:')) {
                style.textContent = decodeURIComponent(font.url.substring(font.url.indexOf(',') + 1));
            } else {
                style.textContent = `@import url('${font.url}');`;
            }
            document.head.appendChild(style);
        };

        createStyle('chinese', this.settings.bookFont.chinese);
        createStyle('english', this.settings.bookFont.english);

        document.documentElement.style.setProperty('--book-font-zh', this.settings.bookFont.chinese?.family || 'var(--font-sans)');
        document.documentElement.style.setProperty('--book-font-en', this.settings.bookFont.english?.family || 'var(--font-script)');
    }
    
    // --- 8. 模态框控制 ---
    openModal(id) { document.getElementById(id)?.classList.add('active'); }
    closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

    openEntryForm(entryId = null) {
        const isEdit = entryId !== null;
        document.getElementById('entry-form-title').textContent = isEdit ? '编辑日记' : '记录此刻的想法...';
        const entry = isEdit ? this.entries.find(e => e.id === entryId) : null;
        document.getElementById('diary-textarea').value = entry ? entry.content : '';
        document.getElementById('entry-tags-input').value = entry && entry.tags ? entry.tags.join(', ') : '';
        document.getElementById('editing-entry-id').value = entryId || '';
        document.getElementById('tags-input-container').classList.toggle('hidden', !isEdit || !entry?.tags?.length);
        this.openModal('entry-form-modal');
    }
    closeEntryForm() { this.closeModal('entry-form-modal'); }

    openProfileModal() { this.openModal('profile-modal'); }
    closeProfileModal() { this.closeModal('profile-modal'); }
    
    openEditProfileModal() {
        document.getElementById('profile-username-input').value = this.settings.profile.name;
        document.getElementById('profile-signature-input').value = this.settings.profile.signature;
        this.updateAvatarPreview();
        this.openModal('edit-profile-modal
