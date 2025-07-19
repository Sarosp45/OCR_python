/**
 * API Service
 * Handles all HTTP requests to the backend API
 */

class APIService {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.timeout = CONFIG.API_TIMEOUT;
        this.retryAttempts = CONFIG.API_RETRY_ATTEMPTS;
        this.retryDelay = CONFIG.API_RETRY_DELAY;
        
        // Request interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        CONFIG.log('API Service initialized with base URL:', this.baseURL);
    }
    
    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    
    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    
    /**
     * Create request options
     */
    createRequestOptions(options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.timeout,
            ...options
        };
        
        // Apply request interceptors
        return this.requestInterceptors.reduce((opts, interceptor) => {
            return interceptor(opts) || opts;
        }, defaultOptions);
    }
    
    /**
     * Handle fetch with timeout
     */
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    
    /**
     * Make HTTP request with retry logic
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const requestOptions = this.createRequestOptions(options);
        
        CONFIG.log(`API Request: ${requestOptions.method} ${url}`);
        
        let lastError;
        
        for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await this.fetchWithTimeout(url, requestOptions);
                
                // Apply response interceptors
                const processedResponse = this.responseInterceptors.reduce((resp, interceptor) => {
                    return interceptor(resp) || resp;
                }, response);
                
                if (!processedResponse.ok) {
                    const errorData = await this.parseResponse(processedResponse);
                    throw new APIError(
                        errorData.error || `HTTP ${processedResponse.status}`,
                        processedResponse.status,
                        errorData
                    );
                }
                
                const data = await this.parseResponse(processedResponse);
                CONFIG.log(`API Response: ${processedResponse.status} ${requestOptions.method} ${url}`);
                return data;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.retryAttempts && this.shouldRetry(error)) {
                    CONFIG.warn(`API request failed, retrying in ${this.retryDelay}ms (attempt ${attempt + 1}/${this.retryAttempts + 1})`);
                    await this.delay(this.retryDelay);
                    continue;
                }
                
                break;
            }
        }
        
        CONFIG.error('API request failed:', lastError);
        throw lastError;
    }
    
    /**
     * Parse response based on content type
     */
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }
    
    /**
     * Check if error should trigger a retry
     */
    shouldRetry(error) {
        if (error instanceof APIError) {
            // Don't retry client errors (4xx)
            return error.status >= 500;
        }
        
        // Retry network errors
        return error.message.includes('timeout') || 
               error.message.includes('network') ||
               error.message.includes('fetch');
    }
    
    /**
     * Delay utility for retries
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, {
            method: 'GET'
        });
    }
    
    /**
     * POST request
     */
    async post(endpoint, data = null, options = {}) {
        const requestOptions = {
            method: 'POST',
            ...options
        };
        
        if (data instanceof FormData) {
            // Don't set Content-Type for FormData, let browser set it
            delete requestOptions.headers?.['Content-Type'];
            requestOptions.body = data;
        } else if (data) {
            requestOptions.body = JSON.stringify(data);
        }
        
        return this.request(endpoint, requestOptions);
    }
    
    /**
     * PUT request
     */
    async put(endpoint, data = null, options = {}) {
        const requestOptions = {
            method: 'PUT',
            ...options
        };
        
        if (data instanceof FormData) {
            delete requestOptions.headers?.['Content-Type'];
            requestOptions.body = data;
        } else if (data) {
            requestOptions.body = JSON.stringify(data);
        }
        
        return this.request(endpoint, requestOptions);
    }
    
    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            method: 'DELETE',
            ...options
        });
    }
    
    /**
     * Upload file with progress tracking
     */
    async uploadFile(endpoint, file, data = {}, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add additional data
        Object.keys(data).forEach(key => {
            formData.append(key, data[key]);
        });
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve(xhr.responseText);
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new APIError(
                            errorData.error || `HTTP ${xhr.status}`,
                            xhr.status,
                            errorData
                        ));
                    } catch (error) {
                        reject(new APIError(`HTTP ${xhr.status}`, xhr.status));
                    }
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during file upload'));
            });
            
            xhr.addEventListener('timeout', () => {
                reject(new Error('File upload timeout'));
            });
            
            xhr.timeout = CONFIG.UPLOAD_TIMEOUT;
            xhr.open('POST', `${this.baseURL}${endpoint}`);
            xhr.send(formData);
        });
    }
    
    /**
     * Load image with retry logic
     */
    async loadImage(filename) {
        const urls = CONFIG.getImageUrls(filename);
        let lastError;
        
        for (let attempt = 0; attempt < CONFIG.IMAGE_RETRY_ATTEMPTS; attempt++) {
            for (const url of urls) {
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    if (response.ok) {
                        return url;
                    }
                } catch (error) {
                    lastError = error;
                    CONFIG.warn(`Failed to load image from ${url}:`, error.message);
                }
            }
            
            if (attempt < CONFIG.IMAGE_RETRY_ATTEMPTS - 1) {
                await this.delay(CONFIG.IMAGE_RETRY_DELAY);
            }
        }
        
        throw new Error(`Failed to load image ${filename} after ${CONFIG.IMAGE_RETRY_ATTEMPTS} attempts`);
    }
    
    /**
     * Check API health
     */
    async checkHealth() {
        try {
            const response = await this.get(CONFIG.ENDPOINTS.HEALTH);
            return { status: 'healthy', data: response };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Create and export API instance
const api = new APIService();

// Add default request interceptor for debugging
if (CONFIG.DEBUG) {
    api.addRequestInterceptor((options) => {
        CONFIG.log('Request options:', options);
        return options;
    });
    
    api.addResponseInterceptor((response) => {
        CONFIG.log('Response:', response.status, response.statusText);
        return response;
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { api, APIError };
} else {
    window.api = api;
    window.APIError = APIError;
}
