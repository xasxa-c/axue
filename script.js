/**
 * SimpleDiaryApp - v5.5 (样式 & 字体预设修正)
 * -------------------------------------------
 * - [样式修正] 恢复并优化了大部分 CSS 样式，使其更符合你原有的美观 HTML 结构。
 * - [功能修正] **严格移除了全局字体选项中的“站酷快乐体”预设。**
 * - [功能增强] **3D日记本默认中文字体使用指定CSS，英文字体默认使用 Sacramento 花体。**
 * - [逻辑优化] 用户添加的自定义字体现在可以被选为全局字体，也可被指定为日记本字体。
 * - [代码优化] `fontMap` 和 `renderFontOptions` 逻辑已同步更新，确保字体管理一致性。
 */
class SimpleDiaryApp {
    constructor() {
        this.constructor.defaultSettings = {
            theme: 'light',
            fontId: 'sans-serif', // Default global font ID
            customFonts: [],     // Stores { name, family, url } for user-added fonts
            bookFont: { // Default fonts for 3D diary book
                chinese: { name: '日记本默认', family: 'var(--font-sans)', url: 'https://fontsapi.zeoseven.com/96/main/result.css' },
                english: { name: 'Sacramento', family: "'Sacramento', cursive", url: 'https://fonts.googleapis.com/css2?family=Sacramento&display=swap' }
            },
            profile: { name: '匿名用户', signature: '这个人很神秘，什么也没说。', avatar: '' },
            timeFormat: 'relative',
            sortOrder: 'newest'
        };
        this.entries = [];
        this.settings = JSON.parse(JSON.stringify(this.constructor.defaultSettings));
        // **fontMap updated: 'handwritten' preset removed**
        this.fontMap = {
            'sans-serif': { name: "思源黑体", font: "'Noto Sans SC', sans-serif", description: "现代简洁", previews: { aa: "Aa 你好" } },
            'serif': { name: "思源宋体", font: "'Noto Serif SC', serif", description: "优雅古典", previews: { aa: "Aa 你好" } },
            // 'handwritten': { name: "站酷快乐体", font: "'ZCOOL KuaiLe', cursive", ... } // Removed as requested
        };
        // State variables
        this.isBookOpen = false; this.isBookAnimating = false; this.isPageAnimating = false; this.areFontsRendered = false; this.isSaving = false; this.isFetching = false;
        this.currentBookEntries = []; this.currentPageIndex = 0; this.currentDeletingEntryId = null; this.searchDebounceTimer = null;
        
        this.init();
    }

    // --- Initialization and Data Handling ---
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
    
    checkInitialState() { // Checks if it's the first visit to show welcome modal
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
                // Merge settings carefully, prioritizing saved over defaults
                const mergedSettings = this.mergeDeep(JSON.parse(JSON.stringify(this.constructor.defaultSettings)), data.settings || {});
                
                // Ensure customFonts format is consistent { name, family, url }
                mergedSettings.customFonts = (mergedSettings.customFonts || []).map(font => {
                    if (typeof font === 'object' && font !== null && !font.family && font.name) {
                        return { ...font, family: font.name }; // Fallback family name
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

        setTimeout(() => { // Simulate saving process
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

    deleteEntry(entryId) { // Initiates the deletion process
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

        if (filteredEntries.length === 0) { // Display message if no entries match query or list is empty
            container.innerHTML = `<div class="empty-message"><h3>${query ? 'No search results' : 'No diary entries yet'}</h3><p>${query ? 'Try different keywords?' : 'Click "Write New Diary" to start recording!'}</p></div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        filteredEntries.forEach((entry, index) => fragment.appendChild(this.createEntryElement(entry, index)));
        container.innerHTML = ''; // Clear previous content
        container.appendChild(fragment);
    }

    createEntryElement(entry, index) { // Creates a DOM element for a single diary entry
        const div = document.createElement('div');
        div.className = 'diary-entry';
        div.style.animationDelay = `${index * 0.05}s`; // Stagger entry animations
        // Generate tags HTML if available
        const tagsHtml = (entry.tags && entry.tags.length > 0)
            ? `<div class="entry-tags">${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
            : '';
        // Construct the HTML for the entry
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
        // Add click listeners to edit/delete buttons
        div.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); this.openEntryForm(entry.id); });
        div.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); this.deleteEntry(entry.id); });
        return div;
    }

    // --- 3D Diary Book Logic ---
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
        
        setTimeout(() => { // Start cover animation
            document.querySelector('.book-cover').classList.add('opened');
            setTimeout(() => { // Show pages after cover anim
                document.querySelector('.book-pages').classList.add('visible');
                this.isBookAnimating = false;
            }, 500); // Match cover open animation duration
        }, 100);
    }

    closeBookView() { // Closes the 3D book view
        this.isBookAnimating = true;
        this.isBookOpen = false;
        document.querySelector('.book-cover').classList.remove('opened');
        document.querySelector('.book-pages').classList.remove('visible');
        
        setTimeout(() => { // Return to list view after cover closes
            document.getElementById('diary-book-3d').classList.add('hidden');
            document.getElementById('diary-thread').classList.remove('hidden');
            this.isBookAnimating = false;
        }, 800); // Match cover close animation duration
    }

    renderBookPages() { // Renders diary entries as pages in the 3D book
        const container = document.querySelector('#diary-book-3d .pages-container');
        // Sort entries for the book view (newest first)
        this.currentBookEntries = [...this.entries].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (this.currentBookEntries.length === 0) { // Handle empty book case
            container.innerHTML = `<div class="book-page"><div class="empty-page"><h3>The diary book is empty</h3><p>Write your first entry to start!</p></div></div>`;
            this.currentPageIndex = -1; // Indicate currently at cover
        } else {
            const fragment = document.createDocumentFragment();
            // Create DOM elements for each entry as a page
            this.currentBookEntries.forEach((entry, i) => {
                const page = document.createElement('div');
                page.className = 'book-page';
                page.style.zIndex = this.currentBookEntries.length - i; // Stack pages correctly
                page.innerHTML = `
                    <div class="page-content-wrapper">
                        <div class="page-header"><div class="page-date">${this.getFormattedTime(entry.createdAt, 'full')}</div></div>
                        <div class="page-content">${this.formatContent(entry.content)}</div>
                        <div class="page-number">${i + 1} / ${this.currentBookEntries.length}</div>
                    </div>`;
                fragment.appendChild(page);
            });
            container.innerHTML = ''; // Clear previous pages
            container.appendChild(fragment);
            this.currentPageIndex = 0; // Reset to the first page
        }
        this.updatePageIndicator(); // Update navigation controls visibility and text
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
    
    updatePageIndicator() { // Updates page number display and navigation button states
        const pageIndicatorSpan = document.getElementById('current-page');
        if (!pageIndicatorSpan) return; // Safety check
        pageIndicatorSpan.textContent = this.currentPageIndex >= 0 ? `第 ${this.currentPageIndex + 1} 页` : '封面'; // Update page number text
        document.getElementById('prev-page-btn').disabled = this.currentPageIndex <= 0; // Disable prev if on first page or cover
        document.getElementById('next-page-btn').disabled = this.currentPageIndex >= this.currentBookEntries.length - 1; // Disable next if on last page
    }
    
    // --- User Profile Logic ---
    updateProfileDisplay() { // Updates displayed profile info (avatar, name, signature, stats)
        const profile = this.settings.profile;
        const avatarHtml = this.getAvatarHtml(profile.avatar, profile.name);
        document.getElementById('header-avatar-display').innerHTML = avatarHtml; // Update header avatar
        document.getElementById('profile-display-avatar').innerHTML = avatarHtml; // Update profile modal avatar
        document.getElementById('profile-display-name').textContent = profile.name || 'Anonymous User';
        document.getElementById('profile-display-signature').textContent = profile.signature || 'This person is mysterious...';
        // Update stats
        document.getElementById('total-entries').textContent = this.entries.length;
        document.getElementById('total-words').textContent = this.entries.reduce((sum, e) => sum + e.content.length, 0);
        // Update latest entry date
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

    handleAvatarUpload(event) { // Handles fetching and previewing avatar image file
        const file = event.target.files[0];
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
        if (previewArea) {
            previewArea.innerHTML = this.getAvatarHtml(imgData, document.getElementById('profile-username-input')?.value);
        }
    }

    // --- Settings Panel Logic ---
    saveSettings() { // Saves current settings from UI controls
        this.settings.theme = document.querySelector('.theme-option.active')?.dataset.theme || 'light';
        const activeFont = document.querySelector('.font-option.active');
        if (activeFont) this.settings.fontId = activeFont.dataset.fontId; // Store selected global font ID
        this.settings.timeFormat = document.querySelector('input[name="timeFormat"]:checked')?.value || 'relative';
        this.settings.sortOrder = document.querySelector('input[name="sortOrder"]:checked')?.value || 'newest';
        
        this.saveData(); // Save settings to local storage
        this.applySettings(); // Apply theme and font changes visually
        this.renderEntries(); // Re-render entries if sorting or formatting changed
        this.showToast('Settings saved');
        this.closeModal('settings-modal'); 
    }
    
    selectTheme(theme) { // Handles theme selection click in settings
        document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
        document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active');
        document.documentElement.setAttribute('data-theme', theme); // Apply theme to root element
    }
    
    handleFontSelection(event) { // Handles global font selection click in settings
        const fontOption = event.target.closest('.font-option');
        if (fontOption) this.selectFont(fontOption);
    }

    selectFont(fontEl) { // Manually sets active state and applies font to body
        document.querySelectorAll('.font-option').forEach(el => el.classList.remove('active'));
        fontEl.classList.add('active');
        const fontId = fontEl.dataset.fontId;
        
        let fontFamilyToApply = this.fontMap[fontId]; // Default to presets
        // If it's a custom font, construct the family string dynamically
        if (fontId.startsWith('custom-')) {
            const index = parseInt(fontId.split('-')[1], 10);
            const customFont = this.settings.customFonts[index];
            if (customFont) {
                fontFamilyToApply = `'${customFont.family}', sans-serif`; // Use parsed family
            }
        }
        document.body.style.fontFamily = fontFamilyToApply; // Apply font to the entire body
    }
    
    applySettings() { // Applies theme and global font settings from `this.settings`
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        
        // Construct a temporary map including custom fonts for lookup
        const tempFontMap = { ...this.fontMap };
         this.settings.customFonts.forEach((font, index) => {
            tempFontMap[`custom-${index}`] = `'${font.family}', sans-serif`; // Map custom font ID to its family string
        });
        // Get the font family string for the currently selected fontId, with fallback
        const fontToApply = tempFontMap[this.settings.fontId] || this.fontMap['sans-serif']; // Fallback to sans-serif
        if (document.body.style.fontFamily !== fontToApply) { // Apply only if changed
            document.body.style.fontFamily = fontToApply;
        }
    }

    // --- Font Management (Custom Fonts) ---
    loadCustomFonts() { // Loads custom fonts into UI list and adds <link> tags if needed
        document.querySelectorAll('link[data-custom-font]').forEach(link => link.remove()); // Clear previous custom font links
        
        const customList = document.getElementById('custom-font-list');
        if (!customList) return; // Exit if element not found
        customList.innerHTML = ''; // Clear current list in settings panel
        
        const fragmentOptions = document.createDocumentFragment(); // For global font options
        const fragmentList = document.createDocumentFragment();     // For custom font list in settings

        this.settings.customFonts.forEach((font, index) => {
            // Add font to Global Font Options UI
            const fontId = `custom-${index}`;
            const option = document.createElement('div');
            option.className = 'font-option custom-font-option'; // Need custom class for styling
            option.dataset.fontId = fontId;
            // Use parsed family for preview style, fallback if missing
            const previewFontFamily = font.family ? `'${font.family}', sans-serif` : "var(--font-sans)"; 
            option.innerHTML = `<div class="font-preview" style="font-family: ${previewFontFamily};">Aa 你好</div><span>${font.name}<small>Custom</small></span>`;
            if (fontId === this.settings.fontId) option.classList.add('active'); // Mark if selected
            fragmentOptions.appendChild(option);
            
            // Add font to Custom Font List in Settings UI
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${font.name}</span> <button class="delete-font-btn" data-index="${index}">&times;</button>`;
            fragmentList.appendChild(listItem);
            
            // Dynamically load font CSS if not already loaded
            if (font.url && !this.isFontAlreadyLoaded(font.url)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = font.url;
                link.dataset.customFont = "true"; // Mark as custom font link
                document.head.appendChild(link);
            }
        });
        document.getElementById('font-options-container').appendChild(fragmentOptions); // Append to global options
        customList.appendChild(fragmentList); // Append to custom list in settings
        this.areFontsRendered = false; // Mark that options need re-rendering
    }

    isFontAlreadyLoaded(url) { // Checks if a font CSS link already exists in the head
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
        
        // Use Regex to find font-family declaration
        const match = cssText.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/);
        if (!match || !match[1]) {
            throw new Error('Could not find font-family in CSS');
        }
        const family = match[1].trim();
        // Determine font name: prefer user's input, fallback to parsed family name
        const simpleName = userGivenName || family.split(',')[0].replace(/['"]/g, '').trim();
        return { name: simpleName, family: family, url: url };
    }

    async addCustomFont() { // Adds a new custom font from user input (URL)
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
 
