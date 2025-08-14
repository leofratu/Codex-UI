#!/bin/bash

# Codex UI Startup Script
# This script sets up and starts the Codex UI web application

echo "🚀 Starting Codex UI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if Codex CLI is installed
if ! command -v codex &> /dev/null; then
    echo "❌ Codex CLI is not installed or not in PATH."
    echo "   Please install Codex CLI and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ Codex CLI found at: $(which codex)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
fi

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Start the server
echo "🌐 Starting server on http://localhost:3000"
echo "🔧 Press Ctrl+C to stop the server"
echo ""

# Check if port 3000 is already in use
if lsof -i :3000 &> /dev/null; then
    echo "⚠️  Port 3000 is already in use. Trying to kill existing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start the application
node server.js
