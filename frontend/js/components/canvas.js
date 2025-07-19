/**
 * Canvas Component
 * Handles canvas operations for image display and basic drawing
 */

class CanvasComponent {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.options = {
            width: CONFIG.CANVAS.MAX_WIDTH,
            height: CONFIG.CANVAS.MAX_HEIGHT,
            backgroundColor: '#ffffff',
            ...options
        };

        // State
        this.image = null;
        this.imageScale = 1;
        this.imageOffset = { x: 0, y: 0 };
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };

        // Event emitter
        this.events = Utils.createEventEmitter();

        this.init();
    }

    init() {
        this.setupCanvas();
        this.addEventListeners();
        CONFIG.log('Canvas component initialized');
    }

    /**
     * Setup canvas properties
     */
    setupCanvas() {
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleContextMenu(e);
        });

        // Resize observer
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(
                Utils.throttle(this.handleResize.bind(this), CONFIG.PERFORMANCE.RESIZE_THROTTLE)
            );
            this.resizeObserver.observe(this.canvas.parentElement);
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
     * Calculate optimal image scale to fit canvas
     */
    calculateImageScale() {
        if (!this.image) return;

        const canvasAspect = this.canvas.width / this.canvas.height;
        const imageAspect = this.image.width / this.image.height;

        if (imageAspect > canvasAspect) {
            // Image is wider than canvas
            this.imageScale = (this.canvas.width * 0.9) / this.image.width;
        } else {
            // Image is taller than canvas
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
     * Render canvas content
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Fill background
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw image if loaded
        if (this.image) {
            this.drawImage();
        }

        // Emit render event
        this.events.emit('render', this.ctx);
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
     * Get touch position relative to canvas
     */
    getTouchPos(event) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = event.touches[0] || event.changedTouches[0];
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
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
     * Handle mouse down
     */
    handleMouseDown(event) {
        const pos = this.getMousePos(event);
        this.lastMousePos = pos;
        this.isDragging = true;

        this.events.emit('mouseDown', { 
            canvasPos: pos, 
            imagePos: this.canvasToImage(pos),
            event 
        });
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(event) {
        const pos = this.getMousePos(event);

        if (this.isDragging) {
            const deltaX = pos.x - this.lastMousePos.x;
            const deltaY = pos.y - this.lastMousePos.y;

            this.panOffset.x += deltaX;
            this.panOffset.y += deltaY;
            this.render();
        }

        this.lastMousePos = pos;

        this.events.emit('mouseMove', { 
            canvasPos: pos, 
            imagePos: this.canvasToImage(pos),
            isDragging: this.isDragging,
            event 
        });
    }

    /**
     * Handle mouse up
     */
    handleMouseUp(event) {
        const pos = this.getMousePos(event);
        this.isDragging = false;

        this.events.emit('mouseUp', { 
            canvasPos: pos, 
            imagePos: this.canvasToImage(pos),
            event 
        });
    }

    /**
     * Handle wheel (zoom)
     */
    handleWheel(event) {
        event.preventDefault();
        
        const pos = this.getMousePos(event);
        const delta = event.deltaY > 0 ? -CONFIG.CANVAS.ZOOM_STEP : CONFIG.CANVAS.ZOOM_STEP;
        
        this.zoom(delta, pos);
    }

    /**
     * Handle touch start
     */
    handleTouchStart(event) {
        event.preventDefault();
        const pos = this.getTouchPos(event);
        this.handleMouseDown({ ...event, clientX: pos.x, clientY: pos.y });
    }

    /**
     * Handle touch move
     */
    handleTouchMove(event) {
        event.preventDefault();
        const pos = this.getTouchPos(event);
        this.handleMouseMove({ ...event, clientX: pos.x, clientY: pos.y });
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(event) {
        event.preventDefault();
        const pos = this.getTouchPos(event);
        this.handleMouseUp({ ...event, clientX: pos.x, clientY: pos.y });
    }

    /**
     * Handle context menu
     */
    handleContextMenu(event) {
        const pos = this.getMousePos(event);
        this.events.emit('contextMenu', { 
            canvasPos: pos, 
            imagePos: this.canvasToImage(pos),
            event 
        });
    }

    /**
     * Handle resize
     */
    handleResize() {
        const parent = this.canvas.parentElement;
        if (!parent) return;

        const rect = parent.getBoundingClientRect();
        const newWidth = Math.min(rect.width - 20, CONFIG.CANVAS.MAX_WIDTH);
        const newHeight = Math.min(rect.height - 20, CONFIG.CANVAS.MAX_HEIGHT);

        if (newWidth !== this.canvas.width || newHeight !== this.canvas.height) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            
            if (this.image) {
                this.calculateImageScale();
                this.centerImage();
            }
            
            this.render();
            this.events.emit('resize', { width: newWidth, height: newHeight });
        }
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
     * Reset view
     */
    resetView() {
        this.fitToCanvas();
    }

    /**
     * Get canvas data URL
     */
    toDataURL(type = 'image/png', quality = 1.0) {
        return this.canvas.toDataURL(type, quality);
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Destroy component
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Remove event listeners would go here if we stored references
        this.events.emit('destroy');
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
    module.exports = CanvasComponent;
} else {
    window.CanvasComponent = CanvasComponent;
}
