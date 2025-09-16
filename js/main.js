/**
 * LinkedIn RMIS Contact Search - Frontend JavaScript
 * Handles form submission to N8N workflow automation
 */

class LinkedInSearchApp {
    constructor() {
        this.webhookUrl = 'https://n8n.srv908146.hstgr.cloud/webhook/RMISLinkedin';
        this.form = document.getElementById('linkedinSearchForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.statusMessage = document.getElementById('statusMessage');
        this.resultsSection = document.getElementById('resultsSection');
        this.searchSummary = document.getElementById('searchSummary');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedData();
        console.log('LinkedIn Search App initialized');
    }

    bindEvents() {
        // Form submission
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Form reset
        this.form.addEventListener('reset', this.handleReset.bind(this));
        
        // Auto-save form data as user types
        this.form.addEventListener('input', this.debounce(this.saveFormData.bind(this), 1000));
        
        // Real-time validation
        const inputs = this.form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        const formData = this.getFormData();
        
        // Show loading state
        this.setLoadingState(true);
        this.showStatus('info', 'Submitting search request to LinkedIn automation workflow...', 'fas fa-spinner fa-spin');
        
        try {
            const response = await this.submitToN8N(formData);
            await this.handleSubmissionSuccess(formData, response);
        } catch (error) {
            console.error('Submission error:', error);
            this.handleSubmissionError(error);
        } finally {
            this.setLoadingState(false);
        }
    }

    async submitToN8N(formData) {
        const payload = {
            companies: formData.companies,
            keywords: formData.keywords,
            salesRep: formData.salesRep,
            region: formData.region,
            timestamp: new Date().toISOString(),
            source: 'web_frontend'
        };

        console.log('Submitting to N8N:', payload);

        const response = await fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.text();
        console.log('N8N Response:', responseData);
        
        return {
            status: response.status,
            statusText: response.statusText,
            data: responseData
        };
    }

    async handleSubmissionSuccess(formData, response) {
        // Clear saved form data
        this.clearSavedData();
        
        // Show success message
        this.showStatus('success', 
            'LinkedIn search automation started successfully! The workflow is now processing your request.', 
            'fas fa-check-circle'
        );
        
        // Show results summary
        this.showResultsSummary(formData);
        
        // Optional: Reset form after successful submission
        setTimeout(() => {
            if (confirm('Search submitted successfully! Would you like to start a new search?')) {
                this.form.reset();
                this.hideResults();
            }
        }, 3000);
    }

    handleSubmissionError(error) {
        let errorMessage = 'Failed to submit search request. Please try again.';
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Network error: Unable to connect to the automation service. Please check your internet connection and try again.';
        } else if (error.message.includes('HTTP')) {
            errorMessage = `Server error: ${error.message}. Please contact support if this persists.`;
        }
        
        this.showStatus('error', errorMessage, 'fas fa-exclamation-circle');
    }

    getFormData() {
        const formData = new FormData(this.form);
        
        return {
            companies: formData.get('companies').trim(),
            keywords: formData.get('keywords').trim(),
            salesRep: formData.get('salesRep').trim(),
            region: formData.get('region')
        };
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input[required], textarea[required], select[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        // Additional validation for text areas
        const companies = document.getElementById('companies');
        const keywords = document.getElementById('keywords');
        
        if (companies.value.trim().split('\\n').filter(line => line.trim()).length === 0) {
            this.showFieldError(companies, 'Please enter at least one company name');
            isValid = false;
        }
        
        if (keywords.value.trim().split('\\n').filter(line => line.trim()).length === 0) {
            this.showFieldError(keywords, 'Please enter at least one search keyword');
            isValid = false;
        }
        
        return isValid;
    }

    validateField(field) {
        const value = field.value.trim();
        
        if (field.hasAttribute('required') && !value) {
            this.showFieldError(field, 'This field is required');
            return false;
        }
        
        // Email validation for sales rep if it looks like an email
        if (field.id === 'salesRep' && value.includes('@')) {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(value)) {
                this.showFieldError(field, 'Please enter a valid email address or name');
                return false;
            }
        }
        
        this.clearFieldError(field);
        return true;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.style.borderColor = '#dc3545';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '0.25rem';
        errorDiv.textContent = message;
        
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(field) {
        field.style.borderColor = '';
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    showStatus(type, message, icon = '') {
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.innerHTML = `
            ${icon ? `<i class="${icon}"></i>` : ''}
            ${message}
        `;
        this.statusMessage.classList.remove('hidden');
        
        // Auto-hide non-error messages after 10 seconds
        if (type !== 'error') {
            setTimeout(() => {
                this.hideStatus();
            }, 10000);
        }
    }

    hideStatus() {
        this.statusMessage.classList.add('hidden');
    }

    showResultsSummary(formData) {
        const companiesCount = formData.companies.split('\\n').filter(line => line.trim()).length;
        const keywordsCount = formData.keywords.split(/[\\n,]/).filter(item => item.trim()).length;
        const totalCombinations = companiesCount * keywordsCount;
        
        this.searchSummary.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">Companies to search:</span>
                <span class="summary-value">${companiesCount}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Search keywords:</span>
                <span class="summary-value">${keywordsCount}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Total search combinations:</span>
                <span class="summary-value">${totalCombinations}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Sales representative:</span>
                <span class="summary-value">${formData.salesRep}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Target region:</span>
                <span class="summary-value">${formData.region}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Estimated completion:</span>
                <span class="summary-value">${this.calculateEstimatedTime(totalCombinations)}</span>
            </div>
        `;
        
        this.resultsSection.classList.remove('hidden');
    }

    calculateEstimatedTime(combinations) {
        // Each combination takes ~10-15 seconds with delays to avoid CAPTCHA
        const averageTimePerCombination = 12; // seconds
        const totalSeconds = combinations * averageTimePerCombination;
        
        const minutes = Math.ceil(totalSeconds / 60);
        
        if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes > 0 ? `${remainingMinutes} min` : ''}`;
        }
    }

    hideResults() {
        this.resultsSection.classList.add('hidden');
    }

    setLoadingState(loading) {
        this.submitBtn.disabled = loading;
        
        if (loading) {
            this.submitBtn.classList.add('loading');
            this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        } else {
            this.submitBtn.classList.remove('loading');
            this.submitBtn.innerHTML = '<i class="fas fa-rocket"></i> Start LinkedIn Search';
        }
    }

    handleReset() {
        this.hideStatus();
        this.hideResults();
        this.clearSavedData();
        
        // Clear any field errors
        const fieldErrors = this.form.querySelectorAll('.field-error');
        fieldErrors.forEach(error => error.remove());
        
        // Reset field border colors
        const fields = this.form.querySelectorAll('input, textarea, select');
        fields.forEach(field => {
            field.style.borderColor = '';
        });
    }

    // Auto-save functionality
    saveFormData() {
        const formData = this.getFormData();
        localStorage.setItem('linkedinSearchFormData', JSON.stringify(formData));
    }

    loadSavedData() {
        try {
            const savedData = localStorage.getItem('linkedinSearchFormData');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                // Populate form fields
                Object.keys(data).forEach(key => {
                    const field = document.getElementById(key);
                    if (field && data[key]) {
                        field.value = data[key];
                    }
                });
                
                console.log('Loaded saved form data');
            }
        } catch (error) {
            console.log('No saved data to load:', error.message);
        }
    }

    clearSavedData() {
        localStorage.removeItem('linkedinSearchFormData');
    }

    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LinkedInSearchApp();
});

// Add some helpful utilities to window for debugging
window.LinkedInSearchUtils = {
    testWebhook: async function() {
        const testData = {
            companies: 'Microsoft\\nGoogle',
            keywords: 'Risk Manager\\nInsurance Manager',
            salesRep: 'Test Sales Rep',
            region: 'Global'
        };
        
        console.log('Testing webhook with:', testData);
        
        try {
            const response = await fetch('https://n8n.srv908146.hstgr.cloud/webhook/RMISLinkedin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData)
            });
            
            console.log('Test response:', await response.text());
        } catch (error) {
            console.error('Test failed:', error);
        }
    }
};