/* --- 为了方便，这里是完整的 script.js --- */
/**
 * SimpleDiaryApp - v5.0 (智能字体升级版)
 * -------------------------------------------
 * - [重大升级] 自定义字体功能实现智能化：
 *   - 用户只需提供字体链接，应用可自动解析并提取正确的 font-family 名称。
 *   - “字体名称”变为可选的“别名”，若不填则自动使用解析出的名称。
 *   - 彻底解决因用户输入名称不规范导致字体不生效的问题。
 * - [优化] 实现了对旧版字体数据的向后兼容。
 * - [优化] 添加了字体解析过程中的加载状态和错误提示，体验更友好。
 */
class SimpleDiaryApp {
    constructor() {
        this.constructor.defaultSettings = {
            theme: 'light',
            fontId: 'sans-serif',
            customFonts: [], // 新结构: { name: '别名', family: '真实font-family', url: '...' }
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

        this.fontMap = {
            'sans-serif': "'Noto Sans SC', sans-serif",
            'serif': "'Noto Serif SC', serif",
            'handwritten': "'ZCOOL KuaiLe', cursive"
        };
        
        this.isBookOpen = false;
        this.isBookAnimating = false;
        this.isPageAnimating = false;
        this.areFontsRendered = false;
        this.isSaving = false;
        
        this.currentBookEntries = [];
        this.currentPageIndex = 0;
        this.currentDeletingEntryId = null;
        this.searchDebounceTimer = null;

        this.init();
    }

    // --- 1. 初始化与数据处理 ---
    init() {
        this.loadData();
        this.loadCustomFonts();
        this.setupEventListeners();
        this.applySettings();
        this.updateProfileDisplay();
        this.renderEntries();
        this.showWelcomeModal();
    }

    loadData() {
        try {
            const savedData = localStorage.getItem('diaryAppData');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.entries = data.entries || [];
                const mergedSettings = this.mergeDeep(
                    JSON.parse(JSON.stringify(this.constructor.defaultSettings)), 
                    data.settings || {}
                );
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
        
        bind('open-entry-form-btn', 'click', () => this.openEntryForm());
        bind('toggle-3d-view-btn', 'click', this.toggle3DView);
        bind('profile-btn', 'click', this.openProfileModal);
        bind('settings-btn', 'click', this.openSettingsModal);
        bind('search-input', 'input', this.handleSearch);
        bind('clear-search-btn', 'click', this.clearSearch);
        bind('close-entry-form-btn', 'click', this.closeEntryForm);
        bind('save-entry-btn', 'click', this.saveEntry);
        bind('toggle-tags-input-btn', 'click', this.toggleTagsInput);
        bind('cancel-delete-btn', 'click', this.closeConfirmationModal);
        bind('confirm-delete-btn', 'click', this.confirmDeleteEntry);
        bind('close-profile-btn', 'click', this.closeProfileModal);
        bind('edit-profile-btn', 'click', this.openEditProfileModal);
        bind('cancel-edit-profile-btn', 'click', this.closeEditProfileModal);
        bind('save-profile-btn', 'click', this.saveProfile);
        bind('profile-avatar-upload-trigger', 'click', () => document.getElementById('profile-avatar-file-input')?.click());
        bind('profile-avatar-file-input', 'change', (e) => this.handleAvatarUpload(e));
        bind('close-settings-btn', 'click', this.closeSettingsModal);
        bind('save-settings-btn', 'click', this.saveSettings);
        bind('export-data-btn', 'click', this.exportData);
        bind('import-data-btn', 'click', () => document.getElementById('import-file-input')?.click());
        bind('import-file-input', 'change', (e) => this.importData(e));
        bind('clear-all-data-btn', 'click', this.openClearDataModal);
        bind('cancel-clear-data-btn', 'click', this.closeClearDataModal);
        bind('confirm-clear-data-btn', 'click', this.confirmClearAllData);
        bind('clear-data-confirm-input', 'input', (e) => this.checkClearDataInput(e.target));
        bind('close-welcome-btn', 'click', this.closeWelcomeModal);
        bind('scroll-to-top-btn', 'click', this.scrollToTop);
        bind('prev-page-btn', 'click', () => this.changePage(-1));
        bind('next-page-btn', 'click', () => this.changePage(1));
        bind('close-book-btn', 'click', this.closeBookView);
        bind('add-custom-font-btn', 'click', this.addCustomFont);

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', e => e.target === modal && this.closeModal(modal.id));
        });
        
        document.getElementById('font-options-container').addEventListener('click', this.handleFontSelection.bind(this));
        document.getElementById('custom-font-list').addEventListener('click', e => {
            const deleteBtn = e.target.closest('.delete-font-btn');
            if (deleteBtn) {
                this.deleteCustomFont(parseInt(deleteBtn.dataset.index, 10));
            }
        });
        document.getElementById('settings-nav-list').addEventListener('click', e => {
            const tab = e.target.closest('li');
            if (tab) this.switchSettingsTab(tab);
        });
        document.querySelector('.theme-grid').addEventListener('click', e => {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) this.selectTheme(themeOption.dataset.theme);
        });
        
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
                        <div class="page-header"><div class="page-date">${this.getFormattedTime(entry.createdAt)}</div></div>
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
    saveSettings() {
        this.settings.theme = document.querySelector('.theme-option.active')?.dataset.theme || 'light';
        const activeFont = document.querySelector('.font-option.active');
        if (activeFont) this.settings.fontId = activeFont.dataset.fontId;
        this.settings.timeFormat = document.querySelector('input[name="timeFormat"]:checked').value;
        this.settings.sortOrder = document.querySelector('input[name="sortOrder"]:checked').value;
        
        this.saveData();
        this.applySettings();
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
        
        let fontFamilyToApply = this.fontMap[fontId];

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
        const fullFontMap = {...this.fontMap};
         this.settings.customFonts.forEach((font, index) => {
            fullFontMap[`custom-${index}`] = `'${font.family}', sans-serif`;
        });
        const fontToApply = fullFontMap[this.settings.fontId] || this.fontMap['sans-serif'];
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
        container.querySelectorAll('.custom-font-option').forEach(el => el.remove());
        customList.innerHTML = '';
        
        const fragmentOptions = document.createDocumentFragment();
        const fragmentList = document.createDocumentFragment();
        this.settings.customFonts.forEach((font, index) => {
            const fontId = `custom-${index}`;
            const fontOption = document.createElement('div');
            fontOption.className = 'font-option custom-font-option';
            fontOption.dataset.fontId = fontId;
            fontOption.innerHTML = `<div class="font-preview" style="font-family: '${font.family}', sans-serif;">Aa 你好</div><span>${font.name}</span><small>自定义</small>`;
            fragmentOptions.appendChild(fontOption);
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${font.name}</span> <button class="delete-font-btn" data-index="${index}">&times;</button>`;
            fragmentList.appendChild(listItem);
        });
        container.appendChild(fragmentOptions);
        customList.appendChild(fragmentList);
        this.areFontsRendered = true;
    }
    
    async addCustomFont() {
        const nameInput = document.getElementById('custom-font-name-input');
        const urlInput = document.getElementById('custom-font-url-input');
        const addBtn = document.getElementById('add-custom-font-btn');
    
        let userGivenName = nameInput.value.trim().replace(/^['"]|['"]$/g, '');
        const url = urlInput.value.trim();
    
        if (!url) {
            this.showToast('字体链接不能为空', 'error');
            return;
        }
        try {
            new URL(url);
        } catch (_) {
            this.showToast('请输入有效的URL链接', 'error');
            return;
        }
    
        addBtn.disabled = true;
        addBtn.textContent = '解析中...';
    
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`网络请求失败: ${response.statusText}`);
            const cssText = await response.text();
            
            const fontFamilyMatch = cssText.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/);
            if (!fontFamilyMatch || !fontFamilyMatch[1]) {
                throw new Error('未能在文件中找到字体名称');
            }
            const fontFamily = fontFamilyMatch[1].trim();
    
            if (!userGivenName) {
                userGivenName = fontFamily;
            }
    
            this.settings.customFonts.push({ name: userGivenName, family: fontFamily, url: url });
            this.saveData();
            this.loadCustomFonts();
            this.renderFontOptions();
            this.showToast(`字体 "${userGivenName}" 已添加`);
            nameInput.value = '';
            urlInput.value = '';
    
        } catch (error) {
            console.error('添加自定义字体失败:', error);
            this.showToast(error.message || '无法添加，请检查链接和网络', 'error');
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = '添加';
        }
    }

    deleteCustomFont(index) {
        const font = this.settings.customFonts[index];
        if (confirm(`确定要删除字体 "${font.name}" 吗？`)) {
            const deletedFontId = `custom-${index}`;
            this.settings.customFonts.splice(index, 1);
            if(this.settings.fontId === deletedFontId){
                this.settings.fontId = 'sans-serif';
            }
            this.saveData();
            this.loadCustomFonts();
            this.renderFontOptions();
            this.applySettings();
            this.showToast(`字体 "${font.name}" 已删除`);
        }
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
        this.openModal('edit-profile-modal');
    }
    closeEditProfileModal() { this.closeModal('edit-profile-modal'); }

    openSettingsModal() { 
        if (!this.areFontsRendered) this.renderFontOptions();
        this.selectTheme(this.settings.theme); 
        const fontOption = document.querySelector(`.font-option[data-font-id="${this.settings.fontId}"]`);
        if (fontOption) this.selectFont(fontOption);
        document.querySelector(`input[name="timeFormat"][value="${this.settings.timeFormat}"]`).checked = true;
        document.querySelector(`input[name="sortOrder"][value="${this.settings.sortOrder}"]`).checked = true;
        this.openModal('settings-modal'); 
    }
    closeSettingsModal() { 
        this.applySettings();
        this.closeModal('settings-modal'); 
    }
    
    closeConfirmationModal() { this.closeModal('confirmation-modal'); }
    openClearDataModal() { this.openModal('clear-data-modal'); }
    closeClearDataModal() { this.closeModal('clear-data-modal'); }
    showWelcomeModal() { if (!localStorage.getItem('diaryAppVisited')) this.openModal('welcome-modal');}
    closeWelcomeModal() { this.closeModal('welcome-modal'); localStorage.setItem('diaryAppVisited', 'true'); }
    
    toggleTagsInput() { document.getElementById('tags-input-container').classList.toggle('hidden'); }
    switchSettingsTab(tabElement) {
        document.querySelectorAll('#settings-nav-list li').forEach(li => li.classList.remove('active'));
        tabElement.classList.add('active');
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(tabElement.dataset.target)?.classList.add('active');
    }

    // --- 9. 辅助函数 ---
    handleSearch() {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            const input = document.getElementById('search-input');
            const query = input.value.trim();
            this.renderEntries(query);
            document.getElementById('clear-search-btn').classList.toggle('hidden', query.length === 0);
        }, 300);
    }
    clearSearch() {
        document.getElementById('search-input').value = '';
        this.handleSearch();
    }
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }
    formatContent(content) { return `<p>${content.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`; }
    getAvatarHtml(avatarSource, name) {
        if (avatarSource && avatarSource.startsWith('data:image')) {
            return `<img src="${avatarSource}" alt="avatar" style="width:100%;height:100%;object-fit:cover;">`;
        }
        const text = (name?.charAt(0) || '?').toUpperCase();
        if (text === '?') {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        }
        return text;
    }
    getFormattedTime(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        switch(this.settings.timeFormat){
            case 'full': return date.toLocaleString();
            case 'short': return `${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
            default:
                const diff = (now - date) / 1000;
                if (diff < 60) return "刚刚";
                if (diff < 3600) return `${Math.floor(diff/60)}分钟前`;
                if (diff < 86400) return `${Math.floor(diff/3600)}小时前`;
                if (diff < 2592000) return `${Math.floor(diff/86400)}天前`;
                return date.toLocaleDateString();
        }
    }
    scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    checkClearDataInput(input) { document.getElementById('confirm-clear-data-btn').disabled = input.value !== 'DELETE'; }
    confirmClearAllData() {
        if (document.getElementById('clear-data-confirm-input').value === 'DELETE') {
            localStorage.removeItem('diaryAppData');
            window.location.reload();
        }
    }
    exportData() {
        const dataStr = JSON.stringify({ entries: this.entries, settings: this.settings }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `diary_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (confirm('导入数据将覆盖现有全部内容，确定吗？')) {
                    this.entries = data.entries || [];
                    this.settings = this.mergeDeep(
                        JSON.parse(JSON.stringify(this.constructor.defaultSettings)),
                        data.settings || {}
                    );
                    this.saveData();
                    window.location.reload();
                }
            } catch(err) { this.showToast("文件格式错误", "error"); }
        };
        reader.readAsText(file);
        event.target.value = null;
    }
    mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                        if (!target[key] || typeof target[key] !== 'object') {
                           Object.assign(target, { [key]: {} });
                        }
                        this.mergeDeep(target[key], source[key]);
                    } else {
                        Object.assign(target, { [key]: source[key] });
                    }
                }
            }
        }
        return this.mergeDeep(target, ...sources);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.diaryApp = new SimpleDiaryApp();
});