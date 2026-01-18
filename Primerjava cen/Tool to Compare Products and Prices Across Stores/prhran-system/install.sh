#!/bin/bash

# Installation script for prhran product matching system
# Usage: bash install.sh

echo "================================"
echo "PRHRAN System Installation"
echo "================================"
echo ""

# Check if Python is installed
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    echo "Please install Python 3 from https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python $PYTHON_VERSION found"
echo ""

# Install requirements
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "================================"
echo "✓ Installation Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Run: python3 product_matcher_intelligent.py"
echo "2. Check results in: matched_products_latest.csv"
echo ""
echo "For continuous updates:"
echo "python3 product_matcher_intelligent.py watch"
echo ""
