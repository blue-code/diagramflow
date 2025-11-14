#!/bin/bash

# DDL Parser Test Script
# This script helps test the Oracle DDL parsing functionality

echo "========================================"
echo "  DDL Parser Test"
echo "========================================"
echo ""

# Check if server is running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✓ Server is running on port 8000"
    echo ""
    echo "Test options:"
    echo "  1. Open standalone test page: file://$(pwd)/test_parser.html"
    echo "  2. Open main application: http://localhost:8000"
    echo ""
    echo "Opening test page in browser..."
    open test_parser.html 2>/dev/null || echo "Please open test_parser.html manually"
else
    echo "✗ Server is not running on port 8000"
    echo ""
    echo "Starting server..."
    PORT=8000 python backend/app.py &
    SERVER_PID=$!
    echo "Server started with PID: $SERVER_PID"
    echo "Waiting for server to start..."
    sleep 3
    echo ""
    echo "Test options:"
    echo "  1. Open standalone test page: file://$(pwd)/test_parser.html"
    echo "  2. Open main application: http://localhost:8000"
    echo ""
    echo "Opening test page in browser..."
    open test_parser.html 2>/dev/null || echo "Please open test_parser.html manually"
fi

echo ""
echo "========================================"
echo "  Test Instructions"
echo "========================================"
echo ""
echo "Standalone Test (test_parser.html):"
echo "  1. Click 'Test Split Only' to see how DDL is split"
echo "  2. Click 'Parse DDL' to see full parsing result"
echo "  3. Check console output for details"
echo ""
echo "Main Application Test (http://localhost:8000):"
echo "  1. Click '📥 DDL Import' button"
echo "  2. Paste the Oracle DDL"
echo "  3. Click 'Import'"
echo "  4. Open browser console (F12) to see logs"
echo "  5. Verify 12 columns are created"
echo ""
echo "Expected Result:"
echo "  ✓ COLL_DACOS_STATUS table created"
echo "  ✓ 12 columns parsed: LINK_ID, SEND_DT, COMPANY_ID, etc."
echo "  ✓ Comments applied as logical names"
echo ""

