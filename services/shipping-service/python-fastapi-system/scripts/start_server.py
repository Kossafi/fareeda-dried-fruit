#!/usr/bin/env python3
"""
Script to start the FastAPI server for the dried fruits inventory system
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

import uvicorn
from app.main import app


def main():
    """Main function to start the server"""
    print("🌟 Starting Dried Fruits Inventory System")
    print("=" * 50)
    print("🚀 Server starting...")
    print("📊 API Documentation: http://localhost:8000/docs")
    print("📋 ReDoc Documentation: http://localhost:8000/redoc")
    print("🔐 Admin Login: admin / admin123")
    print("=" * 50)
    
    # Start the server
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )


if __name__ == "__main__":
    main()