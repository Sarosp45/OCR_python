/**
 * Results Page Manager
 * Handles viewing and managing extraction results
 */

class ResultsPageManager {
    constructor(app) {
        this.app = app;
        this.results = [];
        this.filteredResults = [];
        this.currentFilter = 'all';
        this.currentSort = 'date_desc';
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.addEventListeners();
        CONFIG.log('Results page manager initialized');
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            overviewContainer: document.getElementById('results-overview'),
            filterButtons: document.querySelectorAll('.filter-btn'),
            sortSelect: document.getElementById('sort-select'),
            searchInput: document.getElementById('search-input'),
            resultsGrid: document.getElementById('results-grid'),
            exportAllBtn: document.getElementById('export-all-btn'),
            clearAllBtn: document.getElementById('clear-all-btn')
        };
    }

    /**
     * Add event listeners
     */
    addEventListeners() {
        // Filter buttons
        this.elements.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleFilterChange(btn.getAttribute('data-filter'));
            });
        });

        // Sort select
        if (this.elements.sortSelect) {
            this.elements.sortSelect.addEventListener('change', (e) => {
                this.handleSortChange(e.target.value);
            });
        }

        // Search input
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', 
                Utils.debounce((e) => {
                    this.handleSearch(e.target.value);
                }, CONFIG.UI.DEBOUNCE_DELAY)
            );
        }

        // Export all button
        if (this.elements.exportAllBtn) {
            this.elements.exportAllBtn.addEventListener('click', () => {
                this.exportAllResults();
            });
        }

        // Clear all button
        if (this.elements.clearAllBtn) {
            this.elements.clearAllBtn.addEventListener('click', () => {
                this.clearAllResults();
            });
        }
    }

    /**
     * Load results data
     */
    async loadResults() {
        try {
            // Show loading
            this.showLoading();

            // Fetch results from API
            const response = await api.get(CONFIG.ENDPOINTS.INFERENCE_DOCUMENTS);
            this.results = response.documents || [];

            // Apply current filters and sorting
            this.applyFiltersAndSort();

            // Update UI
            this.renderOverview();
            this.renderResults();

            this.hideLoading();
            CONFIG.log('Results loaded:', this.results.length);

        } catch (error) {
            this.hideLoading();
            CONFIG.error('Failed to load results:', error);
            toast.error('Failed to load results');
        }
    }

    /**
     * Handle filter change
     */
    handleFilterChange(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        this.elements.filterButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        this.applyFiltersAndSort();
        this.renderResults();
    }

    /**
     * Handle sort change
     */
    handleSortChange(sort) {
        this.currentSort = sort;
        this.applyFiltersAndSort();
        this.renderResults();
    }

    /**
     * Handle search
     */
    handleSearch(query) {
        this.searchQuery = query.toLowerCase().trim();
        this.applyFiltersAndSort();
        this.renderResults();
    }

    /**
     * Apply filters and sorting
     */
    applyFiltersAndSort() {
        let filtered = [...this.results];

        // Apply filter
        switch (this.currentFilter) {
            case 'recent':
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                filtered = filtered.filter(result => 
                    new Date(result.created_at) > oneWeekAgo
                );
                break;
            case 'high_confidence':
                filtered = filtered.filter(result => 
                    this.getAverageConfidence(result) >= 0.8
                );
                break;
            case 'low_confidence':
                filtered = filtered.filter(result => 
                    this.getAverageConfidence(result) < 0.6
                );
                break;
            // 'all' case - no filtering
        }

        // Apply search
        if (this.searchQuery) {
            filtered = filtered.filter(result => 
                result.original_filename.toLowerCase().includes(this.searchQuery) ||
                (result.extracted_results && result.extracted_results.some(item => 
                    item.value && item.value.toLowerCase().includes(this.searchQuery)
                ))
            );
        }

        // Apply sorting
        switch (this.currentSort) {
            case 'date_desc':
                filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'date_asc':
                filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                break;
            case 'name_asc':
                filtered.sort((a, b) => a.original_filename.localeCompare(b.original_filename));
                break;
            case 'name_desc':
                filtered.sort((a, b) => b.original_filename.localeCompare(a.original_filename));
                break;
            case 'confidence_desc':
                filtered.sort((a, b) => this.getAverageConfidence(b) - this.getAverageConfidence(a));
                break;
            case 'confidence_asc':
                filtered.sort((a, b) => this.getAverageConfidence(a) - this.getAverageConfidence(b));
                break;
        }

        this.filteredResults = filtered;
    }

    /**
     * Get average confidence for a result
     */
    getAverageConfidence(result) {
        if (!result.extracted_results || result.extracted_results.length === 0) {
            return 0;
        }

        const totalConfidence = result.extracted_results.reduce((sum, item) => 
            sum + (item.confidence || 0), 0
        );
        
        return totalConfidence / result.extracted_results.length;
    }

    /**
     * Render overview statistics
     */
    renderOverview() {
        if (!this.elements.overviewContainer) return;

        const totalResults = this.results.length;
        const totalFields = this.results.reduce((sum, result) => 
            sum + (result.extracted_results ? result.extracted_results.length : 0), 0
        );
        const avgConfidence = this.results.length > 0 ? 
            this.results.reduce((sum, result) => sum + this.getAverageConfidence(result), 0) / this.results.length : 0;

        this.elements.overviewContainer.innerHTML = `
            <div class="overview-stats">
                <div class="stat-card">
                    <div class="stat-icon">📄</div>
                    <div class="stat-content">
                        <div class="stat-value">${totalResults}</div>
                        <div class="stat-label">Documents Processed</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">📝</div>
                    <div class="stat-content">
                        <div class="stat-value">${totalFields}</div>
                        <div class="stat-label">Fields Extracted</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-content">
                        <div class="stat-value">${Math.round(avgConfidence * 100)}%</div>
                        <div class="stat-label">Average Confidence</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-content">
                        <div class="stat-value">${this.filteredResults.length}</div>
                        <div class="stat-label">Filtered Results</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render results grid
     */
    renderResults() {
        if (!this.elements.resultsGrid) return;

        if (this.filteredResults.length === 0) {
            this.elements.resultsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div class="empty-state-text">No results found</div>
                    <div class="empty-state-subtext">
                        ${this.results.length === 0 ? 
                            'Run some extractions to see results here' : 
                            'Try adjusting your filters or search terms'
                        }
                    </div>
                </div>
            `;
            return;
        }

        this.elements.resultsGrid.innerHTML = this.filteredResults.map(result => 
            this.renderResultCard(result)
        ).join('');
    }

    /**
     * Render single result card
     */
    renderResultCard(result) {
        const confidence = this.getAverageConfidence(result);
        const confidenceClass = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
        const fieldsCount = result.extracted_results ? result.extracted_results.length : 0;

        return `
            <div class="result-card" data-result-id="${result.id}">
                <div class="result-card-header">
                    <div class="result-info">
                        <h3 class="result-title" title="${Utils.sanitizeHtml(result.original_filename)}">
                            ${Utils.truncate(Utils.sanitizeHtml(result.original_filename), 30)}
                        </h3>
                        <div class="result-meta">
                            <span>📅 ${Utils.formatDate(result.created_at)}</span>
                            <span>📝 ${fieldsCount} fields</span>
                            <span class="confidence ${confidenceClass}">
                                🎯 ${Math.round(confidence * 100)}%
                            </span>
                        </div>
                    </div>
                    <div class="result-actions">
                        <button class="btn btn-sm btn-secondary" onclick="viewResult(${result.id})">
                            👁️ View
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="exportResult(${result.id})">
                            📤 Export
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="deleteResult(${result.id})">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                
                <div class="result-card-body">
                    ${fieldsCount > 0 ? this.renderResultPreview(result.extracted_results) : 
                        '<p class="no-data">No data extracted</p>'
                    }
                </div>
            </div>
        `;
    }

    /**
     * Render result preview
     */
    renderResultPreview(extractedResults) {
        const previewItems = extractedResults.slice(0, 3); // Show first 3 items
        const remainingCount = extractedResults.length - previewItems.length;

        return `
            <div class="result-preview">
                ${previewItems.map(item => `
                    <div class="preview-item">
                        <span class="preview-label">${Utils.sanitizeHtml(item.field_name || 'Unknown')}:</span>
                        <span class="preview-value">${Utils.truncate(Utils.sanitizeHtml(item.value || ''), 20)}</span>
                    </div>
                `).join('')}
                ${remainingCount > 0 ? 
                    `<div class="preview-more">+${remainingCount} more fields</div>` : 
                    ''
                }
            </div>
        `;
    }

    /**
     * View result details
     */
    viewResult(resultId) {
        const result = this.results.find(r => r.id === resultId);
        if (!result) return;

        // Create detailed view modal
        const modalContent = this.createResultDetailView(result);
        
        modal.create({
            title: `Result Details: ${result.original_filename}`,
            content: modalContent,
            size: 'large',
            buttons: [
                { text: 'Export', action: 'export', class: 'btn-secondary', 
                  callback: () => { this.exportResult(resultId); return false; } },
                { text: 'Close', action: 'close', class: 'btn-primary' }
            ]
        });
    }

    /**
     * Create result detail view
     */
    createResultDetailView(result) {
        const confidence = this.getAverageConfidence(result);
        
        return `
            <div class="result-detail">
                <div class="result-detail-header">
                    <div class="detail-meta">
                        <p><strong>File:</strong> ${Utils.sanitizeHtml(result.original_filename)}</p>
                        <p><strong>Processed:</strong> ${Utils.formatDate(result.created_at)}</p>
                        <p><strong>Fields:</strong> ${result.extracted_results ? result.extracted_results.length : 0}</p>
                        <p><strong>Average Confidence:</strong> ${Math.round(confidence * 100)}%</p>
                    </div>
                </div>
                
                <div class="result-detail-body">
                    ${result.extracted_results && result.extracted_results.length > 0 ? `
                        <table class="result-table">
                            <thead>
                                <tr>
                                    <th>Field</th>
                                    <th>Value</th>
                                    <th>Confidence</th>
                                    <th>Position</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.extracted_results.map(item => `
                                    <tr>
                                        <td>${Utils.sanitizeHtml(item.field_name || 'Unknown')}</td>
                                        <td>${Utils.sanitizeHtml(item.value || '')}</td>
                                        <td>${Math.round((item.confidence || 0) * 100)}%</td>
                                        <td>(${Math.round(item.x || 0)}, ${Math.round(item.y || 0)})</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No extracted data available</p>'}
                </div>
            </div>
        `;
    }

    /**
     * Export single result
     */
    exportResult(resultId) {
        const result = this.results.find(r => r.id === resultId);
        if (!result || !result.extracted_results) {
            toast.error('No data to export');
            return;
        }

        const filename = `result_${result.id}_${Date.now()}`;
        this.exportData(result.extracted_results, filename);
        toast.success('Result exported successfully');
    }

    /**
     * Export all results
     */
    exportAllResults() {
        if (this.filteredResults.length === 0) {
            toast.error('No results to export');
            return;
        }

        const allData = this.filteredResults.reduce((acc, result) => {
            if (result.extracted_results) {
                acc.push(...result.extracted_results.map(item => ({
                    ...item,
                    document: result.original_filename,
                    processed_at: result.created_at
                })));
            }
            return acc;
        }, []);

        const filename = `all_results_${Date.now()}`;
        this.exportData(allData, filename);
        toast.success('All results exported successfully');
    }

    /**
     * Export data as JSON
     */
    exportData(data, filename) {
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Delete result
     */
    async deleteResult(resultId) {
        const confirmed = await new Promise(resolve => {
            modal.confirm(
                'Are you sure you want to delete this result? This action cannot be undone.',
                () => resolve(true),
                () => resolve(false)
            );
        });

        if (!confirmed) return;

        try {
            // Delete from server (if API supports it)
            // await api.delete(`/results/${resultId}`);
            
            // Remove from local data
            this.results = this.results.filter(r => r.id !== resultId);
            this.applyFiltersAndSort();
            
            // Update UI
            this.renderOverview();
            this.renderResults();
            
            toast.success('Result deleted successfully');
            
        } catch (error) {
            CONFIG.error('Failed to delete result:', error);
            toast.error('Failed to delete result');
        }
    }

    /**
     * Clear all results
     */
    async clearAllResults() {
        if (this.results.length === 0) {
            toast.info('No results to clear');
            return;
        }

        const confirmed = await new Promise(resolve => {
            modal.confirm(
                `Are you sure you want to delete all ${this.results.length} results? This action cannot be undone.`,
                () => resolve(true),
                () => resolve(false)
            );
        });

        if (!confirmed) return;

        try {
            // Clear from server (if API supports it)
            // await api.delete('/results');
            
            // Clear local data
            this.results = [];
            this.filteredResults = [];
            
            // Update UI
            this.renderOverview();
            this.renderResults();
            
            toast.success('All results cleared successfully');
            
        } catch (error) {
            CONFIG.error('Failed to clear results:', error);
            toast.error('Failed to clear results');
        }
    }

    /**
     * Show loading
     */
    showLoading() {
        if (this.elements.resultsGrid) {
            this.elements.resultsGrid.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <div>Loading results...</div>
                </div>
            `;
        }
    }

    /**
     * Hide loading
     */
    hideLoading() {
        // Loading will be replaced by actual content
    }

    /**
     * Page lifecycle methods
     */
    onPageShow() {
        this.loadResults();
    }

    onPageHide() {
        // Clean up if needed
    }

    onResize() {
        // Handle resize if needed
    }

    hasUnsavedChanges() {
        return false;
    }

    async save() {
        return Promise.resolve();
    }
}

// Make global functions available
window.viewResult = function(resultId) {
    if (window.app) {
        const resultsManager = window.app.getPageManager('results');
        if (resultsManager) {
            resultsManager.viewResult(resultId);
        }
    }
};

window.exportResult = function(resultId) {
    if (window.app) {
        const resultsManager = window.app.getPageManager('results');
        if (resultsManager) {
            resultsManager.exportResult(resultId);
        }
    }
};

window.deleteResult = function(resultId) {
    if (window.app) {
        const resultsManager = window.app.getPageManager('results');
        if (resultsManager) {
            resultsManager.deleteResult(resultId);
        }
    }
};
