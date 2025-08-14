# Codex UI - Modern Web Interface for Codex CLI

A beautiful, modern web interface for the Codex CLI that transforms the command-line experience into an intuitive chat-based UI with advanced configuration options.

![Codex UI Screenshot](https://via.placeholder.com/800x400/0d1117/f0f6fc?text=Codex+UI+Chat+Interface)

## ✨ Features

### 🎯 Core Functionality
- **Chat Interface**: Intuitive conversation-style interaction with Codex
- **Model**: Always uses GPT-5 with high reasoning for optimal performance
- **Sandbox Controls**: Multiple security levels (Read-only, Workspace-write, Full-access)
- **Approval Policies**: Control when human approval is required

### 🔧 Advanced Features
- **File Upload**: Drag & drop or select files to attach to conversations
- **Voice Input**: Speech-to-text support for hands-free interaction
- **Syntax Highlighting**: Beautiful code rendering with Prism.js
- **Markdown Support**: Rich text formatting in responses
- **Dark/Light Theme**: Automatic theme switching based on system preferences
- **Session Management**: Persistent conversations with history
- **Export Capabilities**: Save conversations and code snippets

### 🛡️ Security & Configuration
- **Configurable Sandbox**: Multiple isolation levels for safe code execution
- **Working Directory Control**: Specify custom working directories
- **Quick Actions**: One-click Full Auto and Danger modes
- **Settings Persistence**: Your preferences are automatically saved

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Codex CLI installed and configured (`/opt/homebrew/bin/codex`)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone or download the project**:
```bash
cd /Users/main/Desktop/.codex
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start the server**:
```bash
npm start
```

4. **Open your browser**:
Navigate to `http://localhost:3000`

### Development Mode

For development with auto-reload:
```bash
npm run dev
```

## 🎛️ Configuration

### Model & Reasoning
Codex UI uses **GPT-5 with high reasoning** for all interactions. Model routing is fixed for optimal performance.

### Thinking Progress Indicator
- **Real-time timer**: Shows elapsed thinking time
- **Progress bar**: Visual indicator of completion
- **Time estimates**: Remaining time based on reasoning level
- **Smart estimates**: Adjusts if taking longer than expected

### Security Settings
- **Read-only**: Safe browsing and analysis only
- **Workspace-write**: Can modify files in workspace
- **Danger-full-access**: ⚠️ Full system access (use with caution)

### Approval Policies
- **Untrusted**: Only run safe commands automatically
- **On-failure**: Ask for approval when commands fail
- **On-request**: Model decides when to ask
- **Never**: Run all commands without asking

## 💡 Usage Examples

### Basic Chat
Simply type your question or request in the chat input and press Enter:
```
"Help me debug this Python function"
"Create a REST API for user management"
"Explain how React hooks work"
```

### File Upload
1. Click the paperclip icon or drag files into the upload area
2. Supported formats: `.js`, `.py`, `.html`, `.css`, `.json`, etc.
3. Files are automatically attached to your next message

### Voice Input
1. Click the microphone icon
2. Speak your request clearly
3. The speech will be converted to text automatically

### Quick Actions
- **Full Auto Mode**: Enables `workspace-write` sandbox with `on-failure` approval
- **Danger Mode**: ⚠️ Removes all safety restrictions

## 🔧 API Endpoints

The server exposes several REST endpoints:

### Execute Codex Command
```
POST /api/codex/execute
```
Execute a one-off Codex command with files and configuration.

### Session Management
```
POST /api/codex/session/start      # Start interactive session
POST /api/codex/session/:id/message # Send message to session
GET  /api/codex/session/:id/status  # Get session status
DELETE /api/codex/session/:id       # End session
```

### Utility Endpoints
```
GET /api/models    # List available models
GET /health        # Health check
```

## 🎨 Customization

### Themes
The UI supports automatic dark/light theme switching based on your system preferences. You can also manually override this in Settings.

### Configuration
All settings are automatically saved to localStorage and persist between sessions:
- Security settings
- Theme preferences
- UI options

## 🐛 Troubleshooting

### Common Issues

**"Codex command not found"**
- Ensure Codex CLI is installed: `which codex`
- Check if it's in your PATH
- Verify installation: `codex --version`

**"API connection failed"**
- Check if the server is running on port 3000
- Verify no firewall is blocking the connection
- Try restarting the server

**"File upload not working"**
- Check file size (10MB limit)
- Ensure supported file format
- Verify browser permissions

### Debug Mode
Enable browser developer tools to see detailed logs and network requests.

## 📁 Project Structure

```
.codex/
├── index.html          # Main UI page
├── styles.css          # UI styling
├── app.js             # Frontend JavaScript
├── server.js          # Backend API server
├── package.json       # Node.js dependencies
├── README.md          # This file
├── uploads/           # Temporary file storage
└── log/              # Application logs
    └── codex-tui.log
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [OpenAI Codex](https://openai.com/codex) - The underlying AI model
- [Cursor IDE](https://cursor.sh) - AI-powered code editor

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review the browser console for errors
3. Check the server logs
4. Open an issue on GitHub

---

**Note**: This UI interfaces with the existing Codex CLI tool and requires it to be properly installed and configured on your system.
