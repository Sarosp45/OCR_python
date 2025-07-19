/**
 * Annotation Page Manager
 * Handles document annotation interface
 */

export class AnnotatePageManager {
    constructor(app) {
        this.app = app;
        this.annotationEngine = null;
        this.currentDocument = null;
        this.hasUnsavedAnnotations = false;
        this.autoSaveTimer = null;
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.addEventListeners();
        CONFIG.log('Annotation page manager initialized');
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            canvas: document.getElementById('annotation-canvas'),
            toolbar: document.querySelector('.annotation-toolbar'),
            sidebar: document.querySelector('.annotation-sidebar'),
            documentName: document.getElementById('current-document-name'),
            saveStatus: document.getElementById('save-status'),
            saveButton: document.getElementById('save-annotations'),
            backButton: document.getElementById('back-to-upload'),
            annotationsList: document.getElementById('annotations-list'),
            propertiesPanel: document.getElementById('properties-panel'),
            fieldModal: document.getElementById('field-modal'),
            fieldTypes: document.getElementById('field-types')
        };
    }

    /**
     * Add event listeners
     */
    addEventListeners() {
        // Back button
        this.elements.backButton.addEventListener('click', () => {
            this.handleBackNavigation();
        });

        // Save button
        this.elements.saveButton.addEventListener('click', () => {
            this.saveAnnotations();
        });

        // Tool buttons
        this.elements.toolbar.addEventListener('click', (e) => {
            const toolBtn = e.target.closest('.tool-btn');
            if (toolBtn) {
                this.handleToolClick(toolBtn);
            }
        });

        // Annotations list
        this.elements.annotationsList.addEventListener('click', (e) => {
            this.handleAnnotationListClick(e);
        });

        // Field selection
        if (this.elements.fieldTypes) {
            this.elements.fieldTypes.addEventListener('click', (e) => {
                const fieldType = e.target.closest('.field-type');
                if (fieldType) {
                    this.handleFieldTypeSelect(fieldType);
                }
            });
        }
    }

    /**
     * Initialize annotation engine
     */
    initializeAnnotationEngine() {
        if (this.annotationEngine) {
            this.annotationEngine.destroy();
        }

        this.annotationEngine = new AnnotationEngine(this.elements.canvas, {
            enableHistory: true,
            enableAutoSave: false // We handle auto-save manually
        });

        // Add event listeners
        this.annotationEngine.on('annotationCompleted', this.handleAnnotationCompleted.bind(this));
        this.annotationEngine.on('annotationCreated', this.handleAnnotationCreated.bind(this));
        this.annotationEngine.on('annotationUpdated', this.handleAnnotationUpdated.bind(this));
        this.annotationEngine.on('annotationDeleted', this.handleAnnotationDeleted.bind(this));
        this.annotationEngine.on('selectionChanged', this.handleSelectionChanged.bind(this));
        this.annotationEngine.on('historyChanged', this.handleHistoryChanged.bind(this));
    }

    /**
     * Load document for annotation
     */
    async loadDocument(documentId) {
        try {
            // Show loading
            this.showLoading('Loading document...');

            // Fetch document data
            const response = await api.get(`${CONFIG.ENDPOINTS.DOCUMENT_BY_ID}/${documentId}`);
            this.currentDocument = response;

            // Update UI
            this.elements.documentName.textContent = this.currentDocument.original_filename;

            // Initialize annotation engine if not already done
            if (!this.annotationEngine) {
                this.initializeAnnotationEngine();
            }

            // Load image
            const imageUrl = CONFIG.getImageUrl(this.currentDocument.filename);
            await this.annotationEngine.loadImage(imageUrl);

            // Load existing annotations
            if (this.currentDocument.annotations && this.currentDocument.annotations.length > 0) {
                this.annotationEngine.loadAnnotations(this.currentDocument.annotations);
            }

            // Update annotations list
            this.updateAnnotationsList();

            // Setup auto-save
            this.setupAutoSave();

            this.hideLoading();
            CONFIG.log('Document loaded for annotation:', documentId);

        } catch (error) {
            this.hideLoading();
            CONFIG.error('Failed to load document:', error);
            toast.error('Failed to load document for annotation');
        }
    }

    /**
     * Handle tool click
     */
    handleToolClick(toolBtn) {
        const tool = toolBtn.getAttribute('data-tool');
        
        // Update active tool
        this.elements.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        toolBtn.classList.add('active');

        // Handle special tools
        switch (tool) {
            case 'zoom-in':
                this.annotationEngine.zoom(CONFIG.CANVAS.ZOOM_STEP);
                break;
            case 'zoom-out':
                this.annotationEngine.zoom(-CONFIG.CANVAS.ZOOM_STEP);
                break;
            case 'fit':
                this.annotationEngine.fitToCanvas();
                break;
            case 'undo':
                this.annotationEngine.undo();
                break;
            case 'redo':
                this.annotationEngine.redo();
                break;
            case 'delete':
                this.annotationEngine.deleteSelectedAnnotations();
                break;
            default:
                this.annotationEngine.setTool(tool);
                break;
        }
    }

    /**
     * Handle annotation completed
     */
    handleAnnotationCompleted(annotation) {
        this.showFieldSelectionModal(annotation);
    }

    /**
     * Show field selection modal
     */
    showFieldSelectionModal(annotation) {
        this.pendingAnnotation = annotation;
        
        // Populate field types
        this.renderFieldTypes();
        
        // Show modal
        modal.show('field-modal');
    }

    /**
     * Render field types
     */
    renderFieldTypes() {
        if (!this.elements.fieldTypes) return;

        this.elements.fieldTypes.innerHTML = CONFIG.ANNOTATION.FIELD_TYPES.map(fieldType => `
            <div class="field-type" data-field-id="${fieldType.id}">
                <div class="field-type-icon">${fieldType.icon}</div>
                <div class="field-type-name">${fieldType.label}</div>
            </div>
        `).join('');
    }

    /**
     * Handle field type selection
     */
    handleFieldTypeSelect(fieldTypeElement) {
        const fieldId = fieldTypeElement.getAttribute('data-field-id');
        const fieldConfig = CONFIG.getFieldTypeById(fieldId);
        
        if (!fieldConfig || !this.pendingAnnotation) return;

        // Update annotation with field information
        this.annotationEngine.updateAnnotation(this.pendingAnnotation.id, {
            field_name: fieldConfig.label,
            color: fieldConfig.color
        });

        // Close modal
        modal.hide('field-modal');
        this.pendingAnnotation = null;

        // Update UI
        this.updateAnnotationsList();
        this.markAsUnsaved();
    }

    /**
     * Handle annotation created
     */
    handleAnnotationCreated(annotation) {
        this.updateAnnotationsList();
        this.markAsUnsaved();
    }

    /**
     * Handle annotation updated
     */
    handleAnnotationUpdated(annotation) {
        this.updateAnnotationsList();
        this.updatePropertiesPanel();
        this.markAsUnsaved();
    }

    /**
     * Handle annotation deleted
     */
    handleAnnotationDeleted(annotation) {
        this.updateAnnotationsList();
        this.updatePropertiesPanel();
        this.markAsUnsaved();
    }

    /**
     * Handle selection changed
     */
    handleSelectionChanged(selectedIds) {
        this.updateAnnotationsList();
        this.updatePropertiesPanel();
    }

    /**
     * Handle history changed
     */
    handleHistoryChanged(historyState) {
        // Update undo/redo button states
        const undoBtn = this.elements.toolbar.querySelector('[data-tool="undo"]');
        const redoBtn = this.elements.toolbar.querySelector('[data-tool="redo"]');
        
        if (undoBtn) undoBtn.disabled = !historyState.canUndo;
        if (redoBtn) redoBtn.disabled = !historyState.canRedo;
    }

    /**
     * Update annotations list
     */
    updateAnnotationsList() {
        if (!this.annotationEngine || !this.elements.annotationsList) return;

        const annotations = this.annotationEngine.getAnnotations();
        const selectedIds = new Set(this.annotationEngine.getSelectedAnnotations().map(a => a.id));

        if (annotations.length === 0) {
            this.elements.annotationsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">No annotations</div>
                    <div class="empty-state-subtext">Use tools to create annotations</div>
                </div>
            `;
            return;
        }

        this.elements.annotationsList.innerHTML = annotations.map(annotation => `
            <div class="annotation-item ${selectedIds.has(annotation.id) ? 'selected' : ''}" 
                 data-annotation-id="${annotation.id}">
                <div class="annotation-color" style="background-color: ${annotation.color}"></div>
                <div class="annotation-info">
                    <div class="annotation-label">${annotation.field_name || 'Unlabeled'}</div>
                    <div class="annotation-coords">
                        ${Math.round(annotation.x)}, ${Math.round(annotation.y)} 
                        (${Math.round(annotation.w)} × ${Math.round(annotation.h)})
                    </div>
                </div>
                <div class="annotation-actions">
                    <button class="annotation-action" data-action="edit" title="Edit">✏️</button>
                    <button class="annotation-action delete" data-action="delete" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Handle annotation list click
     */
    handleAnnotationListClick(e) {
        const annotationItem = e.target.closest('.annotation-item');
        if (!annotationItem) return;

        const annotationId = annotationItem.getAttribute('data-annotation-id');
        const action = e.target.getAttribute('data-action');

        switch (action) {
            case 'delete':
                this.annotationEngine.deleteAnnotation(annotationId);
                break;
            case 'edit':
                // TODO: Implement edit functionality
                break;
            default:
                // Select annotation
                this.annotationEngine.selectAnnotation(annotationId, e.ctrlKey || e.metaKey);
                break;
        }
    }

    /**
     * Update properties panel
     */
    updatePropertiesPanel() {
        if (!this.elements.propertiesPanel) return;

        const selectedAnnotations = this.annotationEngine.getSelectedAnnotations();

        if (selectedAnnotations.length === 0) {
            this.elements.propertiesPanel.innerHTML = `
                <p class="no-selection">Select an annotation to edit properties</p>
            `;
            return;
        }

        if (selectedAnnotations.length === 1) {
            const annotation = selectedAnnotations[0];
            this.elements.propertiesPanel.innerHTML = `
                <div class="property-group">
                    <h5>Annotation Properties</h5>
                    <div class="property-row">
                        <span class="property-label">Type:</span>
                        <span class="property-value">${annotation.type}</span>
                    </div>
                    <div class="property-row">
                        <span class="property-label">Field:</span>
                        <span class="property-value">${annotation.field_name || 'None'}</span>
                    </div>
                </div>
                <div class="property-group">
                    <h5>Position & Size</h5>
                    <div class="property-row">
                        <span class="property-label">X:</span>
                        <input type="number" class="property-input" value="${Math.round(annotation.x)}" data-property="x">
                    </div>
                    <div class="property-row">
                        <span class="property-label">Y:</span>
                        <input type="number" class="property-input" value="${Math.round(annotation.y)}" data-property="y">
                    </div>
                    <div class="property-row">
                        <span class="property-label">Width:</span>
                        <input type="number" class="property-input" value="${Math.round(annotation.w)}" data-property="w">
                    </div>
                    <div class="property-row">
                        <span class="property-label">Height:</span>
                        <input type="number" class="property-input" value="${Math.round(annotation.h)}" data-property="h">
                    </div>
                </div>
            `;

            // Add property input listeners
            this.elements.propertiesPanel.querySelectorAll('.property-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const property = e.target.getAttribute('data-property');
                    const value = parseFloat(e.target.value);
                    this.annotationEngine.updateAnnotation(annotation.id, { [property]: value });
                });
            });
        } else {
            this.elements.propertiesPanel.innerHTML = `
                <div class="property-group">
                    <h5>Multiple Selection</h5>
                    <p>${selectedAnnotations.length} annotations selected</p>
                </div>
            `;
        }
    }

    /**
     * Save annotations
     */
    async saveAnnotations() {
        if (!this.currentDocument || !this.annotationEngine) return;

        try {
            this.showSaving();
            
            const annotations = this.annotationEngine.getAnnotations().map(annotation => ({
                field_name: annotation.field_name || '',
                x: annotation.x,
                y: annotation.y,
                w: annotation.w,
                h: annotation.h,
                type: annotation.type
            }));

            await api.post(CONFIG.ENDPOINTS.SAVE_ANNOTATIONS, {
                document_id: this.currentDocument.id,
                annotations
            });

            this.markAsSaved();
            toast.success('Annotations saved successfully');

        } catch (error) {
            CONFIG.error('Failed to save annotations:', error);
            toast.error('Failed to save annotations');
            this.showSaveError();
        }
    }

    /**
     * Setup auto-save
     */
    setupAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            if (this.hasUnsavedAnnotations) {
                this.saveAnnotations();
            }
        }, CONFIG.UI.AUTO_SAVE_INTERVAL);
    }

    /**
     * Mark as unsaved
     */
    markAsUnsaved() {
        this.hasUnsavedAnnotations = true;
        this.updateSaveStatus('unsaved');
    }

    /**
     * Mark as saved
     */
    markAsSaved() {
        this.hasUnsavedAnnotations = false;
        this.updateSaveStatus('saved');
    }

    /**
     * Show saving status
     */
    showSaving() {
        this.updateSaveStatus('saving');
    }

    /**
     * Show save error
     */
    showSaveError() {
        this.updateSaveStatus('error');
    }

    /**
     * Update save status UI
     */
    updateSaveStatus(status) {
        if (!this.elements.saveStatus) return;

        const indicator = this.elements.saveStatus.querySelector('.save-indicator');
        const text = this.elements.saveStatus.querySelector('.save-text');

        if (indicator) {
            indicator.className = `save-indicator ${status}`;
        }

        if (text) {
            const statusTexts = {
                saved: 'Saved',
                unsaved: 'Unsaved changes',
                saving: 'Saving...',
                error: 'Save failed'
            };
            text.textContent = statusTexts[status] || 'Unknown';
        }
    }

    /**
     * Handle back navigation
     */
    async handleBackNavigation() {
        if (this.hasUnsavedAnnotations) {
            const confirmed = await new Promise(resolve => {
                modal.confirm(
                    'You have unsaved changes. Do you want to save before leaving?',
                    async () => {
                        await this.saveAnnotations();
                        resolve(true);
                    },
                    () => resolve(true),
                    {
                        buttons: [
                            { text: 'Don\'t Save', action: 'discard', class: 'btn-secondary', callback: () => true },
                            { text: 'Cancel', action: 'cancel', class: 'btn-secondary', callback: () => false },
                            { text: 'Save', action: 'save', class: 'btn-primary', callback: async () => {
                                await this.saveAnnotations();
                                return true;
                            }}
                        ]
                    }
                );
            });

            if (!confirmed) return;
        }

        this.app.navigateToPage('upload');
    }

    /**
     * Show loading
     */
    showLoading(message = 'Loading...') {
        // Implementation depends on your loading UI
    }

    /**
     * Hide loading
     */
    hideLoading() {
        // Implementation depends on your loading UI
    }

    /**
     * Page lifecycle methods
     */
    onPageShow() {
        const currentDocumentId = this.app.getState().currentDocument;
        if (currentDocumentId && currentDocumentId !== this.currentDocument?.id) {
            this.loadDocument(currentDocumentId);
        }
    }

    onPageHide() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
    }

    onResize() {
        if (this.annotationEngine) {
            // Handle canvas resize
            this.annotationEngine.render();
        }
    }

    onEscape() {
        if (this.annotationEngine) {
            this.annotationEngine.cancelCurrentOperation();
        }
    }

    hasUnsavedChanges() {
        return this.hasUnsavedAnnotations;
    }

    async save() {
        return this.saveAnnotations();
    }
}
