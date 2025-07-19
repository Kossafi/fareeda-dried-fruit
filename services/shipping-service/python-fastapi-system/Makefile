# Makefile for Dried Fruits Inventory System

.PHONY: install start demo-data test clean help

# Default target
help:
	@echo "🌟 Dried Fruits Inventory System - Available Commands"
	@echo "=================================================="
	@echo "install      - Install dependencies"
	@echo "start        - Start the FastAPI server"
	@echo "demo-data    - Generate demo data"
	@echo "test         - Run basic system tests"
	@echo "test-all     - Run comprehensive test suite"
	@echo "test-unit    - Run unit tests only"
	@echo "test-coverage - Run tests with coverage report"
	@echo "deploy       - Deploy to production"
	@echo "deploy-monitoring - Deploy with monitoring stack"
	@echo "backup       - Create system backup"
	@echo "clean        - Clean up temporary files"
	@echo "help         - Show this help message"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	poetry install
	@echo "✅ Dependencies installed!"

# Start the server
start:
	@echo "🚀 Starting server..."
	python scripts/start_server.py

# Generate demo data
demo-data:
	@echo "🎲 Generating demo data..."
	python scripts/generate_demo_data.py

# Run tests
test:
	@echo "🧪 Running basic system tests..."
	python scripts/test_system.py

# Run comprehensive tests
test-all:
	@echo "🧪 Running comprehensive test suite..."
	python scripts/run_tests.py

# Run unit tests only
test-unit:
	@echo "🧪 Running unit tests..."
	python -m pytest tests/ -v

# Run tests with coverage
test-coverage:
	@echo "📊 Running tests with coverage..."
	python -m pytest tests/ --cov=app --cov-report=html --cov-report=term

# Deploy to production
deploy:
	@echo "🚀 Deploying to production..."
	./scripts/deploy.sh

# Deploy with monitoring
deploy-monitoring:
	@echo "🚀 Deploying with monitoring..."
	./scripts/deploy.sh --with-monitoring

# Create backup
backup:
	@echo "💾 Creating backup..."
	./scripts/backup.sh

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	@echo "✅ Cleanup complete!"

# Development setup
setup: install
	@echo "🔧 Setting up development environment..."
	@echo "✅ Development environment ready!"
	@echo ""
	@echo "🚀 Next steps:"
	@echo "1. Run: make demo-data"
	@echo "2. Run: make start"
	@echo "3. Open: http://localhost:8000/docs"