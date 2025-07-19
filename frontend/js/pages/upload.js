/**
 * Upload Page Manager
 * Handles document upload and category management
 */

export class UploadPageManager {
    constructor(app) {
        this.app = app;
        this.selectedCategory = null;
        this.uploadedFiles = [];
        this.isUploading = false;
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.addEventListeners();
        this.loadCategories();
        CONFIG.log('Upload page manager initialized');
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            uploadArea: document.getElementById('upload-area'),
            fileInput: document.getElementById('file-input'),
            categorySelector: document.querySelector('.category-selector'),
            documentCategory: document.getElementById('document-category'),
            categoriesList: document.getElementById('categories-list'),
            documentsList: document.getElementById('documents-list'),
            createCategoryBtn: document.getElementById('create-category-btn'),
            trainModelBtn: document.getElementById('train-model-btn'),
            categoryModal: document.getElementById('category-modal'),
            categoryForm: document.getElementById('category-form'),
            categoryName: document.getElementById('category-name'),
            categoryType: document.getElementById('category-type'),
            createCategory: document.getElementById('create-category'),
            cancelCategory: document.getElementById('cancel-category')
        };
    }

    /**
     * Add event listeners
     */
    addEventListeners() {
        // Upload area events
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.elements.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.elements.uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        // File input change
        this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Category selection
        this.elements.documentCategory.addEventListener('change', this.handleCategorySelect.bind(this));

        // Create category button
        this.elements.createCategoryBtn.addEventListener('click', () => {
            modal.show('category-modal');
        });

        // Category form
        this.elements.createCategory.addEventListener('click', this.handleCreateCategory.bind(this));
        this.elements.cancelCategory.addEventListener('click', () => {
            modal.hide('category-modal');
        });

        // Train model button
        this.elements.trainModelBtn.addEventListener('click', this.handleTrainModel.bind(this));

        // Modal form submission
        document.addEventListener('modalFormSubmit', this.handleModalFormSubmit.bind(this));
    }

    /**
     * Handle drag over
     */
    handleDragOver(e) {
        e.preventDefault();
        this.elements.uploadArea.classList.add('dragover');
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(e) {
        e.preventDefault();
        this.elements.uploadArea.classList.remove('dragover');
    }

    /**
     * Handle drop
     */
    handleDrop(e) {
        e.preventDefault();
        this.elements.uploadArea.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    /**
     * Handle file select
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    /**
     * Process selected files
     */
    processFiles(files) {
        // Validate files
        const validFiles = files.filter(file => {
            if (!CONFIG.isValidFileType(file)) {
                toast.error(`Invalid file type: ${file.name}`);
                return false;
            }
            if (!CONFIG.isValidFileSize(file)) {
                toast.error(`File too large: ${file.name} (${Utils.formatFileSize(file.size)})`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        // Show category selector if hidden
        this.elements.categorySelector.style.display = 'block';

        // Store files for upload
        this.uploadedFiles = validFiles;
        
        toast.info(`${validFiles.length} file(s) selected. Choose a category to upload.`);
    }

    /**
     * Handle category selection
     */
    handleCategorySelect(e) {
        this.selectedCategory = e.target.value;
        
        if (this.selectedCategory && this.uploadedFiles.length > 0) {
            this.uploadFiles();
        }
        
        // Load documents for selected category
        if (this.selectedCategory) {
            this.loadDocuments(this.selectedCategory);
        }
    }

    /**
     * Upload files to server
     */
    async uploadFiles() {
        if (!this.selectedCategory || this.uploadedFiles.length === 0) return;

        this.isUploading = true;
        const progressToastId = toast.progress('Uploading files...', 0);

        try {
            let uploadedCount = 0;
            const totalFiles = this.uploadedFiles.length;

            for (const file of this.uploadedFiles) {
                try {
                    await api.uploadFile(
                        CONFIG.ENDPOINTS.UPLOAD_TRAINING,
                        file,
                        { category_id: this.selectedCategory },
                        (progress) => {
                            const overallProgress = ((uploadedCount / totalFiles) * 100) + (progress / totalFiles);
                            toast.updateProgress(progressToastId, overallProgress, 
                                `Uploading ${file.name}... (${uploadedCount + 1}/${totalFiles})`);
                        }
                    );
                    uploadedCount++;
                } catch (error) {
                    CONFIG.error('Failed to upload file:', file.name, error);
                    toast.error(`Failed to upload ${file.name}`);
                }
            }

            toast.updateProgress(progressToastId, 100, 'Upload complete!');
            
            if (uploadedCount > 0) {
                toast.success(`Successfully uploaded ${uploadedCount} file(s)`);
                
                // Reload documents
                await this.loadDocuments(this.selectedCategory);
                
                // Clear file input
                this.elements.fileInput.value = '';
                this.uploadedFiles = [];
                this.elements.categorySelector.style.display = 'none';
            }

        } catch (error) {
            CONFIG.error('Upload failed:', error);
            toast.error('Upload failed. Please try again.');
        } finally {
            this.isUploading = false;
        }
    }

    /**
     * Load categories
     */
    async loadCategories() {
        try {
            const response = await api.get(CONFIG.ENDPOINTS.CATEGORIES);
            const categories = response.categories || [];
            
            this.app.setState({ categories });
            this.renderCategories(categories);
            this.updateCategorySelector(categories);
            
        } catch (error) {
            CONFIG.error('Failed to load categories:', error);
            toast.error('Failed to load categories');
        }
    }

    /**
     * Render categories list
     */
    renderCategories(categories) {
        if (!this.elements.categoriesList) return;

        if (categories.length === 0) {
            this.elements.categoriesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📁</div>
                    <div class="empty-state-text">No categories yet</div>
                    <div class="empty-state-subtext">Create a category to get started</div>
                </div>
            `;
            return;
        }

        this.elements.categoriesList.innerHTML = categories.map(category => `
            <div class="category-item" data-category-id="${category.id}">
                <div class="category-info">
                    <div class="category-name">${Utils.sanitizeHtml(category.name)}</div>
                    <div class="category-meta">
                        ${category.model_type} • Created ${Utils.formatDate(category.created_at)}
                    </div>
                </div>
                <div class="category-actions">
                    <span class="category-status ${this.getCategoryStatus(category)}">${this.getCategoryStatusText(category)}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        this.elements.categoriesList.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                const categoryId = item.getAttribute('data-category-id');
                this.selectCategory(categoryId);
            });
        });
    }

    /**
     * Update category selector dropdown
     */
    updateCategorySelector(categories) {
        if (!this.elements.documentCategory) return;

        this.elements.documentCategory.innerHTML = `
            <option value="">Choose a category...</option>
            ${categories.map(category => 
                `<option value="${category.id}">${Utils.sanitizeHtml(category.name)}</option>`
            ).join('')}
        `;
    }

    /**
     * Get category status
     */
    getCategoryStatus(category) {
        if (category.model_id && category.is_trained) return 'ready';
        if (category.model_id) return 'training';
        return 'pending';
    }

    /**
     * Get category status text
     */
    getCategoryStatusText(category) {
        const status = this.getCategoryStatus(category);
        const statusTexts = {
            ready: 'Ready',
            training: 'Training',
            pending: 'Pending'
        };
        return statusTexts[status] || 'Unknown';
    }

    /**
     * Select category
     */
    selectCategory(categoryId) {
        // Update UI
        this.elements.categoriesList.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = this.elements.categoriesList.querySelector(`[data-category-id="${categoryId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        this.selectedCategory = categoryId;
        this.elements.documentCategory.value = categoryId;
        
        // Load documents
        this.loadDocuments(categoryId);
    }

    /**
     * Load documents for category
     */
    async loadDocuments(categoryId) {
        if (!categoryId) return;

        try {
            const response = await api.get(`${CONFIG.ENDPOINTS.DOCUMENTS_BY_CATEGORY}/${categoryId}`);
            const documents = response.documents || [];
            
            this.renderDocuments(documents);
            this.updateTrainButton(documents);
            
        } catch (error) {
            CONFIG.error('Failed to load documents:', error);
            toast.error('Failed to load documents');
        }
    }

    /**
     * Render documents list
     */
    renderDocuments(documents) {
        if (!this.elements.documentsList) return;

        if (documents.length === 0) {
            this.elements.documentsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <div class="empty-state-text">No documents uploaded</div>
                    <div class="empty-state-subtext">Upload documents to start training</div>
                </div>
            `;
            return;
        }

        this.elements.documentsList.innerHTML = documents.map(doc => `
            <div class="document-card" data-document-id="${doc.id}">
                <div class="document-preview">
                    <img src="${CONFIG.getImageUrl(doc.filename)}" alt="${Utils.sanitizeHtml(doc.original_filename)}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="preview-placeholder" style="display: none;">📄</div>
                </div>
                <div class="document-info">
                    <div class="document-name" title="${Utils.sanitizeHtml(doc.original_filename)}">
                        ${Utils.sanitizeHtml(doc.original_filename)}
                    </div>
                    <div class="document-meta">
                        <span>${Utils.formatDate(doc.created_at)}</span>
                        ${doc.annotations && doc.annotations.length > 0 ? 
                            `<span class="annotation-count">${doc.annotations.length} annotations</span>` : 
                            '<span>No annotations</span>'
                        }
                    </div>
                    <div class="document-actions">
                        <button class="btn btn-sm btn-primary" onclick="app.navigateToAnnotation(${doc.id})">
                            ✏️ Annotate
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Update train button state
     */
    updateTrainButton(documents) {
        if (!this.elements.trainModelBtn) return;

        const annotatedDocs = documents.filter(doc => doc.annotations && doc.annotations.length > 0);
        const canTrain = annotatedDocs.length >= 2; // Minimum documents for training

        this.elements.trainModelBtn.disabled = !canTrain;
        this.elements.trainModelBtn.title = canTrain ? 
            'Start model training' : 
            `Need at least 2 annotated documents (have ${annotatedDocs.length})`;
    }

    /**
     * Handle create category
     */
    async handleCreateCategory() {
        const name = this.elements.categoryName.value.trim();
        const type = this.elements.categoryType.value;

        if (!name) {
            toast.error('Please enter a category name');
            return;
        }

        try {
            const response = await api.post(CONFIG.ENDPOINTS.CREATE_CATEGORY, {
                name,
                model_type: type
            });

            toast.success('Category created successfully');
            modal.hide('category-modal');
            
            // Reset form
            this.elements.categoryForm.reset();
            
            // Reload categories
            await this.loadCategories();
            
        } catch (error) {
            CONFIG.error('Failed to create category:', error);
            toast.error(error.message || 'Failed to create category');
        }
    }

    /**
     * Handle train model
     */
    async handleTrainModel() {
        if (!this.selectedCategory) {
            toast.error('Please select a category first');
            return;
        }

        const confirmed = await new Promise(resolve => {
            modal.confirm(
                'Start model training? This process may take several minutes.',
                () => resolve(true),
                () => resolve(false)
            );
        });

        if (!confirmed) return;

        try {
            const response = await api.post(`${CONFIG.ENDPOINTS.TRAIN_MODEL}/${this.selectedCategory}`);
            toast.success('Model training started successfully');
            
            // Reload categories to update status
            await this.loadCategories();
            
        } catch (error) {
            CONFIG.error('Failed to start training:', error);
            toast.error(error.message || 'Failed to start model training');
        }
    }

    /**
     * Handle modal form submission
     */
    handleModalFormSubmit(e) {
        if (e.detail.modalId === 'category-modal') {
            e.preventDefault();
            this.handleCreateCategory();
        }
    }

    /**
     * Navigate to annotation page
     */
    navigateToAnnotation(documentId) {
        this.app.setState({ currentDocument: documentId });
        this.app.navigateToPage('annotate');
    }

    /**
     * Page lifecycle methods
     */
    onPageShow() {
        this.loadCategories();
    }

    onPageHide() {
        // Clean up if needed
    }

    onResize() {
        // Handle resize if needed
    }

    hasUnsavedChanges() {
        return this.isUploading;
    }

    async save() {
        // No explicit save needed for upload page
        return Promise.resolve();
    }
}

// Make navigateToAnnotation globally available
window.app = window.app || {};
window.app.navigateToAnnotation = function(documentId) {
    const uploadManager = window.app.getPageManager('upload');
    if (uploadManager) {
        uploadManager.navigateToAnnotation(documentId);
    }
};
