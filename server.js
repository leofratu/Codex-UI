const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const multer = require('multer');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Store active Codex sessions
const activeSessions = new Map();

// Serve the UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Update Codex configuration
app.post('/api/codex/config', async (req, res) => {
    try {
        const { model, reasoningLevel } = req.body;
        
        if (!model || !reasoningLevel) {
            return res.status(400).json({ error: 'Model and reasoning level are required' });
        }
        
        const configPath = path.join(os.homedir(), '.codex', 'config.toml');
        
        // Read existing config or create new one
        let configContent = '';
        try {
            configContent = await fs.readFile(configPath, 'utf8');
        } catch (error) {
            // Config file doesn't exist, create basic structure
            configContent = '# Codex Configuration\n\n';
        }
        
        // Update or add model configuration
        const modelLine = `model = "${model}"`;
        const reasoningLine = `reasoning_effort = "${reasoningLevel}"`;
        
        // Better replacement logic that handles TOML properly
        const lines = configContent.split('\n');
        let modelUpdated = false;
        let reasoningUpdated = false;
        
        // Update existing lines
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('model =')) {
                lines[i] = modelLine;
                modelUpdated = true;
            } else if (lines[i].trim().startsWith('reasoning_effort =')) {
                lines[i] = reasoningLine;
                reasoningUpdated = true;
            }
        }
        
        // Add missing lines at the end
        if (!modelUpdated) {
            lines.push('');
            lines.push(modelLine);
        }
        
        if (!reasoningUpdated) {
            lines.push(reasoningLine);
        }
        
        configContent = lines.join('\n');
        
        // Ensure .codex directory exists
        const codexDir = path.dirname(configPath);
        try {
            await fs.mkdir(codexDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }
        
        // Write updated config
        await fs.writeFile(configPath, configContent, 'utf8');
        
        console.log(`Updated Codex config: ${model} with ${reasoningLevel} reasoning`);
        
        res.json({ 
            success: true, 
            message: 'Configuration updated successfully',
            config: { model, reasoningLevel }
        });
        
    } catch (error) {
        console.error('Error updating Codex config:', error);
        res.status(500).json({ 
            error: 'Failed to update Codex configuration',
            details: error.message 
        });
    }
});

// Get available models (this would query Codex CLI in real implementation)
app.get('/api/models', async (req, res) => {
    try {
        // In a real implementation, you might query the Codex CLI for available models
        const models = [
            { id: 'gpt-5', name: 'GPT-5', description: 'Latest OpenAI model (High reasoning only)' }
        ];
        
        res.json({ models });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// Execute Codex command
app.post('/api/codex/execute', upload.array('files'), async (req, res) => {
    try {
        const {
            message,
            reasoningSummaries = 'auto',
            sandboxMode = 'read-only',
            approvalPolicy = 'never',
            workingDir = process.cwd(),
            sessionId = 'default'
        } = req.body;

        if (!message && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ error: 'Message or files required' });
        }

        // Build Codex CLI arguments - always use GPT-5 with high reasoning
        const args = ['exec', '-m', 'gpt-5', '--config', 'model_reasoning_effort=high'];
        
        console.log('Using Codex with: codex exec -m gpt-5 --config model_reasoning_effort=high');
        
        // Add other runtime parameters
        if (sandboxMode) {
            args.push('-s', sandboxMode);
        }
        
        if (workingDir) {
            args.push('-C', workingDir);
        }
        
        // Handle approval policy through config
        if (approvalPolicy === 'never') {
            args.push('--dangerously-bypass-approvals-and-sandbox');
        } else if (approvalPolicy === 'on-failure') {
            args.push('--full-auto');
        }
        
        // Skip git repo check to avoid errors
        args.push('--skip-git-repo-check');
        
        // Add file attachments
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                args.push('-i', file.path);
            }
        }
        
        // Add the message (ensure it's properly quoted)
        if (message) {
            args.push(message);
        }

        console.log('Executing Codex with args:', args);

        // Execute Codex CLI
        const result = await executeCodex(args);
        
        // Clean up uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    await fs.unlink(file.path);
                } catch (error) {
                    console.warn('Failed to delete uploaded file:', file.path, error);
                }
            }
        }

        // Clean up the response using Gemini
        console.log('Raw Codex stdout:', JSON.stringify(result.stdout));
        console.log('Raw Codex stderr:', JSON.stringify(result.stderr));

        let finalResponse = '';
        try {
            finalResponse = await stripReasoningWithGemini(result.stdout);
        } catch (geminiError) {
            console.error('Gemini processing failed:', geminiError);
        }

        if (!finalResponse) {
            const fallback = cleanCodexResponse(result.stdout);
            finalResponse = fallback.response;
        }

        res.json({
            response: finalResponse || 'No response from Codex',
            thinking: '',
            error: result.stderr,
            exitCode: result.exitCode,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error executing Codex:', error);
        res.status(500).json({ 
            error: 'Failed to execute Codex command',
            details: error.message 
        });
    }
});

// Start interactive Codex session
app.post('/api/codex/session/start', async (req, res) => {
    try {
        const {
            sessionId,
            model = 'gpt-5',
            reasoningLevel = 'medium',
            sandboxMode = 'read-only',
            approvalPolicy = 'never',
            workingDir = process.cwd()
        } = req.body;

        if (activeSessions.has(sessionId)) {
            return res.status(400).json({ error: 'Session already exists' });
        }

        // Start interactive Codex session - always use GPT-5 with high reasoning
        const args = [
            '-m', 'gpt-5',
            '--config', 'model_reasoning_effort=high',
            '-s', sandboxMode,
            '-a', approvalPolicy,
            '-C', workingDir
        ];

        const codexProcess = spawn('codex', args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: workingDir
        });

        const session = {
            process: codexProcess,
            id: sessionId,
            startTime: new Date(),
            config: { model, reasoningLevel, sandboxMode, approvalPolicy, workingDir }
        };

        activeSessions.set(sessionId, session);

        // Handle process events
        codexProcess.on('exit', (code) => {
            console.log(`Codex session ${sessionId} exited with code ${code}`);
            activeSessions.delete(sessionId);
        });

        codexProcess.on('error', (error) => {
            console.error(`Codex session ${sessionId} error:`, error);
            activeSessions.delete(sessionId);
        });

        res.json({
            sessionId,
            status: 'started',
            config: session.config,
            timestamp: session.startTime.toISOString()
        });

    } catch (error) {
        console.error('Error starting Codex session:', error);
        res.status(500).json({ 
            error: 'Failed to start Codex session',
            details: error.message 
        });
    }
});

// Send message to interactive session
app.post('/api/codex/session/:sessionId/message', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { message } = req.body;

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Send message to Codex process
        session.process.stdin.write(message + '\n');

        // For this demo, we'll simulate a response
        // In a real implementation, you'd need to handle the stdout stream
        setTimeout(() => {
            res.json({
                sessionId,
                response: `Processed: ${message}`,
                timestamp: new Date().toISOString()
            });
        }, 1000);

    } catch (error) {
        console.error('Error sending message to session:', error);
        res.status(500).json({ 
            error: 'Failed to send message',
            details: error.message 
        });
    }
});

// End interactive session
app.delete('/api/codex/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Terminate the process
        session.process.kill('SIGTERM');
        activeSessions.delete(sessionId);

        res.json({
            sessionId,
            status: 'terminated',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({ 
            error: 'Failed to terminate session',
            details: error.message 
        });
    }
});

// Get session status
app.get('/api/codex/session/:sessionId/status', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            sessionId,
            status: 'active',
            config: session.config,
            startTime: session.startTime.toISOString(),
            uptime: Date.now() - session.startTime.getTime()
        });

    } catch (error) {
        console.error('Error getting session status:', error);
        res.status(500).json({ 
            error: 'Failed to get session status',
            details: error.message 
        });
    }
});

// List active sessions
app.get('/api/codex/sessions', async (req, res) => {
    try {
        const sessions = Array.from(activeSessions.values()).map(session => ({
            sessionId: session.id,
            status: 'active',
            config: session.config,
            startTime: session.startTime.toISOString(),
            uptime: Date.now() - session.startTime.getTime()
        }));

        res.json({ sessions });

    } catch (error) {
        console.error('Error listing sessions:', error);
        res.status(500).json({ 
            error: 'Failed to list sessions',
            details: error.message 
        });
    }
});

// Use Google Gemini to strip thinking/analysis from Codex output
async function stripReasoningWithGemini(rawText) {
    const apiKey = process.env.api;
    if (!apiKey) {
        console.warn('Gemini API key not configured');
        return '';
    }

    const prompt = `From the input, strip all thinking/analysis and return only the stated answer. Do not summarize or rephrase; copy the answer verbatim. No labels or extra text.\n\n${rawText}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = parts ? parts.map(p => p.text).join('') : '';
    return text.trim();
}

// Execute Codex CLI command
function executeCodex(args) {
    return new Promise((resolve, reject) => {
        console.log('Spawning codex with args:', args);
        const codex = spawn('codex', args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false  // Don't use shell to avoid argument parsing issues
        });

        let stdout = '';
        let stderr = '';

        codex.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        codex.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        codex.on('close', (code) => {
            resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: code
            });
        });

        codex.on('error', (error) => {
            reject(error);
        });

        // Set a timeout to prevent hanging
        setTimeout(() => {
            codex.kill('SIGTERM');
            reject(new Error('Codex command timed out'));
        }, 60000); // 60 second timeout
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
    });
});

// Handle cleanup on exit
process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    
    // Terminate all active sessions
    for (const session of activeSessions.values()) {
        session.process.kill('SIGTERM');
    }
    
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Shutting down server...');
    
    // Terminate all active sessions
    for (const session of activeSessions.values()) {
        session.process.kill('SIGTERM');
    }
    
    process.exit(0);
});

// Clean up Codex CLI response
function cleanCodexResponse(rawResponse) {
    if (!rawResponse) {
        return { response: 'No response from Codex', thinking: '' };
    }

    console.log('Cleaning response:', JSON.stringify(rawResponse));
    
    let text = rawResponse;
    
    // Remove header sections
    text = text.replace(/^\[2025-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\].*$/gm, '');
    text = text.replace(/^--------$/gm, '');
    text = text.replace(/^(workdir|model|provider|approval|sandbox|reasoning effort|reasoning summaries|User instructions|tokens used):.*$/gm, '');
    
    // Clean up extra whitespace but preserve structure
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    
    console.log('After header cleanup:', JSON.stringify(text));
    
    // Separate thinking sections from final response using markers
    const lines = text.split('\n');
    const thinkingLines = [];
    const responseLines = [];
    let inThinking = false;
    let afterCodex = false;

    for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed === 'thinking') {
            inThinking = true;
            continue;
        }

        if (trimmed === 'codex') {
            inThinking = false;
            afterCodex = true;
            continue;
        }

        if (afterCodex) {
            responseLines.push(line);
        } else if (inThinking || trimmed.length > 0) {
            // Treat any pre-codex content as thinking to avoid leaking
            thinkingLines.push(line);
        }
    }

    let thinking = thinkingLines.join('\n');
    let response = responseLines.join('\n');

    // Clean up thinking section - remove ** markers and extra whitespace
    thinking = thinking.replace(/\*\*[^*]*\*\*/g, '').replace(/\n\s*\n/g, '\n').trim();

    // Remove helper prefix if present
    response = response.replace(/^Response that should be displayed to the user\s*:\s*/i, '').trim();

    console.log('Final thinking:', JSON.stringify(thinking));
    console.log('Final response:', JSON.stringify(response));

    return {
        response: response || 'Response received but could not be parsed.',
        thinking: thinking
    };
}

app.listen(PORT, () => {
    console.log(`🚀 Codex UI Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🤖 Ready to interface with Codex CLI`);
});

module.exports = app;
