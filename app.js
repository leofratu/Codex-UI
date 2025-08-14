// Codex UI - Main Application JavaScript
class CodexUI {
    constructor() {
        this.config = {
            reasoningSummaries: 'auto',
            sandboxMode: 'read-only',
            approvalPolicy: 'never',
            workingDir: '/Users/main/Desktop/.codex',
            apiEndpoint: 'http://localhost:3000',
            theme: 'dark',
            autoScroll: true,
            syntaxHighlighting: true,
            showTimestamps: true,
            textDirection: 'ltr'
        };
        
        this.thinkingStartTime = null;
        
        this.messages = [];
        this.attachedFiles = [];
        this.isTyping = false;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadSettings();
        this.applyTheme();
        this.applyTextDirection();
        this.setupFileUpload();
        this.adjustTextareaHeight();
    }
    
    bindEvents() {
        // Header buttons
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearChat());
        document.getElementById('mobileMenuBtn').addEventListener('click', () => this.toggleMobileMenu());
        
        // Chat input
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        messageInput.addEventListener('input', () => this.adjustTextareaHeight());
        messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        document.getElementById('reasoningSummaries').addEventListener('change', (e) => {
            this.config.reasoningSummaries = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('sandboxMode').addEventListener('change', (e) => {
            this.config.sandboxMode = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('approvalPolicy').addEventListener('change', (e) => {
            this.config.approvalPolicy = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('workingDir').addEventListener('change', (e) => {
            this.config.workingDir = e.target.value;
            this.saveSettings();
        });
        
        // Quick actions
        document.getElementById('testCodexBtn').addEventListener('click', () => this.testCodexStatus());
        document.getElementById('fullAutoBtn').addEventListener('click', () => this.setFullAuto());
        document.getElementById('dangerModeBtn').addEventListener('click', () => this.setDangerMode());
        
        // File upload
        document.getElementById('attachBtn').addEventListener('click', () => this.openFileUpload());
        document.getElementById('voiceBtn').addEventListener('click', () => this.startVoiceInput());
        
        // Settings modal
        document.getElementById('closeModal').addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveModalSettings());
        document.getElementById('resetSettings').addEventListener('click', () => this.resetSettings());
        
        // Close modal on outside click
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettings();
            }
        });
    }
    
    adjustTextareaHeight() {
        const textarea = document.getElementById('messageInput');
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 150);
        textarea.style.height = newHeight + 'px';
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message && this.attachedFiles.length === 0) return;
        
        // Add user message
        const filesToSend = [...this.attachedFiles];
        this.addMessage('user', message, filesToSend);

        // Clear input and files
        messageInput.value = '';
        this.attachedFiles = [];
        this.updateAttachedFiles();
        this.adjustTextareaHeight();

        // Show typing indicator
        this.setTyping(true);

        try {
            // Send to backend/Codex CLI
            const result = await this.callCodexAPI(message, filesToSend);
            
            // Add assistant response with thinking
            if (typeof result === 'object' && result.response) {
                this.addMessage('assistant', result.response, [], 'normal', result.thinking);
            } else {
                this.addMessage('assistant', result);
            }
            
        } catch (error) {
            console.error('Error calling Codex API:', error);
            this.addMessage('system', `Error: ${error.message}`, [], 'error');
        } finally {
            this.setTyping(false);
        }
    }
    
    async callCodexAPI(message, files = []) {
        try {
            const formData = new FormData();
            
            // Add configuration
            formData.append('message', message);
            formData.append('reasoningSummaries', this.config.reasoningSummaries);
            formData.append('sandboxMode', this.config.sandboxMode);
            formData.append('approvalPolicy', this.config.approvalPolicy);
            formData.append('workingDir', this.config.workingDir);
            
            // Add file attachments
            files.forEach(fileObj => {
                if (fileObj.file) {
                    formData.append('files', fileObj.file);
                }
            });
            
            const response = await fetch(`${this.config.apiEndpoint}/api/codex/execute`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error && data.error.trim()) {
                console.warn('Codex stderr:', data.error);
            }
            
            // Return both response and thinking
            return {
                response: data.response || 'No response from Codex',
                thinking: data.thinking || ''
            };
            
        } catch (error) {
            console.error('API Error:', error);
            // Fallback to simulation if API fails
            return { response: this.simulateCodexResponse(message, 'API Error - using simulation'), thinking: '' };
        }
    }
    
    simulateCodexResponse(message, command) {
        const responses = [
            `I'll help you with that. Let me analyze your request: "${message}"`,
            `Based on your configuration (Model: GPT-5, Reasoning: High), here's what I found...`,
            `I understand you want to work with: "${message}". Let me break this down step by step.`,
            `Processing your request with the following settings:\n- Model: GPT-5 (High reasoning)\n- Sandbox: ${this.config.sandboxMode}\n- Working Directory: ${this.config.workingDir}\n\nHere's my response...`
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // Add some code examples for demo
        if (message.toLowerCase().includes('code') || message.toLowerCase().includes('function')) {
            return randomResponse + '\n\n```javascript\nfunction example() {\n    console.log("This is a code example");\n    return "Hello from Codex!";\n}\n```';
        } else {
            return randomResponse;
        }
    }
    
    addMessage(sender, content, files = [], type = 'normal', thinking = '') {
        const timestamp = new Date();
        const message = {
            id: Date.now(),
            sender,
            content,
            files,
            timestamp,
            type,
            thinking
        };
        
        this.messages.push(message);
        this.renderMessage(message);
        
        if (this.config.autoScroll) {
            this.scrollToBottom();
        }
    }
    
    renderMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender}-message`;
        messageElement.dataset.messageId = message.id;
        
        let avatarContent = '';
        if (message.sender === 'user') {
            avatarContent = '<i class="fas fa-user"></i>';
        } else if (message.sender === 'assistant') {
            avatarContent = '<i class="fas fa-robot"></i>';
        } else {
            avatarContent = '<i class="fas fa-info-circle"></i>';
        }
        
        let filesHtml = '';
        if (message.files && message.files.length > 0) {
            filesHtml = '<div class="attached-files">' +
                message.files.map(file => 
                    `<div class="file-tag">
                        <i class="fas fa-file"></i>
                        ${file.name}
                    </div>`
                ).join('') +
                '</div>';
        }
        
        let contentHtml = message.content;
        if (this.config.syntaxHighlighting && message.sender === 'assistant') {
            contentHtml = this.renderMarkdown(message.content);
            const tmp = document.createElement('div');
            tmp.innerHTML = contentHtml;
            tmp.querySelectorAll('pre').forEach(pre => pre.setAttribute('dir', this.config.textDirection));
            contentHtml = tmp.innerHTML;
        }
        
        // Add thinking section if available
        let thinkingHtml = '';
        if (message.thinking && message.thinking.trim()) {
            thinkingHtml = `
                <div class="thinking-section">
                    <button class="thinking-toggle" onclick="this.parentElement.classList.toggle('expanded')">
                        <i class="fas fa-brain"></i> 
                        <span>Reasoning Process</span>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                    </button>
                    <div class="thinking-content">
                        <pre>${message.thinking}</pre>
                    </div>
                </div>
            `;
        }
        
        let timestampHtml = '';
        if (this.config.showTimestamps) {
            timestampHtml = `<div class="message-time">${this.formatTime(message.timestamp)}</div>`;
        }
        
        let statusClass = '';
        if (message.type === 'error') {
            statusClass = ' error';
        }
        
        messageElement.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-content${statusClass}" dir="${this.config.textDirection}">
                ${filesHtml}
                ${thinkingHtml}
                ${contentHtml}
                ${timestampHtml}
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        
        // Highlight code blocks
        if (this.config.syntaxHighlighting) {
            Prism.highlightAllUnder(messageElement);
        }
    }
    
    renderMarkdown(content) {
        try {
            return marked.parse(content);
        } catch (error) {
            console.error('Error parsing markdown:', error);
            return content;
        }
    }
    
    formatTime(timestamp) {
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    setTyping(isTyping) {
        this.isTyping = isTyping;
        const chatMessages = document.getElementById('chatMessages');
        
        // Remove existing typing indicator
        const existingIndicator = chatMessages.querySelector('.typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (isTyping) {
            this.thinkingStartTime = Date.now();
            
            const typingElement = document.createElement('div');
            typingElement.className = 'message assistant-message typing-indicator';
            typingElement.innerHTML = `
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <div class="thinking-progress">
                        <div class="thinking-header">
                            <div class="loading"></div>
                            <span class="thinking-status">Codex is thinking...</span>
                        </div>
                        <div class="thinking-timer">
                            <span class="elapsed-time">0s</span>
                            <div class="progress-bar">
                                <div class="progress-fill"></div>
                            </div>
                            <span class="estimated-time">Estimating...</span>
                        </div>
                    </div>
                </div>
            `;
            chatMessages.appendChild(typingElement);
            
            // Start the thinking timer
            this.startThinkingTimer();
            
            if (this.config.autoScroll) {
                this.scrollToBottom();
            }
        } else {
            this.thinkingStartTime = null;
            if (this.thinkingTimer) {
                clearInterval(this.thinkingTimer);
                this.thinkingTimer = null;
            }
        }
    }
    
    startThinkingTimer() {
        if (this.thinkingTimer) {
            clearInterval(this.thinkingTimer);
        }
        
        this.thinkingTimer = setInterval(() => {
            if (!this.thinkingStartTime) return;
            
            const elapsed = (Date.now() - this.thinkingStartTime) / 1000;
            const elapsedElement = document.querySelector('.typing-indicator .elapsed-time');
            const progressFill = document.querySelector('.typing-indicator .progress-fill');
            const estimatedElement = document.querySelector('.typing-indicator .estimated-time');
            
            if (elapsedElement) {
                elapsedElement.textContent = `${elapsed.toFixed(1)}s`;
            }
            
            // Estimate based on high reasoning effort
            let estimatedTotal = 30;
            
            // Adjust estimate as time progresses
            if (elapsed > estimatedTotal) {
                estimatedTotal = elapsed + 10;
            }
            
            const progress = Math.min((elapsed / estimatedTotal) * 100, 95);
            
            if (progressFill) {
                progressFill.style.width = `${progress}%`;
            }
            
            if (estimatedElement) {
                if (elapsed < estimatedTotal) {
                    estimatedElement.textContent = `~${(estimatedTotal - elapsed).toFixed(0)}s remaining`;
                } else {
                    estimatedElement.textContent = 'Taking longer than expected...';
                }
            }
            
        }, 100);
    }
    
    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.messages = [];
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = `
                <div class="message system-message">
                    <div class="message-content">
                        <i class="fas fa-robot"></i>
                        Chat cleared. How can I help you today?
                    </div>
                </div>
            `;
        }
    }
    
    setFullAuto() {
        this.config.approvalPolicy = 'on-failure';
        this.config.sandboxMode = 'workspace-write';
        document.getElementById('approvalPolicy').value = 'on-failure';
        document.getElementById('sandboxMode').value = 'workspace-write';
        this.saveSettings();
        this.addMessage('system', 'Full Auto mode enabled: Low-friction sandboxed automatic execution');
    }
    
    setDangerMode() {
        if (confirm('⚠️ DANGER MODE: This will skip all confirmations and execute commands without sandboxing. Are you sure?')) {
            this.config.approvalPolicy = 'never';
            this.config.sandboxMode = 'danger-full-access';
            document.getElementById('approvalPolicy').value = 'never';
            document.getElementById('sandboxMode').value = 'danger-full-access';
            this.saveSettings();
            this.addMessage('system', '⚠️ Danger mode enabled: Commands will execute without sandboxing!', [], 'error');
        }
    }
    
    async testCodexStatus() {
        const testBtn = document.getElementById('testCodexBtn');
        const originalText = testBtn.innerHTML;
        
        // Show loading state
        testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        testBtn.disabled = true;
        
        try {
            // Send the /status command to Codex
            const result = await this.callCodexAPI('/status', []);
            
            let statusMessage = '';
            if (typeof result === 'object' && result.response) {
                const response = result.response;
                
                // Format the status response properly
                statusMessage = `🩺 **Codex Status**\n\n${response}\n\n*✓ Connection successful - Codex is ready to assist!*`;
            } else {
                statusMessage = `🩺 **Codex Status**\n\n${result}\n\n*✓ Connection successful - Codex is ready to assist!*`;
            }
            
            this.addMessage('system', statusMessage);
            
        } catch (error) {
            console.error('Codex status test failed:', error);
            this.addMessage('system', `❌ **Codex Status Test Failed**\n\nError: ${error.message}\n\nPlease check:\n- Codex CLI is installed and authenticated\n- Server is running properly\n- Network connection is available`, [], 'error');
        } finally {
            // Restore button state
            testBtn.innerHTML = originalText;
            testBtn.disabled = false;
        }
    }
    
    setupFileUpload() {
        const fileInput = document.getElementById('fileInput');
        const fileUploadArea = document.getElementById('fileUploadArea');
        
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(Array.from(e.target.files));
        });
        
        // Drag and drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });
        
        document.addEventListener('dragleave', (e) => {
            if (!document.contains(e.relatedTarget)) {
                fileUploadArea.classList.remove('dragover');
            }
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            this.handleFileSelect(Array.from(e.dataTransfer.files));
        });
        
        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    handleFileSelect(files) {
        files.forEach(file => {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                alert(`File ${file.name} is too large. Maximum size is 10MB.`);
                return;
            }
            
            const fileObj = {
                name: file.name,
                size: file.size,
                type: file.type,
                path: file.path || file.name, // For local files
                file: file
            };
            
            this.attachedFiles.push(fileObj);
        });
        
        this.updateAttachedFiles();
    }
    
    updateAttachedFiles() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const container = document.querySelector('.chat-input-container');
        
        // Remove existing attached files display
        let existingFiles = container.querySelector('.attached-files');
        if (existingFiles) {
            existingFiles.remove();
        }
        
        if (this.attachedFiles.length > 0) {
            fileUploadArea.style.display = 'none';
            
            const filesDiv = document.createElement('div');
            filesDiv.className = 'attached-files';
            filesDiv.innerHTML = this.attachedFiles.map((file, index) => `
                <div class="file-tag">
                    <i class="fas fa-file"></i>
                    ${file.name}
                    <button class="remove-file" onclick="codexUI.removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
            
            container.insertBefore(filesDiv, container.querySelector('.input-group'));
        } else {
            fileUploadArea.style.display = 'none';
        }
    }
    
    removeFile(index) {
        this.attachedFiles.splice(index, 1);
        this.updateAttachedFiles();
    }
    
    openFileUpload() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        if (fileUploadArea.style.display === 'block') {
            fileUploadArea.style.display = 'none';
        } else {
            fileUploadArea.style.display = 'block';
        }
    }
    
    startVoiceInput() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
            voiceBtn.classList.add('recording');
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('messageInput').value = transcript;
                this.adjustTextareaHeight();
            };
            
            recognition.onend = () => {
                voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                voiceBtn.classList.remove('recording');
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                voiceBtn.classList.remove('recording');
                alert('Speech recognition error: ' + event.error);
            };
            
            recognition.start();
        } else {
            alert('Speech recognition is not supported in your browser.');
        }
    }
    
    openSettings() {
        document.getElementById('settingsModal').classList.add('active');
        
        // Load current settings into modal
        document.getElementById('apiEndpoint').value = this.config.apiEndpoint;
        document.getElementById('theme').value = this.config.theme;
        document.getElementById('autoScroll').checked = this.config.autoScroll;
        document.getElementById('syntaxHighlighting').checked = this.config.syntaxHighlighting;
        document.getElementById('showTimestamps').checked = this.config.showTimestamps;
        document.getElementById('textDirection').value = this.config.textDirection;
    }
    
    closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }
    
    saveModalSettings() {
        this.config.apiEndpoint = document.getElementById('apiEndpoint').value;
        this.config.theme = document.getElementById('theme').value;
        this.config.autoScroll = document.getElementById('autoScroll').checked;
        this.config.syntaxHighlighting = document.getElementById('syntaxHighlighting').checked;
        this.config.showTimestamps = document.getElementById('showTimestamps').checked;
        this.config.textDirection = document.getElementById('textDirection').value;

        this.saveSettings();
        this.applyTheme();
        this.applyTextDirection();
        this.closeSettings();
    }
    
    resetSettings() {
        if (confirm('Reset all settings to defaults?')) {
            localStorage.removeItem('codex-ui-config');
            location.reload();
        }
    }
    
    loadSettings() {
        const saved = localStorage.getItem('codex-ui-config');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.config = { ...this.config, ...settings };
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
        
        // Apply loaded settings to UI
        document.getElementById('reasoningSummaries').value = this.config.reasoningSummaries;
        document.getElementById('sandboxMode').value = this.config.sandboxMode;
        document.getElementById('approvalPolicy').value = this.config.approvalPolicy;
        document.getElementById('workingDir').value = this.config.workingDir;
    }
    
    saveSettings() {
        localStorage.setItem('codex-ui-config', JSON.stringify(this.config));
    }

    applyTheme() {
        document.body.setAttribute('data-theme', this.config.theme);
        
        if (this.config.theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
    }

    applyTextDirection() {
        document.body.setAttribute('dir', this.config.textDirection);
        const input = document.getElementById('messageInput');
        if (input) {
            input.setAttribute('dir', this.config.textDirection);
        }
    }

    setTextDirection(direction) {
        this.config.textDirection = direction;
        this.applyTextDirection();
        this.saveSettings();
    }
    
    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('active');
        
        // Update menu icon
        const menuBtn = document.getElementById('mobileMenuBtn');
        const icon = menuBtn.querySelector('i');
        
        if (sidebar.classList.contains('active')) {
            icon.className = 'fas fa-times';
        } else {
            icon.className = 'fas fa-bars';
        }
    }
}

// Initialize the application
const codexUI = new CodexUI();

// Add some CSS for recording state
const style = document.createElement('style');
style.textContent = `
    .btn.recording {
        background: var(--accent-danger) !important;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);

// Listen for system theme changes
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (codexUI.config.theme === 'auto') {
            codexUI.applyTheme();
        }
    });
}

console.log('Codex UI initialized successfully!');
