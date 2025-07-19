#!/usr/bin/env python3
"""
Test script for API endpoints
"""
import requests
import json
from time import sleep

BASE_URL = "http://localhost:8001"

def test_health():
    """Test health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ Health Check: {response.status_code}")
        print(f"   Response: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Health Check failed: {e}")
        return False

def test_root():
    """Test root endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✅ Root: {response.status_code}")
        print(f"   Response: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Root failed: {e}")
        return False

def test_products():
    """Test products endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/products")
        print(f"✅ Products: {response.status_code}")
        data = response.json()
        print(f"   Found {data['total']} products")
        for product in data['products'][:2]:  # Show first 2 products
            print(f"   - {product['name']} ({product['sku']})")
        return True
    except Exception as e:
        print(f"❌ Products failed: {e}")
        return False

def test_users():
    """Test users endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/users")
        print(f"✅ Users: {response.status_code}")
        data = response.json()
        print(f"   Found {data['total']} users")
        for user in data['users']:
            print(f"   - {user['username']} ({user['role']})")
        return True
    except Exception as e:
        print(f"❌ Users failed: {e}")
        return False

def test_login():
    """Test login endpoint"""
    try:
        response = requests.post(f"{BASE_URL}/login", params={
            "username": "admin",
            "password": "admin123"
        })
        print(f"✅ Login: {response.status_code}")
        data = response.json()
        print(f"   User: {data['user']['username']} ({data['user']['role']})")
        print(f"   Token: {data['access_token'][:20]}...")
        return True
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

def main():
    print("🧪 Testing Dried Fruits Inventory System API")
    print("=" * 50)
    
    # Wait a bit for server to start
    sleep(2)
    
    tests = [
        ("Health Check", test_health),
        ("Root Endpoint", test_root),
        ("Products List", test_products),
        ("Users List", test_users),
        ("Login", test_login)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n🔍 Testing {test_name}...")
        if test_func():
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    print("=" * 50)
    
    if failed == 0:
        print("🎉 All tests passed! System is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the errors above.")

if __name__ == "__main__":
    main()