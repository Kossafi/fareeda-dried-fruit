#!/usr/bin/env python3
"""
Comprehensive test runner for the dried fruits inventory system
"""
import sys
import os
import subprocess
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))


def run_command(command, description):
    """Run a shell command and return the result"""
    print(f"\n{'='*60}")
    print(f"🔍 {description}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        
        if result.stdout:
            print(result.stdout)
        
        if result.stderr:
            print(f"⚠️  Warnings/Errors:\n{result.stderr}")
        
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Error running command: {e}")
        return False


def main():
    """Main function to run all tests"""
    print("🧪 Dried Fruits Inventory System - Comprehensive Test Suite")
    print("=" * 70)
    
    # Change to project directory
    project_dir = Path(__file__).parent.parent
    os.chdir(project_dir)
    
    all_passed = True
    
    # 1. Run linting checks
    print("\n📋 Step 1: Code Quality Checks")
    linting_commands = [
        ("python -m flake8 app/ --count --select=E9,F63,F7,F82 --show-source --statistics", "Critical Error Check"),
        ("python -m flake8 app/ --count --max-complexity=10 --max-line-length=88 --statistics", "Style Check"),
        ("python -m black --check app/", "Code Formatting Check"),
        ("python -m isort --check-only app/", "Import Sorting Check"),
    ]
    
    for command, description in linting_commands:
        if not run_command(command, description):
            print(f"⚠️  {description} failed, but continuing...")
    
    # 2. Run type checking
    print("\n🔍 Step 2: Type Checking")
    if not run_command("python -m mypy app/ --ignore-missing-imports", "Type Check"):
        print("⚠️  Type checking failed, but continuing...")
    
    # 3. Run unit tests
    print("\n🧪 Step 3: Unit Tests")
    test_commands = [
        ("python -m pytest tests/test_auth.py -v", "Authentication Tests"),
        ("python -m pytest tests/test_products.py -v", "Product Management Tests"),
        ("python -m pytest tests/test_inventory.py -v", "Inventory Management Tests"),
        ("python -m pytest tests/test_sales.py -v", "Sales Management Tests"),
        ("python -m pytest tests/test_analytics.py -v", "Analytics Tests"),
    ]
    
    for command, description in test_commands:
        if not run_command(command, description):
            print(f"❌ {description} failed")
            all_passed = False
    
    # 4. Run all tests with coverage
    print("\n📊 Step 4: Test Coverage Report")
    if not run_command("python -m pytest tests/ --cov=app --cov-report=html --cov-report=term", "Full Test Suite with Coverage"):
        print("❌ Test coverage analysis failed")
        all_passed = False
    
    # 5. Run integration tests
    print("\n🔧 Step 5: Integration Tests")
    if not run_command("python scripts/test_system.py", "System Integration Tests"):
        print("❌ Integration tests failed")
        all_passed = False
    
    # 6. Security checks
    print("\n🔒 Step 6: Security Checks")
    security_commands = [
        ("python -m bandit -r app/ -f json", "Security Vulnerability Check"),
        ("python -m safety check", "Dependency Security Check"),
    ]
    
    for command, description in security_commands:
        if not run_command(command, description):
            print(f"⚠️  {description} failed, but continuing...")
    
    # 7. Performance tests
    print("\n⚡ Step 7: Performance Tests")
    if not run_command("python -m pytest tests/ -k 'not slow' --benchmark-only", "Performance Benchmarks"):
        print("⚠️  Performance tests failed, but continuing...")
    
    # Print final summary
    print("\n" + "=" * 70)
    print("📋 TEST SUMMARY")
    print("=" * 70)
    
    if all_passed:
        print("✅ All critical tests passed!")
        print("🎉 Your system is ready for deployment!")
        print("\n📊 Next steps:")
        print("   1. Review coverage report in htmlcov/index.html")
        print("   2. Fix any remaining linting issues")
        print("   3. Deploy to staging environment")
        print("   4. Run manual testing scenarios")
    else:
        print("❌ Some tests failed!")
        print("🔧 Please fix the failing tests before deployment")
        print("\n📝 Debugging tips:")
        print("   1. Check individual test output above")
        print("   2. Run specific test files with -v flag")
        print("   3. Use --pdb flag for debugging")
        print("   4. Check logs for detailed error messages")
    
    # Print useful commands
    print("\n🛠️  Useful Commands:")
    print("   Run specific test file: python -m pytest tests/test_auth.py -v")
    print("   Run with debugging: python -m pytest tests/test_auth.py -v --pdb")
    print("   Run only failed tests: python -m pytest --lf")
    print("   Generate coverage report: python -m pytest --cov=app --cov-report=html")
    print("   View coverage report: open htmlcov/index.html")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())