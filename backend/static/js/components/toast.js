/**
 * Toast Notification Component
 * Displays temporary notification messages to users
 */

class Toast {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Show a toast notification
     */
    show(message, type = 'info', options = {}) {
        const defaultOptions = {
            duration: CONFIG.UI.TOAST_DURATION,
            closable: true,
            persistent: false,
            action: null,
            actionText: 'Action'
        };

        const config = { ...defaultOptions, ...options };
        const toastId = Utils.generateId('toast');

        // Create toast element
        const toastElement = this.createToastElement(toastId, message, type, config);
        
        // Add to container
        this.container.appendChild(toastElement);
        this.toasts.set(toastId, { element: toastElement, config });

        // Animate in
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });

        // Auto-remove if not persistent
        if (!config.persistent && config.duration > 0) {
            setTimeout(() => {
                this.hide(toastId);
            }, config.duration);
        }

        CONFIG.log('Toast shown:', { message, type, options });
        return toastId;
    }

    /**
     * Create toast DOM element
     */
    createToastElement(id, message, type, config) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('data-toast-id', id);

        const icon = this.getTypeIcon(type);
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">${icon}</div>
                <div class="toast-message">${Utils.sanitizeHtml(message)}</div>
                ${config.action ? `<button class="toast-action">${config.actionText}</button>` : ''}
                ${config.closable ? '<button class="toast-close">&times;</button>' : ''}
            </div>
        `;

        // Add event listeners
        this.addToastEventListeners(toast, id, config);

        return toast;
    }

    /**
     * Add event listeners to toast
     */
    addToastEventListeners(toast, id, config) {
        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide(id);
            });
        }

        // Action button
        const actionBtn = toast.querySelector('.toast-action');
        if (actionBtn && config.action) {
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                config.action();
                if (!config.persistent) {
                    this.hide(id);
                }
            });
        }

        // Click to dismiss (if closable)
        if (config.closable) {
            toast.addEventListener('click', () => {
                this.hide(id);
            });
        }

        // Pause auto-hide on hover
        if (!config.persistent) {
            let timeoutId;
            
            toast.addEventListener('mouseenter', () => {
                clearTimeout(timeoutId);
            });

            toast.addEventListener('mouseleave', () => {
                timeoutId = setTimeout(() => {
                    this.hide(id);
                }, 2000); // Shorter delay after hover
            });
        }
    }

    /**
     * Get icon for toast type
     */
    getTypeIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            loading: '⏳'
        };
        return icons[type] || icons.info;
    }

    /**
     * Hide a toast notification
     */
    hide(toastId) {
        const toast = this.toasts.get(toastId);
        if (!toast) return;

        const { element } = toast;
        
        // Animate out
        element.classList.add('hiding');
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.toasts.delete(toastId);
        }, 300); // Match CSS animation duration

        CONFIG.log('Toast hidden:', toastId);
    }

    /**
     * Hide all toasts
     */
    hideAll() {
        const toastIds = Array.from(this.toasts.keys());
        toastIds.forEach(id => this.hide(id));
    }

    /**
     * Update existing toast
     */
    update(toastId, message, type) {
        const toast = this.toasts.get(toastId);
        if (!toast) return;

        const messageElement = toast.element.querySelector('.toast-message');
        const iconElement = toast.element.querySelector('.toast-icon');
        
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        if (iconElement && type) {
            iconElement.textContent = this.getTypeIcon(type);
            toast.element.className = `toast toast-${type}`;
        }
    }

    /**
     * Show success toast
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    /**
     * Show error toast
     */
    error(message, options = {}) {
        return this.show(message, 'error', { 
            duration: CONFIG.UI.TOAST_DURATION * 1.5, // Longer for errors
            ...options 
        });
    }

    /**
     * Show warning toast
     */
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    /**
     * Show info toast
     */
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    /**
     * Show loading toast
     */
    loading(message, options = {}) {
        return this.show(message, 'loading', { 
            persistent: true, 
            closable: false,
            ...options 
        });
    }

    /**
     * Show progress toast
     */
    progress(message, progress = 0, options = {}) {
        const toastId = this.show(message, 'info', { 
            persistent: true, 
            closable: false,
            ...options 
        });

        // Add progress bar
        const toast = this.toasts.get(toastId);
        if (toast) {
            const progressBar = document.createElement('div');
            progressBar.className = 'toast-progress';
            progressBar.innerHTML = `
                <div class="toast-progress-bar">
                    <div class="toast-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="toast-progress-text">${Math.round(progress)}%</div>
            `;
            toast.element.appendChild(progressBar);
        }

        return toastId;
    }

    /**
     * Update progress toast
     */
    updateProgress(toastId, progress, message) {
        const toast = this.toasts.get(toastId);
        if (!toast) return;

        const progressFill = toast.element.querySelector('.toast-progress-fill');
        const progressText = toast.element.querySelector('.toast-progress-text');
        const messageElement = toast.element.querySelector('.toast-message');

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }

        if (message && messageElement) {
            messageElement.textContent = message;
        }

        // Auto-hide when complete
        if (progress >= 100) {
            setTimeout(() => {
                this.hide(toastId);
            }, 1000);
        }
    }

    /**
     * Show confirmation toast with action
     */
    confirm(message, onConfirm, onCancel, options = {}) {
        const defaultOptions = {
            persistent: true,
            closable: false
        };

        const config = { ...defaultOptions, ...options };
        const toastId = Utils.generateId('toast');

        // Create custom toast element for confirmation
        const toast = document.createElement('div');
        toast.className = 'toast toast-warning';
        toast.setAttribute('data-toast-id', toastId);

        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">❓</div>
                <div class="toast-message">${Utils.sanitizeHtml(message)}</div>
                <div class="toast-actions">
                    <button class="toast-action toast-confirm">Confirm</button>
                    <button class="toast-action toast-cancel">Cancel</button>
                </div>
            </div>
        `;

        // Add event listeners
        const confirmBtn = toast.querySelector('.toast-confirm');
        const cancelBtn = toast.querySelector('.toast-cancel');

        confirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            this.hide(toastId);
        });

        cancelBtn.addEventListener('click', () => {
            if (onCancel) onCancel();
            this.hide(toastId);
        });

        // Add to container
        this.container.appendChild(toast);
        this.toasts.set(toastId, { element: toast, config });

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        return toastId;
    }

    /**
     * Get toast count
     */
    getCount() {
        return this.toasts.size;
    }

    /**
     * Check if toast exists
     */
    exists(toastId) {
        return this.toasts.has(toastId);
    }
}

// Create global toast instance
const toast = new Toast();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toast;
} else {
    window.toast = toast;
    window.Toast = Toast;
}
