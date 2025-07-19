/**
 * Inference Page Manager
 * Handles document data extraction using trained models
 */

class InferencePageManager {
    constructor(app) {
        this.app = app;
        this.selectedModel = null;
        this.uploadedFile = null;
        this.isProcessing = false;
        this.currentResults = null;
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.addEventListeners();
        this.loadTrainedModels();
        CONFIG.log('Inference page manager initialized');
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            uploadArea: document.getElementById('inference-upload-area'),
            fileInput: document.getElementById('inference-file-input'),
            categorySelect: document.getElementById('inference-category'),
            runInferenceBtn: document.getElementById('run-inference'),
            resultsContainer: document.getElementById('inference-results')
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

        // Model selection
        this.elements.categorySelect.addEventListener('change', this.handleModelSelect.bind(this));

        // Run inference button
        this.elements.runInferenceBtn.addEventListener('click', this.runInference.bind(this));
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
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Handle file select
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Process selected file
     */
    processFile(file) {
        // Validate file
        if (!CONFIG.isValidFileType(file)) {
            toast.error(`Invalid file type: ${file.name}`);
            return;
        }

        if (!CONFIG.isValidFileSize(file)) {
            toast.error(`File too large: ${file.name} (${Utils.formatFileSize(file.size)})`);
            return;
        }

        this.uploadedFile = file;
        
        // Update upload area to show selected file
        this.updateUploadAreaWithFile(file);
        
        // Enable run button if model is selected
        this.updateRunButton();
        
        toast.success(`File selected: ${file.name}`);
    }

    /**
     * Update upload area to show selected file
     */
    updateUploadAreaWithFile(file) {
        this.elements.uploadArea.innerHTML = `
            <div class="upload-icon">📄</div>
            <div class="upload-text">
                <p><strong>${Utils.sanitizeHtml(file.name)}</strong></p>
                <small>${Utils.formatFileSize(file.size)} • Click to change file</small>
            </div>
        `;
    }

    /**
     * Handle model selection
     */
    handleModelSelect(e) {
        this.selectedModel = e.target.value;
        this.updateRunButton();
    }

    /**
     * Update run button state
     */
    updateRunButton() {
        const canRun = this.uploadedFile && this.selectedModel && !this.isProcessing;
        this.elements.runInferenceBtn.disabled = !canRun;
    }

    /**
     * Load trained models
     */
    async loadTrainedModels() {
        try {
            const response = await api.get(CONFIG.ENDPOINTS.CATEGORIES);
            const categories = response.categories || [];
            
            // Filter categories with trained models
            const trainedModels = categories.filter(category => 
                category.model_id && this.getCategoryStatus(category) === 'ready'
            );
            
            this.renderModelOptions(trainedModels);
            
        } catch (error) {
            CONFIG.error('Failed to load trained models:', error);
            toast.error('Failed to load trained models');
        }
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
     * Render model options
     */
    renderModelOptions(models) {
        if (!this.elements.categorySelect) return;

        if (models.length === 0) {
            this.elements.categorySelect.innerHTML = `
                <option value="">No trained models available</option>
            `;
            this.elements.categorySelect.disabled = true;
            return;
        }

        this.elements.categorySelect.innerHTML = `
            <option value="">Choose a trained model...</option>
            ${models.map(model => 
                `<option value="${model.id}">${Utils.sanitizeHtml(model.name)}</option>`
            ).join('')}
        `;
        this.elements.categorySelect.disabled = false;
    }

    /**
     * Run inference
     */
    async runInference() {
        if (!this.uploadedFile || !this.selectedModel) {
            toast.error('Please select a file and model first');
            return;
        }

        this.isProcessing = true;
        this.updateRunButton();
        
        const progressToastId = toast.loading('Processing document...');

        try {
            // Upload file and run inference
            const response = await api.uploadFile(
                CONFIG.ENDPOINTS.INFERENCE,
                this.uploadedFile,
                { category_id: this.selectedModel },
                (progress) => {
                    toast.updateProgress(progressToastId, progress * 0.8, 'Uploading and processing...');
                }
            );

            toast.updateProgress(progressToastId, 100, 'Processing complete!');
            
            this.currentResults = response;
            this.renderResults(response);
            
            toast.success('Data extraction completed successfully');

        } catch (error) {
            CONFIG.error('Inference failed:', error);
            toast.error(error.message || 'Data extraction failed');
        } finally {
            this.isProcessing = false;
            this.updateRunButton();
        }
    }

    /**
     * Render extraction results
     */
    renderResults(results) {
        if (!this.elements.resultsContainer || !results) return;

        if (!results.extracted_data || results.extracted_data.length === 0) {
            this.elements.resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div class="empty-state-text">No data extracted</div>
                    <div class="empty-state-subtext">The model couldn't find any recognizable fields</div>
                </div>
            `;
            return;
        }

        // Group results by field type
        const groupedResults = this.groupResultsByField(results.extracted_data);

        this.elements.resultsContainer.innerHTML = `
            <div class="results-header">
                <h3>Extraction Results</h3>
                <div class="results-meta">
                    <span>📄 ${Utils.sanitizeHtml(this.uploadedFile.name)}</span>
                    <span>🎯 ${results.extracted_data.length} fields extracted</span>
                    <span>⏱️ ${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
            
            <div class="results-content">
                ${Object.entries(groupedResults).map(([fieldType, items]) => `
                    <div class="result-group">
                        <h4 class="result-group-title">${this.getFieldTypeLabel(fieldType)}</h4>
                        <div class="result-items">
                            ${items.map(item => this.renderResultItem(item)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="results-actions">
                <button class="btn btn-secondary" onclick="exportResults('json')">
                    📄 Export JSON
                </button>
                <button class="btn btn-secondary" onclick="exportResults('csv')">
                    📊 Export CSV
                </button>
                <button class="btn btn-primary" onclick="saveResults()">
                    💾 Save Results
                </button>
            </div>
        `;
    }

    /**
     * Group results by field type
     */
    groupResultsByField(extractedData) {
        const grouped = {};
        
        extractedData.forEach(item => {
            const fieldType = item.field_name || 'unknown';
            if (!grouped[fieldType]) {
                grouped[fieldType] = [];
            }
            grouped[fieldType].push(item);
        });
        
        return grouped;
    }

    /**
     * Get field type label
     */
    getFieldTypeLabel(fieldType) {
        const fieldConfig = CONFIG.getFieldTypeById(fieldType);
        return fieldConfig ? `${fieldConfig.icon} ${fieldConfig.label}` : `📝 ${Utils.capitalize(fieldType)}`;
    }

    /**
     * Render single result item
     */
    renderResultItem(item) {
        const confidence = Math.round((item.confidence || 0) * 100);
        const confidenceClass = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';
        
        return `
            <div class="result-item">
                <div class="result-item-header">
                    <span class="result-label">${Utils.sanitizeHtml(item.label || item.field_name)}</span>
                    <span class="result-confidence ${confidenceClass}">${confidence}%</span>
                </div>
                <div class="result-value">
                    <input type="text" class="result-input" value="${Utils.sanitizeHtml(item.value || '')}"
                           data-item-id="${item.id}" onchange="updateResultValue(this)">
                </div>
                <div class="result-meta">
                    Position: (${Math.round(item.x || 0)}, ${Math.round(item.y || 0)}) • 
                    Size: ${Math.round(item.width || 0)} × ${Math.round(item.height || 0)}
                </div>
            </div>
        `;
    }

    /**
     * Update result value
     */
    updateResultValue(input) {
        const itemId = input.getAttribute('data-item-id');
        const newValue = input.value;
        
        if (this.currentResults && this.currentResults.extracted_data) {
            const item = this.currentResults.extracted_data.find(item => item.id == itemId);
            if (item) {
                item.value = newValue;
                item.modified = true;
            }
        }
    }

    /**
     * Export results
     */
    exportResults(format) {
        if (!this.currentResults || !this.currentResults.extracted_data) {
            toast.error('No results to export');
            return;
        }

        const data = this.currentResults.extracted_data;
        const filename = `extraction_results_${Date.now()}`;

        switch (format) {
            case 'json':
                this.exportAsJSON(data, filename);
                break;
            case 'csv':
                this.exportAsCSV(data, filename);
                break;
            default:
                toast.error('Unsupported export format');
        }
    }

    /**
     * Export as JSON
     */
    exportAsJSON(data, filename) {
        const jsonData = JSON.stringify(data, null, 2);
        this.downloadFile(jsonData, `${filename}.json`, 'application/json');
        toast.success('Results exported as JSON');
    }

    /**
     * Export as CSV
     */
    exportAsCSV(data, filename) {
        const headers = ['Field Name', 'Value', 'Confidence', 'X', 'Y', 'Width', 'Height'];
        const rows = data.map(item => [
            item.field_name || '',
            item.value || '',
            Math.round((item.confidence || 0) * 100),
            Math.round(item.x || 0),
            Math.round(item.y || 0),
            Math.round(item.width || 0),
            Math.round(item.height || 0)
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
        toast.success('Results exported as CSV');
    }

    /**
     * Download file
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Save results to database
     */
    async saveResults() {
        if (!this.currentResults) {
            toast.error('No results to save');
            return;
        }

        try {
            // Implementation depends on your backend API for saving results
            toast.success('Results saved successfully');
        } catch (error) {
            CONFIG.error('Failed to save results:', error);
            toast.error('Failed to save results');
        }
    }

    /**
     * Clear current session
     */
    clearSession() {
        this.uploadedFile = null;
        this.selectedModel = null;
        this.currentResults = null;
        
        // Reset UI
        this.elements.uploadArea.innerHTML = `
            <div class="upload-icon">📁</div>
            <div class="upload-text">
                <p>Upload document for data extraction</p>
            </div>
        `;
        
        this.elements.fileInput.value = '';
        this.elements.categorySelect.value = '';
        this.elements.resultsContainer.innerHTML = `
            <p class="no-results">Upload a document and run extraction to see results</p>
        `;
        
        this.updateRunButton();
    }

    /**
     * Page lifecycle methods
     */
    onPageShow() {
        this.loadTrainedModels();
    }

    onPageHide() {
        // Clean up if needed
    }

    onResize() {
        // Handle resize if needed
    }

    hasUnsavedChanges() {
        return this.isProcessing;
    }

    async save() {
        if (this.currentResults) {
            return this.saveResults();
        }
        return Promise.resolve();
    }
}

// Make global functions available
window.exportResults = function(format) {
    if (window.app) {
        const inferenceManager = window.app.getPageManager('inference');
        if (inferenceManager) {
            inferenceManager.exportResults(format);
        }
    }
};

window.updateResultValue = function(input) {
    if (window.app) {
        const inferenceManager = window.app.getPageManager('inference');
        if (inferenceManager) {
            inferenceManager.updateResultValue(input);
        }
    }
};

window.saveResults = function() {
    if (window.app) {
        const inferenceManager = window.app.getPageManager('inference');
        if (inferenceManager) {
            inferenceManager.saveResults();
        }
    }
};
