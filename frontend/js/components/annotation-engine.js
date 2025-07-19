/**
 * Annotation Engine
 * Advanced annotation system for drawing and managing annotations on canvas
 */

// Tool modes
const TOOL_MODES = {
    SELECT: 'select',
    RECTANGLE: 'rectangle',
    POLYGON: 'polygon',
    PAN: 'pan',
    ZOOM_IN: 'zoom-in',
    ZOOM_OUT: 'zoom-out',
    DELETE: 'delete'
};

// Annotation types
const ANNOTATION_TYPES = {
    RECTANGLE: 'rectangle',
    POLYGON: 'polygon',
    POINT: 'point',
    LINE: 'line'
};

class AnnotationEngine {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.options = {
            width: CONFIG.CANVAS.MAX_WIDTH,
            height: CONFIG.CANVAS.MAX_HEIGHT,
            enableHistory: true,
            maxHistorySize: 50,
            enableAutoSave: true,
            autoSaveInterval: CONFIG.UI.AUTO_SAVE_INTERVAL,
            ...options
        };

        // Core state
        this.currentTool = TOOL_MODES.SELECT;
        this.annotations = new Map();
        this.selectedAnnotations = new Set();
        this.history = [];
        this.historyIndex = -1;
        
        // Drawing state
        this.isDrawing = false;
        this.currentAnnotation = null;
        this.startPoint = null;
        this.polygonPoints = [];
        
        // Image state
        this.image = null;
        this.imageScale = 1;
        this.imageOffset = { x: 0, y: 0 };
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        
        // Interaction state
        this.isDragging = false;
        this.dragStart = null;
        this.dragAnnotation = null;
        this.resizeHandle = null;
        
        // Event emitter
        this.events = Utils.createEventEmitter();
        
        // Auto-save timer
        this.autoSaveTimer = null;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.addEventListeners();
        this.setupAutoSave();
        CONFIG.log('Annotation engine initialized');
    }

    /**
     * Setup canvas properties
     */
    setupCanvas() {
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.render();
    }

    /**
     * Add event listeners
     */
    addEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));

        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Context menu
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));

        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        if (this.options.enableAutoSave) {
            this.autoSaveTimer = setInterval(() => {
                this.autoSave();
            }, this.options.autoSaveInterval);
        }
    }

    /**
     * Load and display image
     */
    async loadImage(imageUrl) {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    this.image = img;
                    this.calculateImageScale();
                    this.centerImage();
                    this.render();
                    this.events.emit('imageLoaded', img);
                    resolve(img);
                };
                
                img.onerror = () => {
                    reject(new Error(`Failed to load image: ${imageUrl}`));
                };
                
                img.src = imageUrl;
            });
        } catch (error) {
            CONFIG.error('Failed to load image:', error);
            throw error;
        }
    }

    /**
     * Calculate optimal image scale
     */
    calculateImageScale() {
        if (!this.image) return;

        const canvasAspect = this.canvas.width / this.canvas.height;
        const imageAspect = this.image.width / this.image.height;

        if (imageAspect > canvasAspect) {
            this.imageScale = (this.canvas.width * 0.9) / this.image.width;
        } else {
            this.imageScale = (this.canvas.height * 0.9) / this.image.height;
        }

        this.zoomLevel = this.imageScale;
    }

    /**
     * Center image on canvas
     */
    centerImage() {
        if (!this.image) return;

        const scaledWidth = this.image.width * this.imageScale;
        const scaledHeight = this.image.height * this.imageScale;

        this.imageOffset = {
            x: (this.canvas.width - scaledWidth) / 2,
            y: (this.canvas.height - scaledHeight) / 2
        };
    }

    /**
     * Get mouse position relative to canvas
     */
    getMousePos(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    /**
     * Convert canvas coordinates to image coordinates
     */
    canvasToImage(canvasPos) {
        if (!this.image) return canvasPos;

        return {
            x: (canvasPos.x - this.imageOffset.x - this.panOffset.x) / this.imageScale,
            y: (canvasPos.y - this.imageOffset.y - this.panOffset.y) / this.imageScale
        };
    }

    /**
     * Convert image coordinates to canvas coordinates
     */
    imageToCanvas(imagePos) {
        if (!this.image) return imagePos;

        return {
            x: imagePos.x * this.imageScale + this.imageOffset.x + this.panOffset.x,
            y: imagePos.y * this.imageScale + this.imageOffset.y + this.panOffset.y
        };
    }

    /**
     * Set current tool
     */
    setTool(tool) {
        if (this.currentTool === tool) return;
        
        // Finish current drawing if switching tools
        if (this.isDrawing) {
            this.finishCurrentAnnotation();
        }
        
        this.currentTool = tool;
        this.updateCursor();
        this.events.emit('toolChanged', tool);
        CONFIG.log('Tool changed to:', tool);
    }

    /**
     * Update canvas cursor based on current tool
     */
    updateCursor() {
        const cursors = {
            [TOOL_MODES.SELECT]: 'default',
            [TOOL_MODES.RECTANGLE]: 'crosshair',
            [TOOL_MODES.POLYGON]: 'crosshair',
            [TOOL_MODES.PAN]: 'grab',
            [TOOL_MODES.ZOOM_IN]: 'zoom-in',
            [TOOL_MODES.ZOOM_OUT]: 'zoom-out',
            [TOOL_MODES.DELETE]: 'not-allowed'
        };
        
        this.canvas.style.cursor = cursors[this.currentTool] || 'default';
    }

    /**
     * Create new annotation
     */
    createAnnotation(type, data) {
        const id = Utils.generateId('annotation');
        const annotation = {
            id,
            type,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            field_name: '',
            color: CONFIG.getRandomColor(),
            ...data
        };

        this.annotations.set(id, annotation);
        this.saveState();
        this.events.emit('annotationCreated', annotation);
        
        return annotation;
    }

    /**
     * Update annotation
     */
    updateAnnotation(id, data) {
        const annotation = this.annotations.get(id);
        if (!annotation) return false;

        Object.assign(annotation, data, {
            modified: new Date().toISOString()
        });

        this.saveState();
        this.events.emit('annotationUpdated', annotation);
        this.render();
        
        return true;
    }

    /**
     * Delete annotation
     */
    deleteAnnotation(id) {
        const annotation = this.annotations.get(id);
        if (!annotation) return false;

        this.annotations.delete(id);
        this.selectedAnnotations.delete(id);
        this.saveState();
        this.events.emit('annotationDeleted', annotation);
        this.render();
        
        return true;
    }

    /**
     * Select annotation
     */
    selectAnnotation(id, addToSelection = false) {
        if (!addToSelection) {
            this.selectedAnnotations.clear();
        }
        
        if (id) {
            this.selectedAnnotations.add(id);
        }
        
        this.events.emit('selectionChanged', Array.from(this.selectedAnnotations));
        this.render();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedAnnotations.clear();
        this.events.emit('selectionChanged', []);
        this.render();
    }

    /**
     * Get all annotations as array
     */
    getAnnotations() {
        return Array.from(this.annotations.values());
    }

    /**
     * Get selected annotations
     */
    getSelectedAnnotations() {
        return Array.from(this.selectedAnnotations)
            .map(id => this.annotations.get(id))
            .filter(Boolean);
    }

    /**
     * Load annotations from data
     */
    loadAnnotations(annotationsData) {
        this.annotations.clear();
        this.selectedAnnotations.clear();

        annotationsData.forEach(data => {
            const annotation = {
                id: data.id || Utils.generateId('annotation'),
                type: ANNOTATION_TYPES.RECTANGLE, // Default type
                field_name: data.field_name || '',
                x: data.x || 0,
                y: data.y || 0,
                w: data.w || data.width || 0,
                h: data.h || data.height || 0,
                color: data.color || CONFIG.getRandomColor(),
                created: data.created || new Date().toISOString(),
                modified: data.modified || new Date().toISOString(),
                ...data
            };

            this.annotations.set(annotation.id, annotation);
        });

        this.render();
        this.events.emit('annotationsLoaded', this.getAnnotations());
        CONFIG.log('Loaded annotations:', this.annotations.size);
    }

    /**
     * Handle mouse down events
     */
    handleMouseDown(event) {
        event.preventDefault();
        const pos = this.getMousePos(event);
        const imagePos = this.canvasToImage(pos);

        switch (this.currentTool) {
            case TOOL_MODES.SELECT:
                this.handleSelectMouseDown(pos, imagePos, event);
                break;
            case TOOL_MODES.RECTANGLE:
                this.startRectangleAnnotation(pos, imagePos);
                break;
            case TOOL_MODES.POLYGON:
                this.handlePolygonPoint(pos, imagePos);
                break;
            case TOOL_MODES.PAN:
                this.startPanning(pos);
                break;
            case TOOL_MODES.DELETE:
                this.handleDeleteClick(pos, imagePos);
                break;
        }
    }

    /**
     * Handle mouse move events
     */
    handleMouseMove(event) {
        const pos = this.getMousePos(event);
        const imagePos = this.canvasToImage(pos);

        if (this.isDrawing) {
            switch (this.currentTool) {
                case TOOL_MODES.RECTANGLE:
                    this.updateRectangleAnnotation(pos, imagePos);
                    break;
            }
        } else if (this.isDragging) {
            if (this.currentTool === TOOL_MODES.PAN) {
                this.updatePanning(pos);
            } else if (this.dragAnnotation) {
                this.updateAnnotationDrag(pos, imagePos);
            }
        }

        this.events.emit('mouseMove', { canvasPos: pos, imagePos });
    }

    /**
     * Handle mouse up events
     */
    handleMouseUp(event) {
        const pos = this.getMousePos(event);
        const imagePos = this.canvasToImage(pos);

        if (this.isDrawing) {
            switch (this.currentTool) {
                case TOOL_MODES.RECTANGLE:
                    this.finishRectangleAnnotation(pos, imagePos);
                    break;
            }
        }

        this.isDragging = false;
        this.dragAnnotation = null;
        this.dragStart = null;

        this.events.emit('mouseUp', { canvasPos: pos, imagePos });
    }

    /**
     * Handle wheel events (zoom)
     */
    handleWheel(event) {
        event.preventDefault();
        const pos = this.getMousePos(event);
        const delta = event.deltaY > 0 ? -CONFIG.CANVAS.ZOOM_STEP : CONFIG.CANVAS.ZOOM_STEP;
        this.zoom(delta, pos);
    }

    /**
     * Handle double click events
     */
    handleDoubleClick(event) {
        if (this.currentTool === TOOL_MODES.POLYGON && this.polygonPoints.length > 2) {
            this.finishPolygonAnnotation();
        }
    }

    /**
     * Handle context menu
     */
    handleContextMenu(event) {
        event.preventDefault();
        const pos = this.getMousePos(event);
        const imagePos = this.canvasToImage(pos);

        const annotation = this.getAnnotationAt(imagePos);
        this.events.emit('contextMenu', {
            canvasPos: pos,
            imagePos,
            annotation,
            event
        });
    }

    /**
     * Handle keyboard events
     */
    handleKeyDown(event) {
        switch (event.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedAnnotations();
                break;
            case 'Escape':
                this.cancelCurrentOperation();
                break;
            case 'z':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                }
                break;
            case 'a':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.selectAllAnnotations();
                }
                break;
        }
    }

    /**
     * Handle key up events
     */
    handleKeyUp(event) {
        // Handle key releases if needed
    }

    /**
     * Start rectangle annotation
     */
    startRectangleAnnotation(canvasPos, imagePos) {
        this.isDrawing = true;
        this.startPoint = imagePos;

        this.currentAnnotation = this.createAnnotation(ANNOTATION_TYPES.RECTANGLE, {
            x: imagePos.x,
            y: imagePos.y,
            w: 0,
            h: 0
        });

        this.render();
    }

    /**
     * Update rectangle annotation while drawing
     */
    updateRectangleAnnotation(canvasPos, imagePos) {
        if (!this.currentAnnotation || !this.startPoint) return;

        const x = Math.min(this.startPoint.x, imagePos.x);
        const y = Math.min(this.startPoint.y, imagePos.y);
        const w = Math.abs(imagePos.x - this.startPoint.x);
        const h = Math.abs(imagePos.y - this.startPoint.y);

        this.updateAnnotation(this.currentAnnotation.id, { x, y, w, h });
    }

    /**
     * Finish rectangle annotation
     */
    finishRectangleAnnotation(canvasPos, imagePos) {
        if (!this.currentAnnotation) return;

        const annotation = this.annotations.get(this.currentAnnotation.id);
        if (annotation && (annotation.w < CONFIG.ANNOTATION.MIN_SIZE || annotation.h < CONFIG.ANNOTATION.MIN_SIZE)) {
            // Delete annotation if too small
            this.deleteAnnotation(annotation.id);
        } else if (annotation) {
            // Show field selection modal
            this.events.emit('annotationCompleted', annotation);
        }

        this.isDrawing = false;
        this.currentAnnotation = null;
        this.startPoint = null;
    }

    /**
     * Get annotation at position
     */
    getAnnotationAt(imagePos) {
        for (const annotation of this.annotations.values()) {
            if (this.isPointInAnnotation(imagePos, annotation)) {
                return annotation;
            }
        }
        return null;
    }

    /**
     * Check if point is inside annotation
     */
    isPointInAnnotation(point, annotation) {
        switch (annotation.type) {
            case ANNOTATION_TYPES.RECTANGLE:
                return point.x >= annotation.x &&
                       point.x <= annotation.x + annotation.w &&
                       point.y >= annotation.y &&
                       point.y <= annotation.y + annotation.h;
            default:
                return false;
        }
    }

    /**
     * Render canvas content
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Fill background
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw image if loaded
        if (this.image) {
            this.drawImage();
        }

        // Draw annotations
        this.drawAnnotations();

        // Draw current drawing
        if (this.isDrawing && this.currentAnnotation) {
            this.drawAnnotation(this.currentAnnotation, true);
        }

        this.events.emit('render');
    }

    /**
     * Draw image on canvas
     */
    drawImage() {
        if (!this.image) return;

        const scaledWidth = this.image.width * this.imageScale;
        const scaledHeight = this.image.height * this.imageScale;

        this.ctx.drawImage(
            this.image,
            this.imageOffset.x + this.panOffset.x,
            this.imageOffset.y + this.panOffset.y,
            scaledWidth,
            scaledHeight
        );
    }

    /**
     * Draw all annotations
     */
    drawAnnotations() {
        for (const annotation of this.annotations.values()) {
            const isSelected = this.selectedAnnotations.has(annotation.id);
            this.drawAnnotation(annotation, false, isSelected);
        }
    }

    /**
     * Draw single annotation
     */
    drawAnnotation(annotation, isDrawing = false, isSelected = false) {
        const canvasPos = this.imageToCanvas({ x: annotation.x, y: annotation.y });
        const width = annotation.w * this.imageScale;
        const height = annotation.h * this.imageScale;

        this.ctx.save();

        // Set styles
        this.ctx.strokeStyle = annotation.color || CONFIG.ANNOTATION.COLORS[0];
        this.ctx.lineWidth = isSelected ? CONFIG.ANNOTATION.SELECTED_STROKE_WIDTH : CONFIG.ANNOTATION.DEFAULT_STROKE_WIDTH;
        this.ctx.fillStyle = `${annotation.color || CONFIG.ANNOTATION.COLORS[0]}20`;

        if (isDrawing) {
            this.ctx.setLineDash([5, 5]);
        } else if (isSelected) {
            this.ctx.setLineDash([3, 3]);
        }

        // Draw annotation based on type
        switch (annotation.type) {
            case ANNOTATION_TYPES.RECTANGLE:
                this.ctx.fillRect(canvasPos.x, canvasPos.y, width, height);
                this.ctx.strokeRect(canvasPos.x, canvasPos.y, width, height);
                break;
        }

        // Draw label
        if (annotation.field_name && !isDrawing) {
            this.drawAnnotationLabel(annotation, canvasPos);
        }

        // Draw resize handles for selected annotations
        if (isSelected && !isDrawing) {
            this.drawResizeHandles(canvasPos, width, height);
        }

        this.ctx.restore();
    }

    /**
     * Draw annotation label
     */
    drawAnnotationLabel(annotation, canvasPos) {
        const label = annotation.field_name;
        if (!label) return;

        this.ctx.save();
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = annotation.color || CONFIG.ANNOTATION.COLORS[0];
        this.ctx.textBaseline = 'bottom';

        // Draw background
        const textMetrics = this.ctx.measureText(label);
        const padding = 4;
        const labelY = canvasPos.y - 2;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillRect(
            canvasPos.x - padding,
            labelY - textMetrics.actualBoundingBoxAscent - padding,
            textMetrics.width + padding * 2,
            textMetrics.actualBoundingBoxAscent + padding * 2
        );

        // Draw text
        this.ctx.fillStyle = annotation.color || CONFIG.ANNOTATION.COLORS[0];
        this.ctx.fillText(label, canvasPos.x, labelY);

        this.ctx.restore();
    }

    /**
     * Draw resize handles
     */
    drawResizeHandles(pos, width, height) {
        const handleSize = CONFIG.ANNOTATION.HANDLE_SIZE;
        const halfHandle = handleSize / 2;

        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#007bff';
        this.ctx.lineWidth = 2;

        // Corner handles
        const handles = [
            { x: pos.x - halfHandle, y: pos.y - halfHandle }, // top-left
            { x: pos.x + width - halfHandle, y: pos.y - halfHandle }, // top-right
            { x: pos.x - halfHandle, y: pos.y + height - halfHandle }, // bottom-left
            { x: pos.x + width - halfHandle, y: pos.y + height - halfHandle }, // bottom-right
        ];

        handles.forEach(handle => {
            this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
            this.ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });

        this.ctx.restore();
    }

    /**
     * Zoom in/out
     */
    zoom(delta, center = null) {
        const oldScale = this.imageScale;
        const newScale = Utils.clamp(
            this.imageScale + delta,
            CONFIG.CANVAS.MIN_ZOOM,
            CONFIG.CANVAS.MAX_ZOOM
        );

        if (newScale === oldScale) return;

        this.imageScale = newScale;
        this.zoomLevel = newScale;

        // Zoom towards center point if provided
        if (center && this.image) {
            const scaleFactor = newScale / oldScale;
            this.panOffset.x = center.x - (center.x - this.panOffset.x) * scaleFactor;
            this.panOffset.y = center.y - (center.y - this.panOffset.y) * scaleFactor;
        }

        this.render();
        this.events.emit('zoom', { scale: newScale, center });
    }

    /**
     * Fit image to canvas
     */
    fitToCanvas() {
        if (!this.image) return;

        this.calculateImageScale();
        this.centerImage();
        this.panOffset = { x: 0, y: 0 };
        this.render();
        this.events.emit('fitToCanvas');
    }

    /**
     * Save current state to history
     */
    saveState() {
        if (!this.options.enableHistory) return;

        const state = {
            annotations: Utils.deepClone(Array.from(this.annotations.values())),
            timestamp: Date.now()
        };

        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(state);

        // Limit history size
        if (this.history.length > this.options.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.events.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    /**
     * Undo last action
     */
    undo() {
        if (!this.canUndo()) return false;

        this.historyIndex--;
        const state = this.history[this.historyIndex];
        this.loadAnnotationsFromState(state);

        this.events.emit('undo', state);
        this.events.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });

        return true;
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (!this.canRedo()) return false;

        this.historyIndex++;
        const state = this.history[this.historyIndex];
        this.loadAnnotationsFromState(state);

        this.events.emit('redo', state);
        this.events.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });

        return true;
    }

    /**
     * Check if undo is possible
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is possible
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Load annotations from history state
     */
    loadAnnotationsFromState(state) {
        this.annotations.clear();
        this.selectedAnnotations.clear();

        state.annotations.forEach(annotation => {
            this.annotations.set(annotation.id, annotation);
        });

        this.render();
    }

    /**
     * Auto-save annotations
     */
    autoSave() {
        if (this.annotations.size > 0) {
            this.events.emit('autoSave', this.getAnnotations());
        }
    }

    /**
     * Delete selected annotations
     */
    deleteSelectedAnnotations() {
        const selectedIds = Array.from(this.selectedAnnotations);
        selectedIds.forEach(id => this.deleteAnnotation(id));

        if (selectedIds.length > 0) {
            this.events.emit('annotationsDeleted', selectedIds);
        }
    }

    /**
     * Select all annotations
     */
    selectAllAnnotations() {
        this.selectedAnnotations.clear();
        this.annotations.forEach((annotation, id) => {
            this.selectedAnnotations.add(id);
        });

        this.events.emit('selectionChanged', Array.from(this.selectedAnnotations));
        this.render();
    }

    /**
     * Cancel current operation
     */
    cancelCurrentOperation() {
        if (this.isDrawing) {
            if (this.currentAnnotation) {
                this.deleteAnnotation(this.currentAnnotation.id);
            }
            this.isDrawing = false;
            this.currentAnnotation = null;
            this.startPoint = null;
            this.polygonPoints = [];
            this.render();
        }

        this.clearSelection();
    }

    /**
     * Destroy annotation engine
     */
    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.events.emit('destroy');
        CONFIG.log('Annotation engine destroyed');
    }

    /**
     * Event listener methods
     */
    on(event, callback) {
        this.events.on(event, callback);
    }

    off(event, callback) {
        this.events.off(event, callback);
    }

    emit(event, ...args) {
        this.events.emit(event, ...args);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnnotationEngine, TOOL_MODES, ANNOTATION_TYPES };
} else {
    window.AnnotationEngine = AnnotationEngine;
    window.TOOL_MODES = TOOL_MODES;
    window.ANNOTATION_TYPES = ANNOTATION_TYPES;
}
