/**
 * Modal Component
 * Handles modal dialogs and overlays
 */

class Modal {
    constructor() {
        this.overlay = null;
        this.activeModals = new Map();
        this.init();
    }

    init() {
        // Create modal overlay if it doesn't exist
        this.overlay = document.getElementById('modal-overlay');
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'modal-overlay';
            this.overlay.className = 'modal-overlay';
            this.overlay.style.display = 'none';
            document.body.appendChild(this.overlay);
        }

        // Add global event listeners
        this.addGlobalEventListeners();
    }

    /**
     * Add global event listeners
     */
    addGlobalEventListeners() {
        // Close modal on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closeTop();
            }
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                this.closeTop();
            }
        });
    }

    /**
     * Show a modal
     */
    show(modalId, options = {}) {
        const defaultOptions = {
            closable: true,
            closeOnOverlay: true,
            closeOnEscape: true,
            backdrop: true,
            animation: true
        };

        const config = { ...defaultOptions, ...options };
        
        // Get modal element
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            CONFIG.error('Modal element not found:', modalId);
            return false;
        }

        // Show overlay
        this.overlay.style.display = 'flex';
        
        // Show modal
        modalElement.style.display = 'block';
        
        // Add to active modals
        this.activeModals.set(modalId, { element: modalElement, config });

        // Add event listeners
        this.addModalEventListeners(modalElement, modalId, config);

        // Animate in
        if (config.animation) {
            requestAnimationFrame(() => {
                this.overlay.classList.add('show');
                modalElement.classList.add('show');
            });
        }

        // Focus management
        this.manageFocus(modalElement);

        CONFIG.log('Modal shown:', modalId);
        return true;
    }

    /**
     * Hide a modal
     */
    hide(modalId) {
        const modal = this.activeModals.get(modalId);
        if (!modal) return false;

        const { element, config } = modal;

        // Animate out
        if (config.animation) {
            element.classList.add('hiding');
            
            setTimeout(() => {
                this.completeHide(modalId, element);
            }, 200); // Match CSS animation duration
        } else {
            this.completeHide(modalId, element);
        }

        CONFIG.log('Modal hidden:', modalId);
        return true;
    }

    /**
     * Complete the hide process
     */
    completeHide(modalId, element) {
        // Hide modal
        element.style.display = 'none';
        element.classList.remove('show', 'hiding');

        // Remove from active modals
        this.activeModals.delete(modalId);

        // Hide overlay if no active modals
        if (this.activeModals.size === 0) {
            this.overlay.style.display = 'none';
            this.overlay.classList.remove('show');
        }

        // Restore focus
        this.restoreFocus();
    }

    /**
     * Close the top-most modal
     */
    closeTop() {
        if (this.activeModals.size === 0) return;

        const modalIds = Array.from(this.activeModals.keys());
        const topModalId = modalIds[modalIds.length - 1];
        this.hide(topModalId);
    }

    /**
     * Close all modals
     */
    closeAll() {
        const modalIds = Array.from(this.activeModals.keys());
        modalIds.forEach(id => this.hide(id));
    }

    /**
     * Add event listeners to modal
     */
    addModalEventListeners(modalElement, modalId, config) {
        // Close buttons
        const closeButtons = modalElement.querySelectorAll('.modal-close, [data-modal-close]');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.hide(modalId);
            });
        });

        // Form submission
        const forms = modalElement.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit(form, modalId);
            });
        });
    }

    /**
     * Handle form submission in modal
     */
    handleFormSubmit(form, modalId) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Emit custom event
        const event = new CustomEvent('modalFormSubmit', {
            detail: { modalId, data, form }
        });
        document.dispatchEvent(event);
    }

    /**
     * Manage focus for accessibility
     */
    manageFocus(modalElement) {
        // Store currently focused element
        this.previouslyFocused = document.activeElement;

        // Focus first focusable element in modal
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        // Trap focus within modal
        modalElement.addEventListener('keydown', this.trapFocus.bind(this));
    }

    /**
     * Trap focus within modal
     */
    trapFocus(e) {
        if (e.key !== 'Tab') return;

        const modal = e.currentTarget;
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    /**
     * Restore focus to previously focused element
     */
    restoreFocus() {
        if (this.previouslyFocused && this.activeModals.size === 0) {
            this.previouslyFocused.focus();
            this.previouslyFocused = null;
        }
    }

    /**
     * Create and show a dynamic modal
     */
    create(options = {}) {
        const defaultOptions = {
            title: 'Modal',
            content: '',
            buttons: [
                { text: 'Close', action: 'close', class: 'btn-secondary' }
            ],
            size: 'medium',
            closable: true
        };

        const config = { ...defaultOptions, ...options };
        const modalId = Utils.generateId('modal');

        // Create modal element
        const modalElement = this.createModalElement(modalId, config);
        
        // Add to overlay
        this.overlay.appendChild(modalElement);

        // Show modal
        this.show(modalId, config);

        return modalId;
    }

    /**
     * Create modal DOM element
     */
    createModalElement(modalId, config) {
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = `modal modal-${config.size}`;

        const buttonsHtml = config.buttons.map(button => {
            const action = button.action === 'close' ? `data-modal-close` : `data-action="${button.action}"`;
            return `<button class="btn ${button.class || 'btn-primary'}" ${action}>${button.text}</button>`;
        }).join('');

        modal.innerHTML = `
            <div class="modal-header">
                <h3>${Utils.sanitizeHtml(config.title)}</h3>
                ${config.closable ? '<button class="modal-close">&times;</button>' : ''}
            </div>
            <div class="modal-body">
                ${config.content}
            </div>
            <div class="modal-footer">
                ${buttonsHtml}
            </div>
        `;

        // Add button event listeners
        config.buttons.forEach((button, index) => {
            if (button.action !== 'close' && button.callback) {
                const buttonElement = modal.querySelectorAll('.modal-footer .btn')[index];
                buttonElement.addEventListener('click', () => {
                    const result = button.callback();
                    if (result !== false) {
                        this.hide(modalId);
                    }
                });
            }
        });

        return modal;
    }

    /**
     * Show confirmation dialog
     */
    confirm(message, onConfirm, onCancel, options = {}) {
        const defaultOptions = {
            title: 'Confirm',
            content: `<p>${Utils.sanitizeHtml(message)}</p>`,
            buttons: [
                { 
                    text: 'Cancel', 
                    action: 'cancel', 
                    class: 'btn-secondary',
                    callback: () => {
                        if (onCancel) onCancel();
                        return true;
                    }
                },
                { 
                    text: 'Confirm', 
                    action: 'confirm', 
                    class: 'btn-primary',
                    callback: () => {
                        if (onConfirm) onConfirm();
                        return true;
                    }
                }
            ]
        };

        const config = { ...defaultOptions, ...options };
        return this.create(config);
    }

    /**
     * Show alert dialog
     */
    alert(message, onOk, options = {}) {
        const defaultOptions = {
            title: 'Alert',
            content: `<p>${Utils.sanitizeHtml(message)}</p>`,
            buttons: [
                { 
                    text: 'OK', 
                    action: 'ok', 
                    class: 'btn-primary',
                    callback: () => {
                        if (onOk) onOk();
                        return true;
                    }
                }
            ]
        };

        const config = { ...defaultOptions, ...options };
        return this.create(config);
    }

    /**
     * Show prompt dialog
     */
    prompt(message, defaultValue = '', onSubmit, onCancel, options = {}) {
        const inputId = Utils.generateId('input');
        const defaultOptions = {
            title: 'Input Required',
            content: `
                <p>${Utils.sanitizeHtml(message)}</p>
                <div class="form-group">
                    <input type="text" id="${inputId}" class="form-input" value="${Utils.sanitizeHtml(defaultValue)}" placeholder="Enter value...">
                </div>
            `,
            buttons: [
                { 
                    text: 'Cancel', 
                    action: 'cancel', 
                    class: 'btn-secondary',
                    callback: () => {
                        if (onCancel) onCancel();
                        return true;
                    }
                },
                { 
                    text: 'Submit', 
                    action: 'submit', 
                    class: 'btn-primary',
                    callback: () => {
                        const input = document.getElementById(inputId);
                        const value = input ? input.value : '';
                        if (onSubmit) onSubmit(value);
                        return true;
                    }
                }
            ]
        };

        const config = { ...defaultOptions, ...options };
        const modalId = this.create(config);

        // Focus input after modal is shown
        setTimeout(() => {
            const input = document.getElementById(inputId);
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);

        return modalId;
    }

    /**
     * Check if modal is active
     */
    isActive(modalId) {
        return this.activeModals.has(modalId);
    }

    /**
     * Get active modal count
     */
    getActiveCount() {
        return this.activeModals.size;
    }
}

// Create global modal instance
const modal = new Modal();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modal;
} else {
    window.modal = modal;
    window.Modal = Modal;
}
