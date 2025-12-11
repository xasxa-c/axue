/**
 * SimpleDiaryApp - v5.2 (精细化字体控制版)
 * -------------------------------------------
 * - [重大升级] 实现主界面和3D日记本的字体、字号分离设置与实时预览。
 * - [数据结构] 将`settings.fontId`重构为`settings.fontSettings`对象。
 * - [字体更新] 默认字体更新为"ZSFT-hd"，移除"站酷快乐体"，新增"Source Han Serif SC"作为3D日记本预设。
 * - [兼容性] 实现了从旧版单一字体设置到新版精细化设置的无缝数据迁移。
 * - [修复] 保留了v5.1中对预设字体失效和日记本关闭动画突兀问题的修复。
 */
class SimpleDiaryApp {
    constructor() {
        this.constructor.defaultSettings = {
            theme: 'light',
            // [数据结构] 新的字体设置结构
            fontSettings: {
                main: { id: 'default', size: 16 },
                book: { id: 'source-han-serif', size: 18 }
            },
            customFonts: [],
            profile: { name: '匿名用户', signature: '这个人很神秘，什么也没说。', avatar: '' },
            timeFormat: 'relative',
            sortOrder: 'newest'
        };
        this.entries = [];
        this.settings = JSON.parse(JSON.stringify(this.constructor.defaultSettings));

        // [字体更新] 新的预设字体库
        this.fontMap = {
            'default': "'ZSFT-hd', 'Noto Sans SC', sans-serif",
            'noto-sans': "'Noto Sans SC', sans-serif",
            'source-han-serif': "'Source Han Serif SC', serif"
        };
        
        this.isBookOpen = false; this.isBookAnimating = false; this.isPageAnimating = false; this.areFontsRendered = false; this.isSaving = false;
        this.currentBookEntries = []; this.currentPageIndex = 0; this.currentDeletingEntryId = null; this.searchDebounceTimer = null;
        this.init();
    }

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
                let settingsData = data.settings || {};

                // [兼容性] 从旧版 fontId 迁移到新版 fontSettings
                if (settingsData.fontId && !settingsData.fontSettings) {
                    settingsData.fontSettings = {
                        main: { id: settingsData.fontId, size: 16 },
                        book: { id: 'source-han-serif', size: 18 }
                    };
                    delete settingsData.fontId; // 删除旧字段
                }

                const mergedSettings = this.mergeDeep(JSON.parse(JSON.stringify(this.constructor.defaultSettings)), settingsData);
                mergedSettings.customFonts = (mergedSettings.customFonts || []).map(font => {
                    if (typeof font === 'object' && font !== null && !font.family && font.name) {
                        return { name: font.name, family: font.name, url: font.url };
                    }
                    return font;
                });
                this.settings = mergedSettings;
            }
        } catch (error) { console.error('加载数据失败:', error); this.showToast('加载本地数据失败', 'error'); }
    }

    saveData() { /* ... (no changes) ... */ }

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
        
        // [新增] 字体设置实时预览监听器
        const bindPreview = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler.bind(this));
        bindPreview('main-font-select', 'change', this.previewFontSettings);
        bindPreview('main-font-size', 'input', this.previewFontSettings);
        bindPreview('book-font-select', 'change', this.previewFontSettings);
        bindPreview('book-font-size', 'input', this.previewFontSettings);

        document.querySelectorAll('.modal-overlay').forEach(modal => modal.addEventListener('click', e => e.target === modal && this.closeModal(modal.id)));
        document.getElementById('custom-font-list').addEventListener('click', e => { const btn = e.target.closest('.delete-font-btn'); if (btn) this.deleteCustomFont(parseInt(btn.dataset.index, 10)); });
        document.getElementById('settings-nav-list').addEventListener('click', e => { const tab = e.target.closest('li'); if (tab) this.switchSettingsTab(tab); });
        document.querySelector('.theme-grid').addEventListener('click', e => { const opt = e.target.closest('.theme-option'); if (opt) this.selectTheme(opt.dataset.theme); });
        window.addEventListener('scroll', () => { const btn = document.getElementById('scroll-to-top-btn'); if (window.scrollY > 300) btn.classList.add('show'); else btn.classList.remove('show'); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const activeModal = document.querySelector('.modal-overlay.active'); if (activeModal) this.closeModal(activeModal.id); } });
    }
    
    saveEntry() { /* ... (no changes) ... */ }
    deleteEntry(entryId) { /* ... (no changes) ... */ }
    confirmDeleteEntry() { /* ... (no changes) ... */ }
    renderEntries(query = '') { /* ... (no changes) ... */ }
    createEntryElement(entry, index) { /* ... (no changes) ... */ }

    toggle3DView() { if (!this.isBookAnimating) this.isBookOpen ? this.closeBookView() : this.openBookView(); }
    openBookView() { /* ... (no changes) ... */ }
    closeBookView() { /* ... (no changes) ... */ }
    renderBookPages() { /* ... (no changes) ... */ }
    changePage(direction) { /* ... (no changes) ... */ }
    updatePageIndicator() { /* ... (no changes) ... */ }
    updateProfileDisplay() { /* ... (no changes) ... */ }
    saveProfile() { /* ... (no changes) ... */ }
    handleAvatarUpload(e) { /* ... (no changes) ... */ }
    updateAvatarPreview(imgData) { /* ... (no changes) ... */ }

    saveSettings() {
        this.settings.theme = document.querySelector('.theme-option.active')?.dataset.theme || 'light';
        
        // [修改] 保存新的字体设置结构
        this.settings.fontSettings.main.id = document.getElementById('main-font-select').value;
        this.settings.fontSettings.main.size = parseInt(document.getElementById('main-font-size').value, 10);
        this.settings.fontSettings.book.id = document.getElementById('book-font-select').value;
        this.settings.fontSettings.book.size = parseInt(document.getElementById('book-font-size').value, 10);

        this.settings.timeFormat = document.querySelector('input[name="timeFormat"]:checked').value;
        this.settings.sortOrder = document.querySelector('input[name="sortOrder"]:checked').value;
        
        this.saveData();
        this.applySettings(); // 应用最终保存的设置
        this.renderEntries();
        this.showToast('设置已保存');
        this.closeModal('settings-modal');
    }
    
    selectTheme(theme) { document.querySelectorAll('.theme-option').forEach(el=>el.classList.remove('active')); document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active'); document.documentElement.setAttribute('data-theme', theme); }

    // [核心修改] 应用字体设置到CSS变量
    applySettings(previewSettings = null) {
        const settingsToApply = previewSettings || this.settings;
        
        document.documentElement.setAttribute('data-theme', settingsToApply.theme);
        
        const { main, book } = settingsToApply.fontSettings;
        const mainFamily = this.getFontFamilyById(main.id);
        const bookFamily = this.getFontFamilyById(book.id);

        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--font-main-family', mainFamily);
        rootStyle.setProperty('--font-main-size', `${main.size}px`);
        rootStyle.setProperty('--font-book-family', bookFamily);
        rootStyle.setProperty('--font-book-size', `${book.size}px`);
        
        // 更新UI字号显示（仅在预览时）
        if (previewSettings) {
            document.getElementById('main-font-size-value').textContent = `${main.size}px`;
            document.getElementById('book-font-size-value').textContent = `${book.size}px`;
        }
    }

    // [新增] 字体设置实时预览
    previewFontSettings() {
        const preview = {
            theme: this.settings.theme, // 保持当前主题
            fontSettings: {
                main: {
                    id: document.getElementById('main-font-select').value,
                    size: parseInt(document.getElementById('main-font-size').value, 10)
                },
                book: {
                    id: document.getElementById('book-font-select').value,
                    size: parseInt(document.getElementById('book-font-size').value, 10)
                }
            }
        };
        this.applySettings(preview);
    }
    
    loadCustomFonts() { /* ... (no changes) ... */ }
    
    async addCustomFont() { /* ... (no changes) ... */ }

    deleteCustomFont(index) {
        const font = this.settings.customFonts[index];
        if (confirm(`确定要删除字体 "${font.name}" 吗？`)) {
            const delId = `custom-${index}`;
            this.settings.customFonts.splice(index, 1);
            
            // [修改] 检查并重置受影响的字体设置
            if(this.settings.fontSettings.main.id.startsWith('custom-')) this.settings.fontSettings.main.id = 'default';
            if(this.settings.fontSettings.book.id.startsWith('custom-')) this.settings.fontSettings.book.id = 'default';
            
            this.saveData();
            this.loadCustomFonts();
            
            // 重置并重新填充下拉框
            document.getElementById('main-font-select').innerHTML = '';
            document.getElementById('book-font-select').innerHTML = '';
            this.populateFontSelectors();
            this.updateFontControls(); // Update UI to reflect potential changes
            
            this.applySettings();
            this.showToast(`字体 "${font.name}" 已删除`);
        }
    }

    // [新增] 动态填充字体选择下拉框
    populateFontSelectors() {
        const selects = [
            document.getElementById('main-font-select'),
            document.getElementById('book-font-select')
        ];
        
        // 只在需要时填充，避免重复
        if (selects[0] && selects[0].options.length > 0) return;

        const allFonts = {
            '预设字体': {
                'default': '默认字体 (ZSFT-hd)',
                'noto-sans': '思源黑体 (Noto Sans SC)',
                'source-han-serif': '思源宋体 (Source Han Serif)'
            }
        };

        if (this.settings.customFonts.length > 0) {
            allFonts['自定义字体'] = {};
            this.settings.customFonts.forEach((font, index) => {
                allFonts['自定义字体'][`custom-${index}`] = font.name;
            });
        }
        
        selects.forEach(select => {
            if (!select) return;
            select.innerHTML = '';
            for (const groupName in allFonts) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = groupName;
                for (const fontId in allFonts[groupName]) {
                    const option = document.createElement('option');
                    option.value = fontId;
                    option.textContent = allFonts[groupName][fontId];
                    optgroup.appendChild(option);
                }
                select.appendChild(optgroup);
            }
        });
    }
    
    // [新增] 更新字体控制器UI状态
    updateFontControls() {
        const { main, book } = this.settings.fontSettings;
        
        document.getElementById('main-font-select').value = main.id;
        document.getElementById('main-font-size').value = main.size;
        document.getElementById('main-font-size-value').textContent = `${main.size}px`;
        
        document.getElementById('book-font-select').value = book.id;
        document.getElementById('book-font-size').value = book.size;
        document.getElementById('book-font-size-value').textContent = `${book.size}px`;
    }

    // [重构] 辅助函数，根据ID获取字体family字符串
    getFontFamilyById(fontId) {
        if (this.fontMap[fontId]) {
            return this.fontMap[fontId];
        }
        if (fontId.startsWith('custom-')) {
            const index = parseInt(fontId.split('-')[1], 10);
            const customFont = this.settings.customFonts[index];
            if (customFont) {
                return `'${customFont.family}', sans-serif`;
            }
        }
        return this.fontMap['default']; // Fallback
    }
    
    openModal(id) { document.getElementById(id)?.classList.add('active'); }
    closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
    openEntryForm(entryId = null) { /* ... (no changes) ... */ }
    closeEntryForm() { /* ... (no changes) ... */ }
    openProfileModal() { this.openModal('profile-modal'); }
    closeProfileModal() { this.closeModal('profile-modal'); }
    openEditProfileModal() { /* ... (no changes) ... */ }
    closeEditProfileModal() { this.closeModal('edit-profile-modal'); }
    
    openSettingsModal() { 
        this.populateFontSelectors();
        this.updateFontControls();
        
        this.selectTheme(this.settings.theme); 
        document.querySelector(`input[name="timeFormat"][value="${this.settings.timeFormat}"]`).checked = true;
        document.querySelector(`input[name="sortOrder"][value="${this.settings.sortOrder}"]`).checked = true;
        this.openModal('settings-modal'); 
    }
    
    closeSettingsModal() { 
        this.applySettings(); // 恢复到已保存的设置，取消预览
        this.closeModal('settings-modal'); 
    }

    closeConfirmationModal() { this.closeModal('confirmation-modal'); }
    openClearDataModal() { this.openModal('clear-data-modal'); }
    closeClearDataModal() { this.closeModal('clear-data-modal'); }
    showWelcomeModal() { if (!localStorage.getItem('diaryAppVisited')) this.openModal('welcome-modal');}
    closeWelcomeModal() { this.closeModal('welcome-modal'); localStorage.setItem('diaryAppVisited', 'true'); }
    toggleTagsInput() { document.getElementById('tags-input-container').classList.toggle('hidden'); }
    switchSettingsTab(tab) { /* ... (no changes) ... */ }

    handleSearch() { /* ... (no changes) ... */ }
    clearSearch() { /* ... (no changes) ... */ }
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }
    showToast(message, type = 'success') { /* ... (no changes) ... */ }
    formatContent(content) { return `<p>${content.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`; }
    getAvatarHtml(src, name) { /* ... (no changes) ... */ }
    getFormattedTime(dateString) { /* ... (no changes) ... */ }
    scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    checkClearDataInput(input) { document.getElementById('confirm-clear-data-btn').disabled = input.value !== 'DELETE'; }
    confirmClearAllData() { if (document.getElementById('clear-data-confirm-input').value === 'DELETE') { localStorage.removeItem('diaryAppData'); window.location.reload(); } }
    exportData() { /* ... (no changes) ... */ }
    importData(e) { /* ... (no changes) ... */ }
    mergeDeep(target, ...sources) { /* ... (no changes) ... */ }
}

document.addEventListener('DOMContentLoaded', () => { 
    // I moved all unchanged function bodies to /* ... */ for brevity in my thought process,
    // but the final code must contain the full function bodies. Here I will paste the full, correct code.
    
    // Replacing placeholder comments with actual code...
    class SimpleDiaryAppFull extends SimpleDiaryApp {
        saveData() { try { localStorage.setItem('diaryAppData', JSON.stringify({ entries: this.entries, settings: this.settings })); } catch (error) { console.error('保存数据失败:', error); this.showToast('保存数据失败', 'error'); } }
        saveEntry() { if (this.isSaving) return; const saveBtn = document.getElementById('save-entry-btn'); const content = document.getElementById('diary-textarea').value.trim(); if (!content) { this.showToast('日记内容不能为空哦', 'error'); return; } this.isSaving = true; saveBtn.disabled = true; saveBtn.textContent = '发布中...'; setTimeout(() => { const tags = document.getElementById('entry-tags-input').value.split(',').map(t => t.trim()).filter(Boolean); const entryId = document.getElementById('editing-entry-id').value; const now = new Date().toISOString(); if (entryId) { const entry = this.entries.find(e => e.id === entryId); if (entry) { entry.content = content; entry.tags = tags; entry.updatedAt = now; this.showToast('日记已更新'); } } else { this.entries.unshift({ id: this.generateId(), content, tags, createdAt: now, updatedAt: now }); this.showToast('日记已发布'); } this.saveData(); this.renderEntries(); this.updateProfileDisplay(); this.closeEntryForm(); this.isSaving = false; saveBtn.disabled = false; saveBtn.textContent = '发布'; }, 300); }
        deleteEntry(entryId) { this.currentDeletingEntryId = entryId; this.openModal('confirmation-modal'); }
        confirmDeleteEntry() { if (this.currentDeletingEntryId) { this.entries = this.entries.filter(e => e.id !== this.currentDeletingEntryId); this.saveData(); this.renderEntries(); this.updateProfileDisplay(); this.showToast('日记已删除', 'info'); } this.closeConfirmationModal(); }
        renderEntries(query = '') { const container = document.getElementById('diary-thread'); let filtered = [...this.entries]; if (query) { const q = query.toLowerCase(); filtered = filtered.filter(e => e.content.toLowerCase().includes(q) || (e.tags && e.tags.some(t => t.toLowerCase().includes(q)))); } filtered.sort((a, b) => this.settings.sortOrder === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt)); if (filtered.length === 0) { container.innerHTML = `<div class="empty-message"><h3>${query ? '没有找到相关日记' : '还没有日记'}</h3><p>${query ? '换个关键词试试？' : '点击“写新日记”开始记录吧！'}</p></div>`; return; } const fragment = document.createDocumentFragment(); filtered.forEach((entry, index) => fragment.appendChild(this.createEntryElement(entry, index))); container.innerHTML = ''; container.appendChild(fragment); }
        createEntryElement(entry, index) { const div = document.createElement('div'); div.className = 'diary-entry'; div.style.animationDelay = `${index * 0.05}s`; const tagsHtml = (entry.tags && entry.tags.length > 0) ? `<div class="entry-tags">${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''; div.innerHTML = `<div class="entry-meta"><div class="author-info"><div class="avatar">${this.getAvatarHtml(this.settings.profile.avatar, this.settings.profile.name)}</div><span>${this.settings.profile.name}</span></div><div class="entry-metadata-details"><span class="timestamp" title="${new Date(entry.createdAt).toLocaleString()}">${this.getFormattedTime(entry.createdAt)}</span></div>${tagsHtml}<div class="entry-actions"><button class="icon-btn edit-btn" title="编辑"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="icon-btn delete-btn" title="删除"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></div><div class="entry-content">${this.formatContent(entry.content)}</div>`; div.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); this.openEntryForm(entry.id); }); div.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); this.deleteEntry(entry.id); }); return div; }
        openBookView() { this.isBookAnimating = true; this.isBookOpen = true; document.getElementById('diary-thread').classList.add('hidden'); document.getElementById('diary-book-3d').classList.remove('hidden'); this.renderBookPages(); setTimeout(() => { document.querySelector('.book-cover').classList.add('opened'); setTimeout(() => { document.querySelector('.book-pages').classList.add('visible'); this.isBookAnimating = false; }, 500); }, 100); }
        closeBookView() { this.isBookAnimating = true; this.isBookOpen = false; document.querySelector('.book-cover').classList.remove('opened'); document.querySelector('.book-pages').classList.remove('visible'); setTimeout(() => { document.getElementById('diary-book-3d').classList.add('hidden'); document.getElementById('diary-thread').classList.remove('hidden'); this.isBookAnimating = false; }, 1400); }
        renderBookPages() { const container = document.querySelector('#diary-book-3d .pages-container'); this.currentBookEntries = [...this.entries].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); if(this.currentBookEntries.length === 0){ container.innerHTML = `<div class="book-page"><div class="empty-page"><h3>日记本是空的</h3><p>快去写下第一篇日记吧！</p></div></div>`; this.currentPageIndex=-1; } else{ const frag = document.createDocumentFragment(); this.currentBookEntries.forEach((entry,i)=>{ const page=document.createElement('div'); page.className='book-page'; page.style.zIndex=this.currentBookEntries.length-i; page.innerHTML=`<div class="page-content-wrapper"><div class="page-header"><div class="page-date">${this.getFormattedTime(entry.createdAt)}</div></div><div class="page-content">${this.formatContent(entry.content)}</div><div class="page-number">${i+1} / ${this.currentBookEntries.length}</div></div>`; frag.appendChild(page); }); container.innerHTML=''; container.appendChild(frag); this.currentPageIndex=0; } this.updatePageIndicator(); }
        changePage(direction) { if (this.isPageAnimating) return; const newIndex = this.currentPageIndex + direction; if (newIndex >= 0 && newIndex < this.currentBookEntries.length) { this.isPageAnimating = true; const pages=document.querySelectorAll('.book-page'); if (direction > 0) pages[this.currentPageIndex].classList.add('flipped'); else pages[newIndex].classList.remove('flipped'); this.currentPageIndex = newIndex; this.updatePageIndicator(); setTimeout(() => { this.isPageAnimating = false; }, 800); } }
        updatePageIndicator() { document.getElementById('current-page').textContent = this.currentPageIndex >= 0 ? `第 ${this.currentPageIndex+1} 页` : '封面'; document.getElementById('prev-page-btn').disabled = this.currentPageIndex <= 0; document.getElementById('next-page-btn').disabled = this.currentPageIndex >= this.currentBookEntries.length - 1; }
        updateProfileDisplay() { const p = this.settings.profile; const avatarHtml=this.getAvatarHtml(p.avatar,p.name); document.getElementById('header-avatar-display').innerHTML = avatarHtml; document.getElementById('profile-display-avatar').innerHTML = avatarHtml; document.getElementById('profile-display-name').textContent = p.name || '匿名用户'; document.getElementById('profile-display-signature').textContent = p.signature || '这个人很神秘...'; document.getElementById('total-entries').textContent = this.entries.length; document.getElementById('total-words').textContent = this.entries.reduce((sum, e) => sum + e.content.length, 0); const sorted = [...this.entries].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)); document.getElementById('latest-entry').textContent = sorted.length > 0 ? this.getFormattedTime(sorted[0].updatedAt || sorted[0].createdAt) : '-'; }
        saveProfile() { this.settings.profile.name = document.getElementById('profile-username-input').value.trim(); this.settings.profile.signature = document.getElementById('profile-signature-input').value.trim(); this.saveData(); this.updateProfileDisplay(); this.renderEntries(); this.closeEditProfileModal(); this.showToast('个人资料已保存'); }
        handleAvatarUpload(e) { const file = e.target.files[0]; if(!file||!file.type.startsWith('image/'))return; const reader=new FileReader(); reader.onload=e=>{this.settings.profile.avatar=e.target.result; this.updateAvatarPreview(e.target.result);}; reader.readAsDataURL(file); }
        updateAvatarPreview(imgData = this.settings.profile.avatar) { const area=document.getElementById('profile-avatar-preview-area'); if(area){ area.innerHTML = this.getAvatarHtml(imgData, document.getElementById('profile-username-input').value); }}
        loadCustomFonts() { document.querySelectorAll('link[data-custom-font]').forEach(link=>link.remove()); this.settings.customFonts.forEach(font=>{const link=document.createElement('link');link.rel='stylesheet';link.href=font.url;link.dataset.customFont="true";document.head.appendChild(link);});}
        async addCustomFont() { const nameInput=document.getElementById('custom-font-name-input'); const urlInput=document.getElementById('custom-font-url-input'); const addBtn=document.getElementById('add-custom-font-btn'); let name = nameInput.value.trim().replace(/^['"]|['"]$/g, ''); const url = urlInput.value.trim(); if(!url){this.showToast('字体链接不能为空','error');return;} try{new URL(url);}catch(_){this.showToast('请输入有效的URL链接','error');return;} addBtn.disabled=true; addBtn.textContent='解析中...'; try { const res = await fetch(url); if (!res.ok) throw new Error(`网络请求失败: ${res.statusText}`); const css=await res.text(); const match = css.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/); if (!match||!match[1]) throw new Error('未能在文件中找到字体名称'); const family=match[1].trim(); if(!name) name=family; this.settings.customFonts.push({name, family, url}); this.saveData(); this.loadCustomFonts(); document.getElementById('main-font-select').innerHTML=''; this.populateFontSelectors(); this.showToast(`字体 "${name}" 已添加`); nameInput.value=''; urlInput.value=''; } catch (error) { console.error('添加字体失败:', error); this.showToast(error.message || '无法添加，请检查链接', 'error'); } finally { addBtn.disabled=false; addBtn.textContent='添加'; } }
        openEntryForm(entryId = null) { const isEdit = entryId !== null; document.getElementById('entry-form-title').textContent = isEdit ? '编辑日记' : '记录此刻的想法...'; const entry = isEdit ? this.entries.find(e => e.id === entryId) : null; document.getElementById('diary-textarea').value=entry?entry.content:''; document.getElementById('entry-tags-input').value=entry&&entry.tags?entry.tags.join(', '):''; document.getElementById('editing-entry-id').value=entryId||''; document.getElementById('tags-input-container').classList.toggle('hidden',!isEdit||!entry?.tags?.length); this.openModal('entry-form-modal'); }
        closeEntryForm() { this.closeModal('entry-form-modal'); }
        openEditProfileModal() { document.getElementById('profile-username-input').value = this.settings.profile.name; document.getElementById('profile-signature-input').value = this.settings.profile.signature; this.updateAvatarPreview(); this.openModal('edit-profile-modal'); }
        switchSettingsTab(tab) { document.querySelectorAll('#settings-nav-list li').forEach(li=>li.classList.remove('active')); tab.classList.add('active'); document.querySelectorAll('.settings-panel').forEach(p=>p.classList.remove('active')); document.getElementById(tab.dataset.target)?.classList.add('active'); }
        handleSearch() { clearTimeout(this.searchDebounceTimer); this.searchDebounceTimer = setTimeout(() => { const input = document.getElementById('search-input'); const query=input.value.trim(); this.renderEntries(query); document.getElementById('clear-search-btn').classList.toggle('hidden', query.length === 0); }, 300); }
        clearSearch() { document.getElementById('search-input').value = ''; this.handleSearch(); }
        showToast(message, type = 'success') { const con = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent=message; con.appendChild(toast); setTimeout(()=>toast.classList.add('show'),10); setTimeout(() => { toast.classList.remove('show'); setTimeout(()=>con.removeChild(toast),300); }, 3000); }
        getAvatarHtml(src, name) { if (src && src.startsWith('data:image')) return `<img src="${src}" alt="avatar" style="width:100%;height:100%;object-fit:cover;">`; const text = (name?.charAt(0) || '?').toUpperCase(); if (text === '?') return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'; return text; }
        getFormattedTime(dateString) { const now=new Date(); const date=new Date(dateString); switch(this.settings.timeFormat){ case 'full': return date.toLocaleString(); case 'short': return `${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`; default: const diff=(now-date)/1000; if(diff<60) return "刚刚"; if(diff<3600) return `${Math.floor(diff/60)}分钟前`; if(diff<86400) return `${Math.floor(diff/3600)}小时前`; if(diff<2592000) return `${Math.floor(diff/86400)}天前`; return date.toLocaleDateString(); } }
        exportData() { const dataStr = JSON.stringify({entries:this.entries,settings:this.settings},null,2); const blob=new Blob([dataStr],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download = `diary_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
        importData(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = e => { try { const data = JSON.parse(e.target.result); if (confirm('导入数据将覆盖现有全部内容，确定吗？')) { this.entries = data.entries || []; this.settings = this.mergeDeep(JSON.parse(JSON.stringify(this.constructor.defaultSettings)), data.settings || {}); this.saveData(); window.location.reload(); } } catch(err) { this.showToast("文件格式错误", "error"); } }; reader.readAsText(file); e.target.value = null; }
        mergeDeep(target, ...sources) { if(!sources.length)return target; const source = sources.shift(); if(typeof target==='object'&&target!==null&&typeof source==='object'&&source!==null){for(const key in source){if(Object.prototype.hasOwnProperty.call(source,key)){if(typeof source[key]==='object'&&source[key]!==null&&!Array.isArray(source[key])){if(!target[key]||typeof target[key]!=='object'){Object.assign(target,{[key]:{}});} this.mergeDeep(target[key],source[key]);}else{Object.assign(target,{[key]:source[key]});}}}} return this.mergeDeep(target,...sources);}
    }

    window.diaryApp = new SimpleDiaryAppFull();
});
