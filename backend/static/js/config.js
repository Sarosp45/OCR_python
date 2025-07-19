/**
 * Application Configuration
 * Central configuration for the OCR Document Annotation System
 */

// Environment-based configuration
const CONFIG = {
    // API Configuration - Updated for Flask backend integration
    API_BASE_URL: `${window.location.protocol}//${window.location.host}`,

    UPLOADS_BASE_URL: `${window.location.protocol}//${window.location.host}/uploads`,
    
    // Timeouts (in milliseconds)
    API_TIMEOUT: 30000,
    UPLOAD_TIMEOUT: 60000,
    IMAGE_LOAD_TIMEOUT: 10000,
    
    // Retry Configuration
    IMAGE_RETRY_ATTEMPTS: 3,
    IMAGE_RETRY_DELAY: 1000,
    API_RETRY_ATTEMPTS: 2,
    API_RETRY_DELAY: 500,
    
    // File Upload Configuration
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/tiff',
        'image/bmp',
        'application/pdf'
    ],
    ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.pdf'],
    
    // Canvas Configuration
    CANVAS: {
        MAX_WIDTH: 1400,
        MAX_HEIGHT: 1000,
        MIN_ZOOM: 0.1,
        MAX_ZOOM: 5.0,
        ZOOM_STEP: 0.1,
        PAN_SPEED: 1.0,
        GRID_SIZE: 10,
        SNAP_THRESHOLD: 5
    },
    
    // Annotation Configuration
    ANNOTATION: {
        MIN_SIZE: 10,
        DEFAULT_STROKE_WIDTH: 2,
        SELECTED_STROKE_WIDTH: 3,
        HANDLE_SIZE: 8,
        COLORS: [
            '#ef4444', // red
            '#f97316', // orange
            '#eab308', // yellow
            '#22c55e', // green
            '#06b6d4', // cyan
            '#3b82f6', // blue
            '#8b5cf6', // violet
            '#ec4899', // pink
            '#6b7280', // gray
            '#1f2937'  // dark gray
        ],
        FIELD_TYPES: [
            { id: 'text', label: 'Text', icon: '📝', color: '#3b82f6' },
            { id: 'number', label: 'Number', icon: '🔢', color: '#22c55e' },
            { id: 'date', label: 'Date', icon: '📅', color: '#f97316' },
            { id: 'email', label: 'Email', icon: '📧', color: '#8b5cf6' },
            { id: 'phone', label: 'Phone', icon: '📞', color: '#ec4899' },
            { id: 'address', label: 'Address', icon: '🏠', color: '#06b6d4' },
            { id: 'name', label: 'Name', icon: '👤', color: '#ef4444' },
            { id: 'signature', label: 'Signature', icon: '✍️', color: '#6b7280' },
            { id: 'checkbox', label: 'Checkbox', icon: '☑️', color: '#1f2937' },
            { id: 'table', label: 'Table', icon: '📊', color: '#eab308' }
        ]
    },
    
    // UI Configuration
    UI: {
        TOAST_DURATION: 5000,
        AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        DEBOUNCE_DELAY: 300,
        ANIMATION_DURATION: 200,
        SIDEBAR_WIDTH: 300,
        TOOLBAR_WIDTH: 280
    },
    
    // Performance Configuration
    PERFORMANCE: {
        RENDER_THROTTLE: 16, // ~60fps
        SCROLL_THROTTLE: 100,
        RESIZE_THROTTLE: 250,
        BATCH_SIZE: 50,
        VIRTUAL_SCROLL_THRESHOLD: 100
    },
    
    // Debug Configuration
    DEBUG: window.location.hostname === 'localhost' || 
           window.location.search.includes('debug=true'),
    
    // Feature Flags
    FEATURES: {
        AUTO_SAVE: true,
        KEYBOARD_SHORTCUTS: true,
        CONTEXT_MENU: true,
        DRAG_AND_DROP: true,
        MULTI_SELECT: true,
        UNDO_REDO: true,
        LAYERS: true,
        GRID_SNAP: true,
        ZOOM_TO_FIT: true,
        EXPORT_ANNOTATIONS: true
    },
    
    // Keyboard Shortcuts
    SHORTCUTS: {
        SAVE: 'Ctrl+S',
        UNDO: 'Ctrl+Z',
        REDO: 'Ctrl+Y',
        DELETE: 'Delete',
        SELECT_ALL: 'Ctrl+A',
        ZOOM_IN: 'Ctrl+=',
        ZOOM_OUT: 'Ctrl+-',
        FIT_TO_SCREEN: 'Ctrl+0',
        TOGGLE_GRID: 'Ctrl+G',
        ESCAPE: 'Escape'
    },
    
    // Error Messages
    ERRORS: {
        NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
        FILE_TOO_LARGE: 'File size exceeds the maximum limit of 10MB.',
        INVALID_FILE_TYPE: 'Invalid file type. Please upload PNG, JPG, JPEG, GIF, TIFF, BMP, or PDF files.',
        UPLOAD_FAILED: 'File upload failed. Please try again.',
        SAVE_FAILED: 'Failed to save annotations. Please try again.',
        LOAD_FAILED: 'Failed to load data. Please refresh the page.',
        ANNOTATION_ERROR: 'Error creating annotation. Please try again.',
        TRAINING_ERROR: 'Model training failed. Please check your data and try again.',
        INFERENCE_ERROR: 'Data extraction failed. Please try again.'
    },
    
    // Success Messages
    SUCCESS: {
        FILE_UPLOADED: 'File uploaded successfully!',
        ANNOTATIONS_SAVED: 'Annotations saved successfully!',
        CATEGORY_CREATED: 'Category created successfully!',
        TRAINING_STARTED: 'Model training started successfully!',
        INFERENCE_COMPLETED: 'Data extraction completed successfully!'
    },
    
    // API Endpoints
    ENDPOINTS: {
        // Health and status
        HEALTH: '/health',
        
        // Categories
        CATEGORIES: '/categories',
        CREATE_CATEGORY: '/create-category',
        
        // Documents
        UPLOAD_TRAINING: '/upload-training',
        DOCUMENTS: '/documents',
        DOCUMENT_BY_ID: '/document',
        DOCUMENTS_BY_CATEGORY: '/documents',
        
        // Annotations
        SAVE_ANNOTATIONS: '/save-annotations',
        
        // Training
        TRAIN_MODEL: '/train-model',
        MODEL_STATUS: '/model-status',
        MODEL_FIELDS: '/model-fields',
        
        // Inference
        INFERENCE: '/infer',
        INFERENCE_DOCUMENTS: '/documents/inference',
        
        // Files
        UPLOADS: '/uploads'
    }
};

// Utility functions for configuration
CONFIG.getImageUrl = function(filename) {
    if (!filename) return null;
    return `${this.UPLOADS_BASE_URL}/${filename}`;
};

CONFIG.getImageUrls = function(filename) {
    if (!filename) return [];
    return [
        `${this.UPLOADS_BASE_URL}/${filename}`,
        `${this.API_BASE_URL}/uploads/${filename}`,
        `/uploads/${filename}`,
        `/api/uploads/${filename}`
    ];
};

CONFIG.isValidFileType = function(file) {
    return this.ALLOWED_FILE_TYPES.includes(file.type) ||
           this.ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
};

CONFIG.isValidFileSize = function(file) {
    return file.size <= this.MAX_FILE_SIZE;
};

CONFIG.getFieldTypeById = function(id) {
    return this.ANNOTATION.FIELD_TYPES.find(type => type.id === id);
};

CONFIG.getRandomColor = function() {
    const colors = this.ANNOTATION.COLORS;
    return colors[Math.floor(Math.random() * colors.length)];
};

CONFIG.log = function(...args) {
    if (this.DEBUG) {
        console.log('[OCR App]', ...args);
    }
};

CONFIG.warn = function(...args) {
    if (this.DEBUG) {
        console.warn('[OCR App]', ...args);
    }
};

CONFIG.error = function(...args) {
    console.error('[OCR App]', ...args);
};

// Environment detection
CONFIG.isMobile = function() {
    return window.innerWidth <= 767;
};

CONFIG.isTablet = function() {
    return window.innerWidth > 767 && window.innerWidth <= 1199;
};

CONFIG.isDesktop = function() {
    return window.innerWidth >= 1200;
};

CONFIG.isTouchDevice = function() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Browser capability detection
CONFIG.supportsWebGL = function() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && canvas.getContext('webgl'));
    } catch (e) {
        return false;
    }
};

CONFIG.supportsFileAPI = function() {
    return window.File && window.FileReader && window.FileList && window.Blob;
};

CONFIG.supportsCanvas = function() {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}

// Log configuration on load
CONFIG.log('Configuration loaded:', {
    API_BASE_URL: CONFIG.API_BASE_URL,
    UPLOADS_BASE_URL: CONFIG.UPLOADS_BASE_URL,
    DEBUG: CONFIG.DEBUG,
    isMobile: CONFIG.isMobile(),
    isTablet: CONFIG.isTablet(),
    isDesktop: CONFIG.isDesktop(),
    isTouchDevice: CONFIG.isTouchDevice(),
    supportsCanvas: CONFIG.supportsCanvas(),
    supportsFileAPI: CONFIG.supportsFileAPI(),
    supportsWebGL: CONFIG.supportsWebGL()
});
