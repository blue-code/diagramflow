#!/bin/bash

echo "🌊 DiagramFlow - Setup and Run"
echo "================================"
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "⬇️  Installing dependencies..."
pip install -q -r requirements.txt

# Run the application
echo ""
echo "🚀 Starting DiagramFlow v0.3.0..."
echo "   Open http://localhost:5000 in your browser"
echo ""
python backend/app.py
