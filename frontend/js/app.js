/**
 * Main Application
 * Initializes and manages the OCR Document Annotation System
 */

class App {
    constructor() {
        this.currentPage = 'upload';
        this.state = Utils.createStateManager({
            isLoading: false,
            connectionStatus: 'connecting',
            categories: [],
            documents: [],
            currentDocument: null,
            annotations: []
        });
        
        // Page managers
        this.pageManagers = new Map();
        
        // Initialize
        this.init();
    }

    async init() {
        try {
            CONFIG.log('Initializing OCR Annotation System...');
            
            // Show loading screen
            this.showLoadingScreen();
            
            // Check browser compatibility
            this.checkBrowserCompatibility();
            
            // Initialize UI
            this.initializeUI();
            
            // Initialize page managers
            await this.initializePageManagers();
            
            // Check API connection
            await this.checkAPIConnection();
            
            // Load initial data
            await this.loadInitialData();
            
            // Hide loading screen and show app
            this.hideLoadingScreen();
            
            CONFIG.log('Application initialized successfully');
            
        } catch (error) {
            CONFIG.error('Failed to initialize application:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Check browser compatibility
     */
    checkBrowserCompatibility() {
        const requiredFeatures = [
            { name: 'Canvas API', check: CONFIG.supportsCanvas },
            { name: 'File API', check: CONFIG.supportsFileAPI },
            { name: 'Fetch API', check: () => typeof fetch !== 'undefined' },
            { name: 'Promise', check: () => typeof Promise !== 'undefined' },
            { name: 'Map', check: () => typeof Map !== 'undefined' },
            { name: 'Set', check: () => typeof Set !== 'undefined' }
        ];

        const unsupportedFeatures = requiredFeatures.filter(feature => !feature.check());
        
        if (unsupportedFeatures.length > 0) {
            const featureNames = unsupportedFeatures.map(f => f.name).join(', ');
            throw new Error(`Your browser doesn't support required features: ${featureNames}`);
        }
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Initialize navigation
        this.initializeNavigation();
        
        // Initialize global event listeners
        this.initializeGlobalEventListeners();
        
        // Initialize keyboard shortcuts
        this.initializeKeyboardShortcuts();
        
        // Initialize state subscriptions
        this.initializeStateSubscriptions();
    }

    /**
     * Initialize navigation
     */
    initializeNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const page = button.getAttribute('data-page');
                if (page) {
                    this.navigateToPage(page);
                }
            });
        });
    }

    /**
     * Initialize global event listeners
     */
    initializeGlobalEventListeners() {
        // Handle window resize
        window.addEventListener('resize', 
            Utils.throttle(() => {
                this.handleWindowResize();
            }, CONFIG.PERFORMANCE.RESIZE_THROTTLE)
        );

        // Handle online/offline status
        window.addEventListener('online', () => {
            this.updateConnectionStatus('connected');
            toast.success('Connection restored');
        });

        window.addEventListener('offline', () => {
            this.updateConnectionStatus('offline');
            toast.warning('Connection lost');
        });

        // Handle unload (save data)
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }

    /**
     * Initialize keyboard shortcuts
     */
    initializeKeyboardShortcuts() {
        if (!CONFIG.FEATURES.KEYBOARD_SHORTCUTS) return;

        document.addEventListener('keydown', (e) => {
            // Don't handle shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
            
            switch (key) {
                case CONFIG.SHORTCUTS.SAVE:
                    e.preventDefault();
                    this.saveCurrentWork();
                    break;
                case CONFIG.SHORTCUTS.ESCAPE:
                    this.handleEscapeKey();
                    break;
            }
        });
    }

    /**
     * Initialize state subscriptions
     */
    initializeStateSubscriptions() {
        this.state.subscribe((newState, prevState) => {
            // Update connection status indicator
            if (newState.connectionStatus !== prevState.connectionStatus) {
                this.updateConnectionStatusUI(newState.connectionStatus);
            }
            
            // Update loading state
            if (newState.isLoading !== prevState.isLoading) {
                this.updateLoadingState(newState.isLoading);
            }
        });
    }

    /**
     * Initialize page managers
     */
    async initializePageManagers() {
        // Import and initialize page managers
        const { UploadPageManager } = await import('./pages/upload.js');
        const { AnnotatePageManager } = await import('./pages/annotate.js');
        const { InferencePageManager } = await import('./pages/inference.js');
        const { ResultsPageManager } = await import('./pages/results.js');

        this.pageManagers.set('upload', new UploadPageManager(this));
        this.pageManagers.set('annotate', new AnnotatePageManager(this));
        this.pageManagers.set('inference', new InferencePageManager(this));
        this.pageManagers.set('results', new ResultsPageManager(this));
    }

    /**
     * Check API connection
     */
    async checkAPIConnection() {
        try {
            this.updateConnectionStatus('connecting');
            const health = await api.checkHealth();
            
            if (health.status === 'healthy') {
                this.updateConnectionStatus('connected');
                CONFIG.log('API connection established');
            } else {
                throw new Error('API health check failed');
            }
        } catch (error) {
            this.updateConnectionStatus('error');
            CONFIG.warn('API connection failed:', error.message);
            toast.warning('Unable to connect to server. Some features may not work.');
        }
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            // Load categories
            const categoriesResponse = await api.get(CONFIG.ENDPOINTS.CATEGORIES);
            this.state.setState({ 
                categories: categoriesResponse.categories || [] 
            });
            
            CONFIG.log('Initial data loaded');
        } catch (error) {
            CONFIG.warn('Failed to load initial data:', error);
            // Don't throw error - app can still work without initial data
        }
    }

    /**
     * Navigate to page
     */
    navigateToPage(pageName) {
        if (this.currentPage === pageName) return;

        // Hide current page
        const currentPageElement = document.getElementById(`${this.currentPage}-page`);
        if (currentPageElement) {
            currentPageElement.classList.remove('active');
        }

        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const newNavBtn = document.querySelector(`[data-page="${pageName}"]`);
        if (newNavBtn) {
            newNavBtn.classList.add('active');
        }

        // Show new page
        const newPageElement = document.getElementById(`${pageName}-page`);
        if (newPageElement) {
            newPageElement.classList.add('active');
        }

        // Notify page managers
        const currentManager = this.pageManagers.get(this.currentPage);
        if (currentManager && currentManager.onPageHide) {
            currentManager.onPageHide();
        }

        const newManager = this.pageManagers.get(pageName);
        if (newManager && newManager.onPageShow) {
            newManager.onPageShow();
        }

        this.currentPage = pageName;
        CONFIG.log('Navigated to page:', pageName);
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status) {
        this.state.setState({ connectionStatus: status });
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatusUI(status) {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;

        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');

        if (indicator) {
            indicator.className = `status-indicator ${status}`;
        }

        if (text) {
            const statusTexts = {
                connecting: 'Connecting...',
                connected: 'Connected',
                error: 'Connection Error',
                offline: 'Offline'
            };
            text.textContent = statusTexts[status] || 'Unknown';
        }
    }

    /**
     * Update loading state
     */
    updateLoadingState(isLoading) {
        // Update UI to show/hide loading indicators
        const loadingElements = document.querySelectorAll('.loading-indicator');
        loadingElements.forEach(element => {
            element.style.display = isLoading ? 'block' : 'none';
        });
    }

    /**
     * Show loading screen
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen) loadingScreen.style.display = 'flex';
        if (app) app.style.display = 'none';
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        if (app) {
            app.style.display = 'block';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        toast.error(message);
    }

    /**
     * Handle window resize
     */
    handleWindowResize() {
        // Notify current page manager
        const currentManager = this.pageManagers.get(this.currentPage);
        if (currentManager && currentManager.onResize) {
            currentManager.onResize();
        }
    }

    /**
     * Handle escape key
     */
    handleEscapeKey() {
        // Close modals first
        if (modal.getActiveCount() > 0) {
            modal.closeTop();
            return;
        }

        // Notify current page manager
        const currentManager = this.pageManagers.get(this.currentPage);
        if (currentManager && currentManager.onEscape) {
            currentManager.onEscape();
        }
    }

    /**
     * Save current work
     */
    async saveCurrentWork() {
        const currentManager = this.pageManagers.get(this.currentPage);
        if (currentManager && currentManager.save) {
            try {
                await currentManager.save();
                toast.success('Work saved successfully');
            } catch (error) {
                toast.error('Failed to save work');
                CONFIG.error('Save failed:', error);
            }
        }
    }

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges() {
        const currentManager = this.pageManagers.get(this.currentPage);
        return currentManager && currentManager.hasUnsavedChanges 
            ? currentManager.hasUnsavedChanges() 
            : false;
    }

    /**
     * Get current state
     */
    getState() {
        return this.state.getState();
    }

    /**
     * Update state
     */
    setState(newState) {
        this.state.setState(newState);
    }

    /**
     * Get page manager
     */
    getPageManager(pageName) {
        return this.pageManagers.get(pageName);
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
} else {
    window.App = App;
}
