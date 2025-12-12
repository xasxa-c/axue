/**
 * SimpleDiaryApp - v5.5 (样式 & 字体预设修正)
 * -------------------------------------------
 * - [样式修正] 恢复并优化了大部分 CSS 样式，使其更接近你提供的美观 HTML 结构。
 * - [功能修正] 严格移除了全局字体选项中的“站酷快乐体”预设。
 * - [功能增强] 3D日记本默认中文字体使用指定CSS，英文字体默认使用 Sacramento 花体。
 * - [逻辑优化] 确保用户添加的自定义字体能正确作为全局字体或日记本字体使用，并与UI交互良好。
 * - [代码优化] `fontMap` 和 `renderFontOptions` 逻辑已同步更新。
 */
class SimpleDiaryApp {
    constructor() {
        this.constructor.defaultSettings = {
            theme: 'light',
            fontId: 'sans-serif', // Default global font
            customFonts: [],
            bookFont: {
                chinese: { name: '日记本默认', family: 'var(--font-sans)', url: 'https://fontsapi.zeoseven.com/96/main/result.css' },
                english: { name: 'Sacramento', family: "'Sacramento', cursive", url: 'https://fonts.googleapis.com/css2?family=Sacramento&display=swap' }
            },
            profile: { name: '匿名用户', signature: '这个人很神秘，什么也没说。', avatar: '' },
            timeFormat: 'relative',
            sortOrder: 'newest'
        };
        this.entries = [];
        this.settings = JSON.parse(JSON.stringify(this.constructor.defaultSettings));
        // **fontMap 已更新，移除了 'handwritten' 预设**
        this.fontMap = {
            'sans-serif': { name: "思源黑体", font: "'Noto Sans SC', sans-serif", description: "现代简洁", previews: { aa: "Aa 你好" } },
            'serif': { name: "思源宋体", font: "'Noto Serif SC', serif", description: "优雅古典", previews: { aa: "Aa 你好" } },
            // 'handwritten': { name: "站酷快乐体", font: "'ZCOOL KuaiLe', cursive", ... } // <-- 已移除
        };
        // State variables
        this.isBookOpen = false; this.isBookAnimating = false; this.isPageAnimating = false; this.areFontsRendered = false; this.isSaving = false; this.isFetching = false;
        this.currentBookEntries = []; this.currentPageIndex = 0; this.currentDeletingEntryId = null; this.searchDebounceTimer = null;
        
        this.init();
    }

    init() {
        this.loadData();
        this.loadCustomFonts(); // Load custom fonts into UI and header links
        this.applySettings();   // Apply global font and theme from settings
        this.applyBookFonts();  // Apply default or saved book fonts
        this.updateProfileDisplay();
        this.renderEntries();
        this.checkInitialState(); // Show welcome modal if first visit
        document.getElementById('loading-overlay').classList.add('hidden');
    }
    
    checkInitialState() { // Checks if it's the first visit
        if (!localStorage.getItem('diaryAppVisited')) {
            this.showModal('welcome-modal');
            localStorage.setItem('diaryAppVisited', 'true');
        }
    }

    loadData() { // Loads entries and settings from localStorage
        try {
            const savedData = localStorage.getItem('diaryAppData');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.entries = data.entries || [];
                // Merge settings, starting with defaults and applying saved ones
                const mergedSettings = this.mergeDeep(JSON.parse(JSON.stringify(this.constructor.defaultSettings)), data.settings || {});
                
                // Ensure customFonts format is consistent { name, family, url }
                mergedSettings.customFonts = (mergedSettings.customFonts || []).map(font => {
                    if (typeof font === 'object' && font !== null && !font.family && font.name) {
                        return { ...font, family: font.name };
                    }
                    return font;
                });
                this.settings = mergedSettings;
            }
        } catch (error) {
            console.error('Loading data failed:', error);
            this.showToast('Failed to load local data', 'error');
        }
    }

    saveData() { // Saves current entries and settings to localStorage
        try {
            localStorage.setItem('diaryAppData', JSON.stringify({
                entries: this.entries,
                settings: this.settings
            }));
        } catch (error) {
            console.error('Saving data failed:', error);
            this.showToast('Failed to save data', 'error');
        }
    }

    // --- Event Listener Setup ---
    setupEventListeners() {
        const bind = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler.bind(this));
        const bindAll = (selector, event, handler) => document.querySelectorAll(selector).forEach(el => el.addEventListener(event, handler.bind(this)));

        // Core Operations
        bind('open-entry-form-btn', 'click', this.openEntryForm);
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
        bind('profile-avatar-file-input', 'change', this.handleAvatarUpload);
        bind('close-settings-btn', 'click', this.closeSettingsModal);
        bind('save-settings-btn', 'click', this.saveSettings);
        bind('export-data-btn', 'click', this.exportData);
        bind('import-data-btn', 'click', () => document.getElementById('import-file-input')?.click());
        bind('import-file-input', 'change', this.importData);
        bind('clear-all-data-btn', 'click', this.openClearDataModal);
        bind('cancel-clear-data-btn', 'click', this.closeClearDataModal);
        bind('confirm-clear-data-btn', 'click', this.confirmClearAllData);
        bind('clear-data-confirm-input', 'input', this.checkClearDataInput);
        bind('close-welcome-btn', 'click', this.closeWelcomeModal);
        bind('scroll-to-top-btn', 'click', this.scrollToTop);

        // 3D Diary Book Controls
        bind('toggle-3d-view-btn', 'click', this.toggle3DView);
        bind('prev-page-btn', 'click', () => this.changePage(-1));
        bind('next-page-btn', 'click', () => this.changePage(1));
        bind('close-book-btn', 'click', this.closeBookView);

        // Settings Panel Navigation & Actions
        bindAll('#settings-nav-list li', 'click', this.switchSettingsTab);
        bindAll('.theme-option', 'click', this.selectTheme);
        bindAll('.font-option', 'click', this.handleFontSelection);
        bind('add-custom-font-btn', 'click', this.addCustomFont);
        bind('add-book-font-btn', 'click', this.updateBookFont); // Function to set book's default fonts

        // Modal Handling & Escape Key
        bindAll('.modal-close-btn', 'click', (e) => this.closeModal(e.target.closest('.modal-overlay')?.id));
        bindAll('.modal-overlay', 'click', (e) => { if (e.target === e.currentTarget) this.closeModal(e.target.id); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const activeModal = document.querySelector('.modal-overlay.active'); if (activeModal) this.closeModal(activeModal.id); } });

        // Search & Custom Font List Actions
        bind('search-input', 'input', this.handleSearch);
        bind('clear-search-btn', 'click', this.clearSearch);
        document.getElementById('custom-font-list')?.addEventListener('click', e => {
            if (e.target.classList.contains('delete-font-btn')) {
                this.deleteCustomFont(parseInt(e.target.dataset.index, 10));
            }
        });
        
        // Scroll to Top Button Visibility
        window.addEventListener('scroll', this.handleScroll);
    }

    // --- Diary Core Operations ---
    saveEntry() { // Saves new or updated entry
        if (this.isSaving) return;
        const content = document.getElementById('diary-textarea').value.trim();
        if (!content) { this.showToast('Cannot save an empty diary entry', 'error'); return; }

        this.isSaving = true;
        const saveBtn = document.getElementById('save-entry-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        setTimeout(() => {
            const tags = document.getElementById('entry-tags-input').value.split(',').map(t => t.trim()).filter(Boolean);
            const entryId = document.getElementById('editing-entry-id').value;
            const now = new Date().toISOString();
            if (entryId) { // Update existing
                const entry = this.entries.find(e => e.id === entryId);
                if (entry) {
                    entry.content = content;
                    entry.tags = tags;
                    entry.updatedAt = now;
                    this.showToast('Diary updated');
                }
            } else { // Add new
                this.entries.unshift({ id: this.generateId(), content, tags, createdAt: now, updatedAt: now });
                this.showToast('Diary published');
            }
            this.saveData();
            this.renderEntries();
            this.updateProfileDisplay();
            this.closeEntryForm();
            this.isSaving = false;
            saveBtn.disabled = false;
            saveBtn.textContent = 'Publish';
        }, 300);
    }

    deleteEntry(entryId) { // Initiates deletion confirmation
        this.currentDeletingEntryId = entryId;
        this.showModal('confirmation-modal');
    }

    confirmDeleteEntry() { // Executes deletion after confirmation
        if (this.currentDeletingEntryId) {
            this.entries = this.entries.filter(e => e.id !== this.currentDeletingEntryId);
            this.saveData();
            this.renderEntries();
            this.updateProfileDisplay();
            this.showToast('Diary deleted', 'info');
        }
        this.closeConfirmationModal();
    }

    // --- Rendering ---
    renderEntries(query = '') { // Renders diary entries, optionally filtered
        const container = document.getElementById('diary-thread');
        let filteredEntries = [...this.entries];

        if (query) { // Apply search query
            const lowerQuery = query.toLowerCase();
            filteredEntries = filteredEntries.filter(e =>
                e.content.toLowerCase().includes(lowerQuery) ||
                (e.tags && e.tags.some(t => t.toLowerCase().includes(lowerQuery)))
            );
        }

        // Sort entries according to settings
        filteredEntries.sort((a, b) => this.settings.sortOrder === 'oldest'
            ? new Date(a.createdAt) - new Date(b.createdAt)
            : new Date(b.createdAt) - new Date(a.createdAt)
        );

        if (filteredEntries.length === 0) { // Display message if no entries match query or list is empty
            container.innerHTML = `<div class="empty-message"><h3>${query ? 'No search results' : 'No diary entries yet'}</h3><p>${query ? 'Try different keywords?' : 'Click "Write New Diary" to start recording!'}</p></div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        filteredEntries.forEach((entry, index) => fragment.appendChild(this.createEntryElement(entry, index)));
        container.innerHTML = ''; // Clear previous content
        container.appendChild(fragment);
    }

    createEntryElement(entry, index) { // Creates DOM element for a single entry
        const div = document.createElement('div');
        div.className = 'diary-entry';
        div.style.animationDelay = `${index * 0.05}s`; // Stagger entry animations
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
                    <button class="icon-btn edit-btn" title="Edit"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button class="icon-btn delete-btn" title="Delete"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                </div>
            </div>
            <div class="entry-content">${this.formatContent(entry.content)}</div>`;
        // Add click listeners for edit/delete buttons
        div.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); this.openEntryForm(entry.id); });
        div.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); this.deleteEntry(entry.id); });
        return div;
    }

    // --- 3D Diary Book Logic ---
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
        
        setTimeout(() => { // Start cover animation
            document.querySelector('.book-cover').classList.add('opened');
            setTimeout(() => { // Show pages after cover animation
                document.querySelector('.book-pages').classList.add('visible');
                this.isBookAnimating = false;
            }, 500); // Match cover open animation duration
        }, 100);
    }

    closeBookView() {
        this.isBookAnimating = true;
        this.isBookOpen = false;
        document.querySelector('.book-cover').classList.remove('opened'); // Start cover closing animation
        document.querySelector('.book-pages').classList.remove('visible');
        
        setTimeout(() => { // Return to list view after cover closes
            document.getElementById('diary-book-3d').classList.add('hidden');
            document.getElementById('diary-thread').classList.remove('hidden');
            this.isBookAnimating = false;
        }, 800); // Match cover close animation duration
    }

    renderBookPages() { // Renders entries as pages in the 3D book
        const container = document.querySelector('#diary-book-3d .pages-container');
        this.currentBookEntries = [...this.entries].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort for book view
        
        if (this.currentBookEntries.length === 0) { // Handle empty book scenario
            container.innerHTML = `<div class="book-page"><div class="empty-page"><h3>The diary book is empty</h3><p>Write your first entry to start!</p></div></div>`;
            this.currentPageIndex = -1; // Indicate at cover
        } else {
            const fragment = document.createDocumentFragment();
            this.currentBookEntries.forEach((entry, i) => {
                const page = document.createElement('div');
                page.className = 'book-page';
                page.style.zIndex = this.currentBookEntries.length - i; // Stack order
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
            this.currentPageIndex = 0; // Reset to first page
        }
        this.updatePageIndicator(); // Update page navigation controls
    }
    
    changePage(direction) { // Handles page turning logic
        if (this.isPageAnimating) return;
        const newIndex = this.currentPageIndex + direction;
    
        if (newIndex >= 0 && newIndex < this.currentBookEntries.length) { // If valid page index
            this.isPageAnimating = true;
            const pages = document.querySelectorAll('.book-page');
            
            if (direction > 0) { // Turning forward
                pages[this.currentPageIndex].classList.add('flipped');
            } else { // Turning backward
                pages[newIndex].classList.remove('flipped');
            }
    
            this.currentPageIndex = newIndex;
            this.updatePageIndicator();
            setTimeout(() => { this.isPageAnimating = false; }, 800); // Match animation timeframe
        } else if (newIndex < 0 && this.currentPageIndex === 0) { // Trying to turn back from first page -> close book
            this.closeBookView();
        }
    }
    
    updatePageIndicator() { // Updates page number display and button states
        const pageIndicatorSpan = document.getElementById('current-page');
        if (!pageIndicatorSpan) return; // Safety check
        pageIndicatorSpan.textContent = this.currentPageIndex >= 0 ? `第 ${this.currentPageIndex + 1} 页` : '封面';
        document.getElementById('prev-page-btn').disabled = this.currentPageIndex <= 0;
        document.getElementById('next-page-btn').disabled = this.currentPageIndex >= this.currentBookEntries.length - 1;
    }
    
    // --- User Profile Logic ---
    updateProfileDisplay() { // Updates avatar, name, signature, and stats display
        const profile = this.settings.profile;
        const avatarHtml = this.getAvatarHtml(profile.avatar, profile.name);
        document.getElementById('header-avatar-display').innerHTML = avatarHtml;
        document.getElementById('profile-display-avatar').innerHTML = avatarHtml;
        document.getElementById('profile-display-name').textContent = profile.name || 'Anonymous User';
        document.getElementById('profile-display-signature').textContent = profile.signature || 'This person is mysterious...';
        document.getElementById('total-entries').textContent = this.entries.length;
        document.getElementById('total-words').textContent = this.entries.reduce((sum, e) => sum + e.content.length, 0);
        const sortedEntries = [...this.entries].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        document.getElementById('latest-entry').textContent = sortedEntries.length > 0 ? this.getFormattedTime(sortedEntries[0].updatedAt || sortedEntries[0].createdAt) : '-';
    }

    saveProfile() { // Saves edited profile details
        this.settings.profile.name = document.getElementById('profile-username-input').value.trim();
        this.settings.profile.signature = document.getElementById('profile-signature-input').value.trim();
        this.saveData();
        this.updateProfileDisplay();
        this.renderEntries(); // Re-render to potentially update author name in list
        this.closeEditProfileModal();
        this.showToast('Profile updated');
    }

    handleAvatarUpload(event) { // Handles avatar image file input
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            this.settings.profile.avatar = e.target.result; // Store avatar data URL
            this.updateAvatarPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    updateAvatarPreview(imageData = this.settings.profile.avatar) { // Updates the avatar preview area
        const previewArea = document.getElementById('profile-avatar-preview-area');
        if (previewArea) {
            previewArea.innerHTML = this.getAvatarHtml(imageData, document.getElementById('profile-username-input')?.value);
        }
    }

    // --- Settings Panel Logic ---
    saveSettings() { // Saves current settings from UI controls
        this.settings.theme = document.querySelector('.theme-option.active')?.dataset.theme || 'light';
        const activeFont = document.querySelector('.font-option.active');
        if (activeFont) this.settings.fontId = activeFont.dataset.fontId;
        this.settings.timeFormat = document.querySelector('input[name="timeFormat"]:checked')?.value || 'relative';
        this.settings.sortOrder = document.querySelector('input[name="sortOrder"]:checked')?.value || 'newest';
        
        this.saveData();
        this.applySettings(); // Apply changes visually
        this.renderEntries(); // Re-render entries if sorting/formatting changed
        this.showToast('Settings saved');
        this.closeModal('settings-modal'); 
    }
    
    selectTheme(theme) { // Handles theme selection click
        document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
        document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active');
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    handleFontSelection(event) { // Handles global font selection click
        const fontOption = event.target.closest('.font-option');
        if (fontOption) this.selectFont(fontOption);
    }

    selectFont(fontEl) { // Manually sets active state and applies font to body
        document.querySelectorAll('.font-option').forEach(el => el.classList.remove('active'));
        fontEl.classList.add('active');
        const fontId = fontEl.dataset.fontId;
        
        let fontFamilyToApply = this.fontMap[fontId]; // Use preset if available
        // If it's a custom font, construct the family string
        if (fontId.startsWith('custom-')) {
            const index = parseInt(fontId.split('-')[1], 10);
            const customFont = this.settings.customFonts[index];
            if (customFont) {
                fontFamilyToApply = `'${customFont.family}', sans-serif`; // Use parsed family
            }
        }
        document.body.style.fontFamily = fontFamilyToApply; // Apply font to body
    }
    
    applySettings() { // Applies theme and global font settings from 'this.settings'
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        
        // Construct a temporary map including custom fonts for lookup
        const tempFontMap = { ...this.fontMap };
         this.settings.customFonts.forEach((font, index) => {
            tempFontMap[`custom-${index}`] = `'${font.family}', sans-serif`;
        });
        // Get the font family string for the currently selected fontId
        const fontToApply = tempFontMap[this.settings.fontId] || this.fontMap['sans-serif']; // Fallback to sans-serif
        if (document.body.style.fontFamily !== fontToApply) { // Apply only if different
            document.body.style.fontFamily = fontToApply;
        }
    }

    // --- Font Management ---
    loadCustomFonts() { // Loads custom fonts into the UI list and <head>
        document.querySelectorAll('link[data-custom-font]').forEach(link => link.remove()); // Remove previous custom font links
        
        const customList = document.getElementById('custom-font-list');
        if (!customList) return; // Exit if element not found
        customList.innerHTML = ''; // Clear current list
        
        const fragmentOptions = document.createDocumentFragment();
        const fragmentList = document.createDocumentFragment();

        this.settings.customFonts.forEach((font, index) => {
            // Add Font Option to Settings Panel
            const fontId = `custom-${index}`;
            const fontOption = document.createElement('div');
            fontOption.className = 'font-option custom-font-option';
            fontOption.dataset.fontId = fontId;
            // Applying font directly for preview, fallback sans-serif if parsed family is missing
            const previewFontFamily = font.family ? `'${font.family}', sans-serif` : "var(--font-sans)";
            fontOption.innerHTML = `<div class="font-preview" style="font-family: ${previewFontFamily};">Aa 你好</div><span>${font.name}</span><small>自定义</small>`;
            fragmentOptions.appendChild(fontOption);
            
            // Add Font to Custom Font List in Settings
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${font.name}</span> <button class="delete-font-btn" data-index="${index}">&times;</button>`;
            fragmentList.appendChild(listItem);
            
            // Load font CSS if not already loaded
            if (font.url && !this.isFontAlreadyLoaded(font.url)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = font.url;
                link.dataset.customFont = "true"; // Mark as custom font
                document.head.appendChild(link);
            }
        });
        document.getElementById('font-options-container').appendChild(fragmentOptions); // Append to global options
        customList.appendChild(fragmentList); // Append to custom list
        this.areFontsRendered = false; // Mark that options need re-render
    }

    isFontAlreadyLoaded(url) { // Checks if a font CSS link already exists
        return Array.from(document.head.querySelectorAll('link[rel="stylesheet"][data-custom-font="true"]'))
            .some(link => link.href === url);
    }

    async parseFontInfo(url, userGivenName) { // Parses font {name, family, url} from CSS
        if (!url) throw new Error('URL cannot be empty');
        try { new URL(url); } catch (_) { if (!url.startsWith('data:')) throw new Error('Invalid URL'); }
    
        let cssText = '';
        if (url.startsWith('data:')) { // Handle Data URLs
             const parts = url.split(',');
             if (parts.length < 2) throw new Error('Invalid Data URL format');
             cssText = decodeURIComponent(parts[1]);
        } else { // Handle HTTP/HTTPS URLs
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Network request failed: ${res.statusText}`);
            cssText = await res.text();
        }
        
        const match = cssText.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/);
        if (!match || !match[1]) {
            throw new Error('Could not find font-family in CSS');
        }
        const family = match[1].trim();
        // Decide on the font name: prefer user's input, fallback to parsed family
        const simpleName = userGivenName || family.split(',')[0].replace(/['"]/g, '').trim();
        return { name: simpleName, family: family, url: url };
    }

    async addCustomFont() { // Adds new custom font from user input
        const nameInput = document.getElementById('custom-font-name-input');
        const urlInput = document.getElementById('custom-font-url-input');
        const addBtn = document.getElementById('add-custom-font-btn');
    
        let userGivenName = nameInput.value.trim().replace(/^['"]|['"]$/g, '');
        const url = urlInput.value.trim();
        if (!url) { this.showToast('Font URL cannot be empty', 'error'); return; }
        try { new URL(url); } catch (_) { if (!url.startsWith('data:')) { this.showToast('Please enter a valid URL', 'error'); return; } }
    
        addBtn.disabled = true; addBtn.textContent = 'Parsing...';
        try {
            const fontInfo = await this.parseFontInfo(url, userGivenName);
            this.settings.customFonts.push(fontInfo);
            this.saveData();
            this.loadCustomFonts(); // Update UI list and load font
            this.renderFontOptions(); // Re-render global font options
            this.showToast(`Font "${fontInfo.name}" added`);
            nameInput.value = ''; urlInput.value = ''; // Clear inputs
        } catch (error) {
            this.showToast(`Failed to add font: ${error.message}`, 'error');
        } finally {
            addBtn.disabled = false; addBtn.textContent = 'Add';
        }
    }

    deleteCustomFont(index) { // Deletes a custom font from settings
        const font = this.settings.customFonts[index];
        if (confirm(`Are you sure you want to delete the custom font "${font.name}"?`)) {
            const deletedFontId = `custom-${index}`;
            this.settings.customFonts.splice(index, 1);
            // If the deleted font was the currently selected global font, reset
            if (this.settings.fontId === deletedFontId) {
                this.settings.fontId = 'sans-serif'; // Reset to default
            } else if (this.settings.fontId.startsWith('custom-')) {
                const currentCustomIndex = parseInt(this.settings.fontId.split('-')[1], 10);
                if (currentCustomIndex > index) { // Adjust index if font was after the deleted one
                    this.settings.fontId = `custom-${currentCustomIndex - 1}`;
                }
            }
            this.saveData();
            this.loadCustomFonts(); // Update UI list
            this.renderFontOptions(); // Re-render global options
            this.applySettings(); // Re-apply global font settings
            this.showToast(`Font "${font.name}" deleted`, 'info');
        }
    }
    
    // Checks if book font URL has changed
    isBookFontUrlChanged(newUrl, type) { 
        const currentUrl = this.settings.bookFont[type === 'zh' ? 'chinese' : 'english'].url;
        return newUrl && newUrl !== currentUrl;
    }

    async updateBookFont() { // Sets the default Chinese and English fonts for the 3D book
        if (this.isFetching) return;
        this.isFetching = true;
        const zhNameInput = document.getElementById('book-font-zh-name-input');
        const zhUrlInput = document.getElementById('book-font-zh-url-input');
        const enNameInput = document.getElementById('book-font-en-name-input');
        const enUrlInput = document.getElementById('book-font-en-url-input');
        const addBtn = document.getElementById('add-book-font-btn');

        const zhName = zhNameInput.value.trim();
        const zhUrl = zhUrlInput.value.trim();
        const enName = enNameInput.value.trim();
        const enUrl = enUrlInput.value.trim();

        addBtn.disabled = true; addBtn.textContent = 'Applying...';
        
        // Helper to update either Chinese or English font setting
        const updateFontSetting = async (type, name, url) => {
            let currentFont = this.settings.bookFont[type];
            const urlChanged = this.isBookFontUrlChanged(url, type);
            
            if (!url) { // If URL is cleared, reset the font
                currentFont = { name: '', family: '', url: '' };
            } else if (urlChanged) { // If URL changed, parse new font info
                const fontInfo = await this.parseFontInfo(url, name);
                currentFont = fontInfo;
            } else if (name) { // If URL same but name changed
                currentFont.name = name || currentFont.family;
            }
            this.settings.bookFont[type] = currentFont; // Update settings obj
        };

        try {
            // Update both fonts concurrently
            await Promise.all([
                updateFontSetting('chinese', zhName, zhUrl),
                updateFontSetting('english', enName, enUrl)
            ]);
            this.saveData();
            this.applyBookFonts(); // Apply changes to CSS variables and load fonts
            this.showToast('Book fonts updated');
        } catch (error) {
            this.showToast(`Failed to set book fonts: ${error.message}`, 'error');
        } finally {
            this.isFetching = false;
            addBtn.disabled = false; addBtn.textContent = 'Set Book Fonts';
        }
    }

    applyBookFonts() { // Applies configured book fonts to CSS variables & loads font CSS
        const applyType = (type, fontSetting) => {
            const cssVarName = type === 'chinese' ? '--book-font-zh' : '--book-font-en';
            if (fontSetting && fontSetting.family) { // If font details exist
                document.documentElement.style.setProperty(cssVarName, `'${fontSetting.family}', sans-serif`);
                 // Load font CSS if URL exists and isn't already loaded
                if (fontSetting.url && !this.isFontAlreadyLoadedForBook(fontSetting.url)) {
                    const style = document.createElement('style');
                    style.dataset.bookFont = type; // Mark the style element
                    if (fontSetting.url.startsWith('data:') && fontSetting.url.includes(',')) { // Data URL
                        const decodedCss = decodeURIComponent(fontSetting.url.substring(fontSetting.url.indexOf(',') + 1));
                        style.textContent = decodedCss;
                    } else { // Regular URL
                        style.textContent = `@import url('${fontSetting.url}');`;
                    }
                    document.head.appendChild(style);
                }
            } else {
                document.documentElement.style.removeProperty(cssVarName); // Reset if no font set
            }
        };
        
        applyType('chinese', this.settings.bookFont?.chinese);
        applyType('english', this.settings.bookFont?.english);

        // If book is open, force a visual refresh
        if (this.isBookOpen) {
            document.querySelectorAll('.book-page .page-content').forEach(el => el.style.fontFamily = ''); // Clear inline style
            document.querySelector('.book-pages').clientHeight; // Force repaint
        }
    }
    
    isFontAlreadyLoadedForBook(url) { // Helper to check if book font CSS is loaded
         return Array.from(document.head.querySelectorAll('style[data-book-font]'))
            .some(style => { const content = style.textContent || ''; return content.includes(url); });
    }

    renderFontOptions() { // Renders global font options in settings panel
        const container = document.getElementById('font-options-container');
        if (!container) return;
        container.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        const addFontOption = (id, config) => { // Helper to create a font option element
            const option = document.createElement('div');
            option.className = `font-option ${id === 'serif' ? 'font-serif' : (id === 'handwritten' ? 'font-handwritten' : 'font-sans')}`;
            option.dataset.fontId = id; 
            option.dataset.font = config.font; // Store actual font-family string
            option.innerHTML = `<div class="font-preview">${config.previews?.aa || 'Aa 你好'}</div><span>${config.name}</span><small>${config.description || ''}</small>`;
            if (id === this.settings.fontId) option.classList.add('active'); // Highlight active font
            fragment.appendChild(option);
        };

        // Add preset global fonts (NOT including handwritten)
        addFontOption('sans-serif', this.fontMap['sans-serif']);
        addFontOption('serif', this.fontMap['serif']);
        
        // Add custom fonts from settings
        this.settings.customFonts.forEach((font, index) => {
            const customId = `custom-${index}`;
            const option = document.createElement('div');
            option.className = 'font-option custom-font-option';
            option.dataset.fontId = customId;
            const previewFontFamily = font.family ? `'${font.family}', sans-serif` : "var(--font-sans)"; // Use parsed family for preview style
            option.innerHTML = `<div class="font-preview" style="font-family: ${previewFontFamily};">Aa 你好</div><span>${font.name}<small>自定义</small></span>`;
            if (customId === this.settings.fontId) option.classList.add('active'); // Mark if this custom font is selected
            fragment.appendChild(option);
        });

        container.appendChild(fragment);
        this.areFontsRendered = true;
    }

    // --- Modal Control ---
    showModal(id) { document.getElementById(id)?.classList.add('active'); }
    closeModal(id) { 
        if (!id) return;
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active'); 
        // Cleanup actions upon closing specific modals
        if (id === 'settings-modal') this.closeSettingsModal(); 
        if (id === 'confirmation-modal') this.currentDeletingEntryId = null;
        if (id === 'clear-data-modal') { // Reset clear data modal state
            document.getElementById('clear-data-confirm-input').value = '';
            document.getElementById('confirm-clear-data-btn').disabled = true;
        }
    }

    openEntryForm(entryId = null) { // Opens form for writing/editing an entry
        const isEdit = entryId !== null;
        const modalTitle = document.getElementById('entry-form-title');
        const tagsInputContainer = document.getElementById('tags-input-container');
        const tagsInput = document.getElementById('entry-tags-input');
        const editingEntryIdInput = document.getElementById('editing-entry-id');

        modalTitle.textContent = isEdit ? 'Edit Diary Entry' : 'Record your thoughts...';
        const entry = isEdit ? this.entries.find(e => e.id === entryId) : null;
        
        document.getElementById('diary-textarea').value = entry ? entry.content : '';
        tagsInput.value = entry && entry.tags ? entry.tags.join(', ') : '';
        editingEntryIdInput.value = entryId || '';
        
        // Show tags input only if editing an entry that has tags
        tagsInputContainer.classList.toggle('hidden', !isEdit || !entry?.tags?.length); 
        this.showModal('entry-form-modal');
    }
    closeEntryForm() { this.closeModal('entry-form-modal'); document.getElementById('editing-entry-id').value = ''; } // Clear hidden ID on close

    openProfileModal() { this.showModal('profile-modal'); }
    closeProfileModal() { this.closeModal('profile-modal'); }
    
    openEditProfileModal() { // Opens profile editing modal
        document.getElementById('profile-username-input').value = this.settings.profile.name;
        document.getElementById('profile-signature-input').value = this.settings.profile.signature;
        this.updateAvatarPreview(); // Initialize preview
        this.showModal('edit-profile-modal');
    }
    closeEditProfileModal() { this.closeModal('edit-profile-modal'); }

    openSettingsModal() { // Opens settings modal and populates UI with current settings
        if (!this.areFontsRendered) this.renderFontOptions(); // Render global fonts if not done yet
        
        // Apply current settings to UI elements
        this.selectTheme(this.settings.theme);
        const fontOption = document.querySelector(`.font-option[data-font-id="${this.settings.fontId}"]`);
        if (fontOption) this.selectFont(fontOption); // Highlight active global font
        document.querySelector(`input[name="timeFormat"][value="${this.settings.timeFormat}"]`).checked = true;
        document.querySelector(`input[name="sortOrder"][value="${this.settings.sortOrder}"]`).checked = true;

        // Populate book font settings fields
        document.getElementById('book-font-zh-name-input').value = this.settings.bookFont.chinese.name;
        document.getElementById('book-font-zh-url-input').value = this.settings.bookFont.chinese.url;
        document.getElementById('book-font-en-name-input').value = this.settings.bookFont.english.name;
        document.getElementById('book-font-en-url-input').value = this.settings.bookFont.english.url;

        this.showModal('settings-modal'); 
    }
    closeSettingsModal() { 
        this.applySettings(); // Re-apply settings visually before closing
        this.applyBookFonts(); 
        this.closeModal('settings-modal'); 
    }
    
    closeConfirmationModal() { this.closeModal('confirmation-modal'); }
    openClearDataModal() { this.showModal('clear-data-modal'); document.getElementById('clear-data-confirm-input').value = ''; document.getElementById('confirm-clear-data-btn').disabled = true; } // Reset input on open
    closeClearDataModal() { this.closeModal('clear-data-modal'); }
    
    // --- Utility Functions ---
    handleSearch() { // Debounced search handler
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            const query = document.getElementById('search-input').value.trim();
            this.renderEntries(query);
            document.getElementById('clear-search-btn').classList.toggle('hidden', query.length === 0);
        }, 300);
    }
    clearSearch() { // Clears search input and triggers re-render
        document.getElementById('search-input').value = '';
        this.handleSearch();
    }
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 9); } // Generates a unique ID
    showToast(message, type = 'success') { // Displays temporary toast messages
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10); // Fade in
        setTimeout(() => { // Fade out and remove
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }
    formatContent(content) { // Basic content formatting (newlines to <p>, <br>)
        if (!content) return '';
        return `<p>${content.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }
    getAvatarHtml(avatarSource, name) { // Returns avatar HTML (img or initials)
        if (avatarSource && avatarSource.startsWith('data:image')) {
            return `<img src="${avatarSource}" alt="avatar">`;
        }
        const text = (name ?.charAt(0) || '?').toUpperCase();
        if (text === '?') { // Default icon if name unavailable
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        }
        return text; // Initials
    }
    getFormattedTime(dateString, format = 'relative') { // Formats date/time based on timeFormat setting
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = (now - date) / 1000;

        switch(this.settings.timeFormat){
            case 'full': return date.toLocaleString();
            case 'short': {
                const month = (date.getMonth() + 1).toString().padStart(2,'0');
                const day = date.getDate().toString().padStart(2,'0');
                const hours = date.getHours().toString().padStart(2,'0');
                const mins = date.getMinutes().toString().padStart(2,'0');
                return `${month}-${day} ${hours}:${mins}`;
            }
            default: // relative time
                if (diffInSeconds < 60) return "Just now";
                if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
                if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
                if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
                return date.toLocaleDateString(); // Fallback for older dates
        }
    }
    handleScroll() { // Controls visibility of scroll-to-top button
        const btn = document.getElementById('scroll-to-top-btn');
        if (window.scrollY > 300) btn.classList.add('show');
        else btn.classList.remove('show');
    }
    scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); } // Smooth scroll to top
    checkClearDataInput(input) { // Enables confirm button if input is 'DELETE'
        document.getElementById('confirm-clear-data-btn').disabled = input.value !== 'DELETE';
    }
    confirmClearAllData() { // Clears all data and reloads
        if (document.getElementById('clear-data-confirm-input').value === 'DELETE') {
            localStorage.removeItem('diaryAppData');
            window.location.reload(); 
        }
    }
    exportData() { // Exports data as JSON file
        const dataStr = JSON.stringify({ entries: this.entries, settings: this.settings }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diary_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href); // Clean up URL object
    }
    importData(event) { // Imports data from JSON file
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (confirm('Importing data will overwrite existing content. Continue?')) {
                    this.entries = data.entries || [];
                    // Merge settings carefully to ensure compatibility
                    this.settings = this.mergeDeep(
                        JSON.parse(JSON.stringify(this.constructor.defaultSettings)), 
                        data.settings || {}
                    );
                    this.saveData();
                    window.location.reload(); // Refresh to apply imported data
                }
            } catch(err) {
                this.showToast('Invalid file format or parsing error', 'error');
                console.error("Import error:", err);
            }
        };
        reader.readAsText(file);
        event.target.value = null; // Reset file input for re-uploading
    }
    mergeDeep(target, ...sources) { // Utility for deep object merging
        if (!sources.length) return target;
        const source = sources.shift();
        if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                        if (!target[key] || typeof target[key] !== 'object') {
                           Object.assign(target, { [key]: {} }); // Ensure nested object exists
                        }
                        this.mergeDeep(target[key], source[key]); // Recurse
                    } else {
                        Object.assign(target, { [key]: source[key] }); // Copy value
                    }
                }
            }
        }
        return this.mergeDeep(target, ...sources); // Process remaining sources
    }
    
    // --- Modal Control ---
    openModal(id) { document.getElementById(id)?.classList.add('active'); }
    closeModal(id) { 
        if (!id) return;
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active'); 
        // Cleanup actions on closing modal
        if (id === 'settings-modal') this.closeSettingsModal(); 
        if (id === 'confirmation-modal') this.currentDeletingEntryId = null;
        if (id === 'clear-data-modal') { // Reset clear data modal state
            document.getElementById('clear-data-confirm-input').value = '';
            document.getElementById('confirm-clear-data-btn').disabled = true;
        }
    }
    switchSettingsTab(tabElement) { // Switches active tab in settings panels
        document.querySelectorAll('#settings-nav-list li').forEach(li => li.classList.remove('active'));
        tabElement.classList.add('active');
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(tabElement.dataset.target)?.classList.add('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.diaryApp = new SimpleDiaryApp();
});
