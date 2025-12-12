/**
 * SimpleDiaryApp - v5.4 (精细调整)
 * -------------------------------------------
 * - [功能调整] 移除全局字体预设中的“站酷快乐体”。
 * - [功能调整] 3D日记本默认中文字体使用指定CSS，英文字体默认使用 Sacramento 花体。
 * - [逻辑优化] 用户添加的自定义字体现在可以被选为全局字体，也可被指定为日记本字体。
 * - [兼容性] 优化了字体加载和设置逻辑，确保多处字体应用的一致性。
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
        this.fontMap = {
            'sans-serif': { name: "思源黑体", font: "'Noto Sans SC', sans-serif", description: "现代简洁", previews: { aa: "Aa 你好" } },
            'serif': { name: "思源宋体", font: "'Noto Serif SC', serif", description: "优雅古典", previews: { aa: "Aa 你好" } },
            // 'handwritten': { name: "站酷快乐体", font: "'ZCOOL KuaiLe', cursive", description: "活泼手写", previews: { aa: "Aa 你好" } } // <-- 已移除
        };
        // State variables
        this.isBookOpen = false; this.isBookAnimating = false; this.isPageAnimating = false; this.areFontsRendered = false; this.isSaving = false; this.isFetching = false;
        this.currentBookEntries = []; this.currentPageIndex = 0; this.currentDeletingEntryId = null; this.searchDebounceTimer = null;
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.loadCustomFonts(); // Load custom fonts into UI and document <head>
        this.applySettings();   // Apply global font and theme settings
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
                
                // Compatibility for custom fonts: ensure 'family' property exists
                mergedSettings.customFonts = (mergedSettings.customFonts || []).map(font => {
                    if (typeof font === 'object' && font !== null && !font.family && font.name) {
                        return { ...font, family: font.name }; // Use name as family if missing
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
        bind('save-entry-btn', 'click', this.saveEntry);
        bind('close-entry-form-btn', 'click', this.closeEntryForm);
        bind('toggle-tags-input-btn', 'click', this.toggleTagsInput);
        bind('cancel-delete-btn', 'click', this.closeConfirmationModal);
        bind('confirm-delete-btn', 'click', this.confirmDeleteEntry);
        bind('profile-btn', 'click', this.openProfileModal);
        bind('close-profile-btn', 'click', this.closeProfileModal);
        bind('edit-profile-btn', 'click', this.openEditProfileModal);
        bind('cancel-edit-profile-btn', 'click', this.closeEditProfileModal);
        bind('save-profile-btn', 'click', this.saveProfile);
        bind('profile-avatar-upload-trigger', 'click', () => document.getElementById('profile-avatar-file-input')?.click());
        bind('profile-avatar-file-input', 'change', this.handleAvatarUpload);
        bind('settings-btn', 'click', this.openSettingsModal);
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

        // Settings Panel Navigation
        bindAll('#settings-nav-list li', 'click', this.switchSettingsTab);
        // Theme Selection
        bindAll('.theme-option', 'click', this.selectTheme);
        // Global Font Selection
        bindAll('.font-option', 'click', this.handleFontSelection);
        // Add Custom Font (Global)
        bind('add-custom-font-btn', 'click', this.addCustomFont);
        // Update Book Font Settings
        bind('add-book-font-btn', 'click', this.updateBookFont);

        // Modal Closing (Generic)
        bindAll('.modal-close-btn', 'click', (e) => this.closeModal(e.target.closest('.modal-overlay')?.id));
        bindAll('.modal-overlay', 'click', (e) => { if (e.target === e.currentTarget) this.closeModal(e.target.id); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const activeModal = document.querySelector('.modal-overlay.active'); if (activeModal) this.closeModal(activeModal.id); } });

        // Search Input Handling
        bind('search-input', 'input', this.handleSearch);
        bind('clear-search-btn', 'click', this.clearSearch);

        // Custom Font List Deletion
        document.getElementById('custom-font-list')?.addEventListener('click', e => {
            if (e.target.classList.contains('delete-font-btn')) {
                this.deleteCustomFont(parseInt(e.target.dataset.index, 10));
            }
        });
        
        // Scroll to Top Button Visibility
        window.addEventListener('scroll', this.handleScroll);
    }

    // --- Diary Core Operations ---
    saveEntry() { // Saves a new or updated diary entry
        if (this.isSaving) return;
        const content = document.getElementById('diary-textarea').value.trim();
        const entryId = document.getElementById('editing-entry-id').value;
        if (!content) { this.showToast('Diary content cannot be empty', 'error'); return; }

        this.isSaving = true;
        const saveBtn = document.getElementById('save-entry-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        setTimeout(() => { // Simulate saving process
            const tags = document.getElementById('entry-tags-input').value.split(',').map(t => t.trim()).filter(Boolean);
            const now = new Date().toISOString();
            if (entryId) { // Update existing entry
                const entry = this.entries.find(e => e.id === entryId);
                if (entry) {
                    entry.content = content;
                    entry.tags = tags;
                    entry.updatedAt = now;
                    this.showToast('Diary updated');
                }
            } else { // Add new entry
                this.entries.unshift({ id: this.generateId(), content, tags, createdAt: now, updatedAt: now });
                this.showToast('Diary entry published');
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

    deleteEntry(entryId) { // Initiates the deletion process
        this.currentDeletingEntryId = entryId;
        this.showModal('confirmation-modal');
    }

    confirmDeleteEntry() { // Confirms and performs deletion
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
    renderEntries(query = '') { // Renders the list of diary entries, with optional filtering
        const container = document.getElementById('diary-thread');
        let filteredEntries = [...this.entries];

        if (query) { // Apply search filter
            const lowerQuery = query.toLowerCase();
            filteredEntries = filteredEntries.filter(e =>
                e.content.toLowerCase().includes(lowerQuery) ||
                (e.tags && e.tags.some(t => t.toLowerCase().includes(lowerQuery)))
            );
        }

        // Sort entries based on settings
        filteredEntries.sort((a, b) => this.settings.sortOrder === 'oldest'
            ? new Date(a.createdAt) - new Date(b.createdAt)
            : new Date(b.createdAt) - new Date(a.createdAt)
        );

        if (filteredEntries.length === 0) { // Display message if no entries
            container.innerHTML = `<div class="empty-message"><h3>${query ? 'No search results' : 'No diary entries yet'}</h3><p>${query ? 'Try different keywords?' : 'Click "Write New Diary" to start recording!'}</p></div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        filteredEntries.forEach((entry, index) => fragment.appendChild(this.createEntryElement(entry, index)));
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    createEntryElement(entry, index) { // Creates a DOM element for a single diary entry
        const div = document.createElement('div');
        div.className = 'diary-entry';
        div.style.animationDelay = `${index * 0.05}s`;
        // Generate tags HTML if available
        const tagsHtml = (entry.tags && entry.tags.length > 0)
            ? `<div class="entry-tags">${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
            : '';
        // Construct the HTML for the entry
        div.innerHTML = `
            <div class="entry-meta">
                <div class="author-info">
                    <div class="avatar small-avatar">${this.getAvatarHtml(this.settings.profile.avatar, this.settings.profile.name)}</div>
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
        // Add event listeners to edit/delete buttons
        div.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); this.openEntryForm(entry.id); });
        div.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); this.deleteEntry(entry.id); });
        return div;
    }

    // --- 3D Diary Book ---
    toggle3DView() { // Toggles between list view and 3D book view
        if (this.isBookAnimating) return;
        this.isBookOpen ? this.closeBookView() : this.openBookView();
    }

    openBookView() { // Opens the 3D book view
        this.isBookAnimating = true;
        this.isBookOpen = true;
        document.getElementById('diary-thread').classList.add('hidden');
        document.getElementById('diary-book-3d').classList.remove('hidden');
        this.renderBookPages();
        
        document.querySelector('.book').classList.add('open'); // Start cover animation
        setTimeout(() => {
            document.querySelector('.book-pages').classList.add('visible'); // Show pages after cover opens
            this.isBookAnimating = false;
        }, 800); // Match cover open animation duration
    }

    closeBookView() { // Closes the 3D book view
        this.isBookAnimating = true;
        this.isBookOpen = false;
        document.querySelector('.book-pages').classList.remove('visible');
        document.querySelector('.book').classList.remove('open'); // Start cover close animation

        setTimeout(() => { // Return to list view after cover closes
            document.getElementById('diary-book-3d').classList.add('hidden');
            document.getElementById('diary-thread').classList.remove('hidden');
            this.isBookAnimating = false;
        }, 800); // Match cover close animation duration
    }

    renderBookPages() { // Renders diary entries as pages in the 3D book
        const container = document.querySelector('#diary-book-3d .pages-container');
        const pageFragment = document.createDocumentFragment();
        // Sort entries for the book view (newest first)
        this.currentBookEntries = [...this.entries].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (this.currentBookEntries.length === 0) { // Handle empty book case
            container.innerHTML = `<div class="book-page"><div class="empty-page"><h3>The diary book is empty</h3><p>Write your first entry to start!</p></div></div>`;
            this.currentPageIndex = -1; // Indicate currently at cover
        } else {
            // Create DOM elements for each entry
            this.currentBookEntries.forEach((entry, i) => {
                const page = document.createElement('div');
                page.className = 'book-page';
                page.style.zIndex = this.currentBookEntries.length - i; // Stack order
                page.innerHTML = `
                    <div class="page-content-wrapper">
                        <div class="page-header">${this.getFormattedTime(entry.createdAt, 'full')}</div>
                        <div class="page-content">${this.formatContent(entry.content)}</div>
                        <div class="page-number">${i + 1} / ${this.currentBookEntries.length}</div>
                    </div>`;
                pageFragment.appendChild(page);
            });
            container.innerHTML = ''; // Clear previous content
            container.appendChild(pageFragment);
            this.currentPageIndex = 0; // Reset to the first page
        }
        this.updatePageIndicator(); // Update page navigation controls
    }
    
    changePage(direction) { // Handles page turning logic
        if (this.isPageAnimating) return;
        const pages = document.querySelectorAll('.book-page');
        const newIndex = this.currentPageIndex + direction;

        if (newIndex >= 0 && newIndex < this.currentBookEntries.length) { // Valid page index
            this.isPageAnimating = true;
            
            if (direction > 0) { // Turning forward
                pages[this.currentPageIndex].classList.add('flipped');
            } else { // Turning backward
                pages[newIndex].classList.remove('flipped');
            }

            this.currentPageIndex = newIndex;
            this.updatePageIndicator();
            setTimeout(() => { this.isPageAnimating = false; }, 800); // Match animation duration
        } else if (newIndex < 0 && this.currentPageIndex === 0) { // Trying to turn back from first page - close book
            this.closeBookView();
        }
    }
    
    updatePageIndicator() { // Updates the page number display and navigation button states
        const pageIndicatorSpan = document.getElementById('current-page');
        if (!pageIndicatorSpan) return;

        pageIndicatorSpan.textContent = this.currentPageIndex >= 0 ? `Page ${this.currentPageIndex + 1}` : 'Cover';
        document.getElementById('prev-page-btn').disabled = this.currentPageIndex <= 0;
        document.getElementById('next-page-btn').disabled = this.currentPageIndex >= this.currentBookEntries.length - 1;
    }
    
    // --- User Profile ---
    updateProfileDisplay() { // Updates the displayed profile info like avatar, name, stats
        const p = this.settings.profile;
        const avatarHtml = this.getAvatarHtml(p.avatar, p.name);
        document.getElementById('header-avatar-display').innerHTML = avatarHtml;
        document.getElementById('profile-display-avatar').innerHTML = avatarHtml;
        document.getElementById('profile-display-name').textContent = p.name || 'Anonymous User';
        document.getElementById('profile-display-signature').textContent = p.signature || 'This person is mysterious...';
        document.getElementById('total-entries').textContent = this.entries.length;
        document.getElementById('total-words').textContent = this.entries.reduce((sum, e) => sum + e.content.length, 0);
        const sortedEntries = [...this.entries].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        document.getElementById('latest-entry').textContent = sortedEntries.length > 0 ? this.getFormattedTime(sortedEntries[0].updatedAt || sortedEntries[0].createdAt) : '-';
    }

    saveProfile() { // Saves changes to user profile
        this.settings.profile.name = document.getElementById('profile-username-input').value.trim();
        this.settings.profile.signature = document.getElementById('profile-signature-input').value.trim();
        this.saveData();
        this.updateProfileDisplay();
        this.renderEntries(); // Update entry list display if name changed
        this.closeEditProfileModal();
        this.showToast('Profile updated');
    }

    handleAvatarUpload(e) { // Handles user uploading a new avatar image
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            this.settings.profile.avatar = e.target.result; // Store avatar data URL
            this.updateAvatarPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    updateAvatarPreview(imgData = this.settings.profile.avatar) { // Updates the avatar preview in the edit profile modal
        const previewArea = document.getElementById('profile-avatar-preview-area');
        const usernameInput = document.getElementById('profile-username-input'); // Get current name for fallback
        if (previewArea) {
            previewArea.innerHTML = this.getAvatarHtml(imgData, usernameInput ? usernameInput.value : 'U');
        }
    }

    // --- Settings Panel ---
    applySettings() { // Applies global settings (theme, font)
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        
        // Apply global font
        const fontOption = document.querySelector(`.font-option[data-font-id="${this.settings.fontId}"]`);
        const globalFont = fontOption ? fontOption.dataset.font : this.fontMap['sans-serif'].font; 
        document.body.style.fontFamily = globalFont;
        
        // Update active state in UI
        document.querySelectorAll('.font-option').forEach(el => el.classList.remove('active'));
        if (fontOption) fontOption.classList.add('active');
    }

    selectTheme(themeEl) { // Handles theme selection
        const theme = themeEl.dataset.theme;
        document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
        themeEl.classList.add('active');
        document.documentElement.setAttribute('data-theme', theme);
    }

    handleFontSelection(fontEl) { // Handles global font selection click
        fontEl.classList.add('active'); // Mark the selected font
        const fontId = fontEl.dataset.fontId;
        const fontValue = fontEl.dataset.font;
        document.body.style.fontFamily = fontValue; // Apply font to the body
        this.settings.fontId = fontId; // Update the setting state
        
         // Ensure others are inactive
         document.querySelectorAll('.font-option').forEach(el => {
            if (el !== fontEl) el.classList.remove('active');
         });
    }
    
    // --- Font Management ---
    loadCustomFonts() { // Loads custom fonts into the settings UI list and adds <link> tags if needed
        const customList = document.getElementById('custom-font-list');
        if (!customList) return; // Safety check
        customList.innerHTML = ''; // Clear existing list
        
        const fragment = document.createDocumentFragment();

        this.settings.customFonts.forEach((font, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${font.name || font.family}</span>
                <button class="delete-font-btn" data-index="${index}" title="Delete Font">&times;</button>
            `;
            fragment.appendChild(listItem);
            
            // Dynamically load font CSS if not already present
            if (font.url && !this.isFontAlreadyLoaded(font.url)) {
               const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = font.url;
                link.dataset.customFont = "true"; // Mark as custom font
                document.head.appendChild(link);
            }
        });
        customList.appendChild(fragment);
        this.areFontsRendered = false; // Mark that font options need re-rendering
    }

    isFontAlreadyLoaded(url) { // Checks if a font CSS is already linked in the document's head
        return Array.from(document.head.querySelectorAll('link[rel="stylesheet"][data-custom-font="true"]'))
            .some(link => link.href === url);
    }

    async parseFontInfo(url, userGivenName) { // Parses font family name and CSS from a URL or Data URL
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
        
        // Extract font-family value using regex
        const match = cssText.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/);
        if (!match || !match[1]) {
            throw new Error('Could not find font-family in CSS');
        }
        const family = match[1].trim();
        // Determine a usable name: prefer user-given, else derive from family
        const simpleName = userGivenName || family.split(',')[0].replace(/['"]/g, '').trim();
        return { name: simpleName, family: family, url: url };
    }

    async addCustomFont() { // Adds a new font from user input (URL)
        const nameInput = document.getElementById('custom-font-name-input');
        const urlInput = document.getElementById('custom-font-url-input');
        const addBtn = document.getElementById('add-custom-font-btn');
        const name = nameInput.value.trim().replace(/^['"]|['"]$/g, '');
        const url = urlInput.value.trim();
        if (!url) { this.showToast('Font URL cannot be empty', 'error'); return; }

        addBtn.disabled = true; addBtn.textContent = 'Parsing...';
        try {
            const fontInfo = await this.parseFontInfo(url, name);
            this.settings.customFonts.push(fontInfo); // Add to settings array
            this.saveData();
            this.loadCustomFonts(); // Refresh the list UI
            this.renderFontOptions(); // Re-render global font options
            this.showToast(`Font "${fontInfo.name}" added`);
            nameInput.value = ''; urlInput.value = ''; // Clear inputs
        } catch (error) {
            this.showToast(`Failed to add font: ${error.message}`, 'error');
        } finally {
            addBtn.disabled = false; addBtn.textContent = 'Add';
        }
    }

    deleteCustomFont(index) { // Deletes a custom font from the list
        const font = this.settings.customFonts[index];
        if (confirm(`Are you sure you want to delete the custom font "${font.name}"?`)) {
            this.settings.customFonts.splice(index, 1); // Remove from settings array
            // If the deleted font was selected globally, reset the global font setting
            if (this.settings.fontId.startsWith('custom-')) {
                const deletedCustomIndex = parseInt(this.settings.fontId.split('-')[1], 10);
                if (deletedCustomIndex === index) {
                    this.settings.fontId = 'sans-serif'; // Reset to default
                } else if (deletedCustomIndex > index) {
                    // Adjust index if font was before the deleted one
                    this.settings.fontId = `custom-${deletedCustomIndex - 1}`; 
                }
            }
            this.saveData();
            this.loadCustomFonts(); // Update UI list
            this.renderFontOptions(); // Re-render options to update active state etc.
            this.applySettings(); // Re-apply global font settings to ensure consistency
            this.showToast(`Font "${font.name}" deleted`, 'info');
        }
    }
    
    // Checks if the URL for a book font has changed compared to settings
    isBookFontUrlChanged(newUrl, type) { 
        const currentUrl = this.settings.bookFont[type === 'zh' ? 'chinese' : 'english'].url;
        return newUrl && newUrl !== currentUrl;
    }

    async updateBookFont() { // Updates the default fonts for the 3D diary book
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
        
        // Helper to update a specific font setting (Chinese or English)
        const updateFontSetting = async (type, name, url) => {
            let currentFont = this.settings.bookFont[type];
            const urlChanged = this.isBookFontUrlChanged(url, type);
            
            if (!url) { // If URL is cleared, reset the font setting for this type
                currentFont = { name: '', family: '', url: '' };
            } else if (urlChanged) { // If URL changed, parse the new font info
                const fontInfo = await this.parseFontInfo(url, name);
                currentFont = fontInfo;
            } else if (name) { // If URL is the same but name changed
                currentFont.name = name || currentFont.family; // Update name if provided
            }
            this.settings.bookFont[type] = currentFont; // Update the settings object
        };

        try {
            // Concurrently update Chinese and English font settings
            await Promise.all([
                updateFontSetting('chinese', zhName, zhUrl),
                updateFontSetting('english', enName, enUrl)
            ]);
            this.saveData(); // Save new settings
            this.applyBookFonts(); // Apply the updated fonts visually
            this.showToast('Book fonts updated');
        } catch (error) {
            this.showToast(`Failed to set book fonts: ${error.message}`, 'error');
        } finally {
            this.isFetching = false;
            addBtn.disabled = false; addBtn.textContent = 'Set Book Fonts';
        }
    }

    applyBookFonts() { // Applies the configured book fonts to CSS variables and loads font files
        const applyType = (type, fontSetting) => {
            // Determine the CSS variable name ('--book-font-zh' or '--book-font-en')
            const cssVarName = type === 'chinese' ? '--book-font-zh' : '--book-font-en';
            if (fontSetting && fontSetting.family) { // If font details are available
                document.documentElement.style.setProperty(cssVarName, `'${fontSetting.family}', sans-serif`); // Set CSS variable
                 // Load the font CSS if not already loaded
                if (fontSetting.url && !this.isFontAlreadyLoadedForBook(fontSetting.url)) {
                    const style = document.createElement('style');
                    style.dataset.bookFont = type; // Mark this style element
                    if (fontSetting.url.startsWith('data:') && fontSetting.url.includes(',')) { // Data URL
                        const decodedCss = decodeURIComponent(fontSetting.url.substring(fontSetting.url.indexOf(',') + 1));
                        style.textContent = decodedCss;
                    } else { // Regular URL
                        style.textContent = `@import url('${fontSetting.url}');`;
                    }
                    document.head.appendChild(style);
                }
            } else {
                document.documentElement.style.removeProperty(cssVarName); // Reset to default if no font is set
            }
        };
        
        applyType('chinese', this.settings.bookFont?.chinese); // Apply Chinese font
        applyType('english', this.settings.bookFont?.english); // Apply English font

        // If book is currently open, force a visual refresh of the pages
        if (this.isBookOpen) {
            // Clear inline style to make CSS variables effective
             document.querySelectorAll('.book-page .page-content').forEach(el => {
                el.style.fontFamily = ''; 
             });
            // Force repaint by accessing a DOM property
            document.querySelector('.book-pages').clientHeight;
        }
    }
    
    isFontAlreadyLoadedForBook(url) { // Helper to check if book font CSS is already loaded
         return Array.from(document.head.querySelectorAll('style[data-book-font]'))
            .some(style => { const content = style.textContent || ''; return content.includes(url); });
    }

    renderFontOptions() { // Renders the global font options in the settings panel
        const container = document.getElementById('font-options-container');
        if (!container) return;
        container.innerHTML = ''; // Clear previous options
        
        const fragment = document.createDocumentFragment();

        // Helper function to create a font option element
        const addFontOption = (id, config) => {
            const option = document.createElement('div');
            // Assign class based on font type for preview styling
            option.className = `font-option ${id === 'serif' ? 'font-serif' : (id === 'handwritten' ? 'font-handwritten' : 'font-sans')}`;
            option.dataset.fontId = id; // Store the ID for selection
            option.dataset.font = config.font; // Store the actual font-family value
            option.innerHTML = `
                <div class="font-preview">${config.previews?.aa || 'Aa 你好'}</div>
                <span>${config.name}</span>
                <small>${config.description || ''}</small>
            `;
            // Mark the currently active font
            if (id === this.settings.fontId) option.classList.add('active');
            fragment.appendChild(option);
        };

        // Add preset fonts (excluding handwritten now)
        addFontOption('sans-serif', this.fontMap['sans-serif']);
        addFontOption('serif', this.fontMap['serif']);
        // addFontOption('handwritten', this.fontMap['handwritten']); // <-- Excluded as requested
        
        // Add custom fonts from settings
        this.settings.customFonts.forEach((font, index) => {
            const customId = `custom-${index}`;
            const option = document.createElement('div');
            // Use specific class for custom font preview styling if needed, or rely on inline style
            option.className = 'font-option custom-font-option'; 
            option.dataset.fontId = customId;
            option.dataset.font = `'${font.family}', sans-serif`; // Use the parsed family name as fallback
            option.innerHTML = `
                <div class="font-preview" style="font-family: '${font.family}', sans-serif;">Aa 你好</div>
                <span>${font.name}<small>Custom</small></span>
            `;
            if (customId === this.settings.fontId) option.classList.add('active'); // Mark custom font if selected
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
        // Perform cleanup actions for specific modals upon closing
        if (id === 'settings-modal') this.closeSettingsModal(); 
        if (id === 'confirmation-modal') this.currentDeletingEntryId = null;
        if (id === 'clear-data-modal') { // Reset clear data modal state
            document.getElementById('clear-data-confirm-input').value = '';
            document.getElementById('confirm-clear-data-btn').disabled = true;
        }
    }

    openEntryForm(entryId = null) { // Opens the form for writing or editing a diary entry
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
        
        // Show tags input only if editing and entry has tags
        tagsInputContainer.classList.toggle('hidden', !isEdit || !entry?.tags?.length); 
        this.showModal('entry-form-modal');
    }
    closeEntryForm() { this.closeModal('entry-form-modal'); document.getElementById('editing-entry-id').value = ''; } // Clear hidden ID on close

    openProfileModal() { this.showModal('profile-modal'); }
    closeProfileModal() { this.closeModal('profile-modal'); }
    
    openEditProfileModal() { // Opens the modal to edit user profile
        document.getElementById('profile-username-input').value = this.settings.profile.name;
        document.getElementById('profile-signature-input').value = this.settings.profile.signature;
        this.updateAvatarPreview(); // Initialize preview
        this.showModal('edit-profile-modal');
    }
    closeEditProfileModal() { this.closeModal('edit-profile-modal'); }

    openSettingsModal() { // Opens the settings modal and populates it with current settings
        if (!this.areFontsRendered) this.renderFontOptions(); // Render global font options if not already done
        
        // Apply current settings to UI controls
        this.selectTheme(document.querySelector(`.theme-option[data-theme="${this.settings.theme}"]`));
        const fontOption = document.querySelector(`.font-option[data-font-id="${this.settings.fontId}"]`);
        if (fontOption) this.handleFontSelection(fontOption); // Highlight active global font
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
    
    closeConfirmationModal() { this.closeModal('confirmation-modal'); this.currentDeletingEntryId = null; }
    openClearDataModal() { this.showModal('clear-data-modal'); document.getElementById('clear-data-confirm-input').value = ''; document.getElementById('confirm-clear-data-btn').disabled = true; } // Resets the confirmation input
    closeClearDataModal() { this.closeModal('clear-data-modal'); }
    
    // --- Utility Functions ---
    handleSearch() { // Handles search input filtering entries with debouncing
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            const query = document.getElementById('search-input').value.trim();
            this.renderEntries(query);
            document.getElementById('clear-search-btn').classList.toggle('hidden', query.length === 0);
        }, 300); // Delay search execution by 300ms
    }
    clearSearch() { // Clears the search input and resets the entries view
        document.getElementById('search-input').value = '';
        this.handleSearch();
    }
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 9); } // Generates a unique ID
    showToast(message, type = 'success') { // Displays a temporary message at the bottom
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10); // Trigger fade-in animation
        setTimeout(() => { // Remove toast after animation and delay
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300); // Fade-out duration
        }, 3000); // Toast visible for 3 seconds
    }
    formatContent(content) { // Basic formatting for diary content (newlines to <br>, paragraphs)
        if (!content) return '';
        return `<p>${content.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }
    getAvatarHtml(avatarSource, name) { // Returns HTML for avatar (image or initials)
        if (avatarSource && avatarSource.startsWith('data:image')) {
            return `<img src="${avatarSource}" alt="avatar">`; // Use provided image URL
        }
        // Fallback to initials
        const text = (name ?.charAt(0) || '?').toUpperCase();
        if (text === '?') { // Default icon if name is unavailable
            return '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        }
        return text; // Return initials
    }
    getFormattedTime(dateString, format = 'relative') { // Formats date/time based on settings
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = (now - date) / 1000;

        switch(format){
            case 'full': return date.toLocaleString(); // Full locale string
            case 'short': { // Short format like MM-DD HH:MM
                const month = (date.getMonth() + 1).toString().padStart(2,'0');
                const day = date.getDate().toString().padStart(2,'0');
                const hours = date.getHours().toString().padStart(2,'0');
                const mins = date.getMinutes().toString().padStart(2,'0');
                return `${month}-${day} ${hours}:${mins}`;
            }
            default: // relative time (e.g., "5 minutes ago")
                if (diffInSeconds < 60) return "Just now";
                if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
                if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
                if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
                return date.toLocaleDateString(); // Fallback for older dates
        }
    }
    handleScroll() { // Controls visibility of the "scroll to top" button
        const btn = document.getElementById('scroll-to-top-btn');
        if (window.scrollY > 300) btn.classList.add('show');
        else btn.classList.remove('show');
    }
    scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); } // Scrolls page smoothly to the top
    checkClearDataInput(input) { // Enables/disables the clear data button based on input
        document.getElementById('confirm-clear-data-btn').disabled = input.value.trim() !== 'DELETE';
    }
    confirmClearAllData() { // Clears all local data and reloads the page
        if (document.getElementById('clear-data-confirm-input').value.trim() === 'DELETE') {
            localStorage.removeItem('diaryAppData');
            window.location.reload(); // Reset the application
        }
    }
    exportData() { // Exports diary data and settings as a JSON file
        const dataStr = JSON.stringify({ entries: this.entries, settings: this.settings }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diary_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url); // Clean up memory
    }
    importData(event) { // Imports data from a JSON file
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (confirm('Importing data will overwrite existing content. Continue?')) {
                    this.entries = data.entries || [];
                    // Merge settings carefully to maintain defaults and apply imported ones
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
        event.target.value = null; // Reset file input for re-uploading the same file
    }
    mergeDeep(target, ...sources) { // Deep object merging utility
        if (!sources.length) return target;
        const source = sources.shift();
        if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                        // Recursively merge nested objects
                        if (!target[key] || typeof target[key] !== 'object') {
                           Object.assign(target, { [key]: {} }); // Ensure target property is an object
                        }
                        this.mergeDeep(target[key], source[key]);
                    } else {
                        // Assign primitive values or arrays
                        Object.assign(target, { [key]: source[key] });
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
        
        // Cleanup actions upon closing specific modals
        if (id === 'settings-modal') this.closeSettingsModal(); 
        if (id === 'confirmation-modal') this.currentDeletingEntryId = null;
        if (id === 'clear-data-modal') { // Reset state for clear data modal
            document.getElementById('clear-data-confirm-input').value = '';
            document.getElementById('confirm-clear-data-btn').disabled = true;
        }
    }
    switchSettingsTab(tabElement) { // Switches active tab in settings panel
        document.querySelectorAll('#settings-nav-list li').forEach(li => li.classList.remove('active'));
        tabElement.classList.add('active');
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(tabElement.dataset.target)?.classList.add('active');
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.diaryApp = new SimpleDiaryApp();
});
