#!/usr/bin/env python3
"""
Demo script showing all system features
"""
import requests
import json
from time import sleep

BASE_URL = "http://localhost:8001"

def demo_system():
    """Demonstrate all system features"""
    print("🥭 Dried Fruits Inventory System Demo")
    print("=" * 60)
    
    # Test root endpoint
    print("\n1️⃣ System Status:")
    response = requests.get(f"{BASE_URL}/")
    data = response.json()
    print(f"   System: {data['system']}")
    print(f"   Version: {data['version']}")
    print(f"   Status: {data['status']}")
    print(f"   Message: {data['message']}")
    
    # Test health check
    print("\n2️⃣ Health Check:")
    response = requests.get(f"{BASE_URL}/health")
    data = response.json()
    print(f"   Status: {data['status']}")
    print(f"   Message: {data['message']}")
    
    # Test login
    print("\n3️⃣ Authentication:")
    response = requests.post(f"{BASE_URL}/login", params={
        "username": "admin",
        "password": "admin123"
    })
    data = response.json()
    print(f"   User: {data['user']['full_name']}")
    print(f"   Role: {data['user']['role']}")
    print(f"   Token Type: {data['token_type']}")
    
    # Test products
    print("\n4️⃣ Products Inventory:")
    response = requests.get(f"{BASE_URL}/products")
    data = response.json()
    print(f"   Total Products: {data['total']}")
    print("   Product List:")
    for product in data['products']:
        print(f"     • {product['name']} ({product['name_en']})")
        print(f"       SKU: {product['sku']}")
        print(f"       Price: ฿{product['price']:.2f}/{product['unit']}")
        print(f"       Category: {product['category']}")
        print()
    
    # Test users
    print("\n5️⃣ User Management:")
    response = requests.get(f"{BASE_URL}/users")
    data = response.json()
    print(f"   Total Users: {data['total']}")
    print("   User List:")
    for user in data['users']:
        print(f"     • {user['full_name']} (@{user['username']})")
        print(f"       Role: {user['role']}")
        print(f"       Status: {'Active' if user['is_active'] else 'Inactive'}")
        print()
    
    print("=" * 60)
    print("🎉 Demo Complete!")
    print("📊 Access API Documentation: http://localhost:8001/docs")
    print("🔍 Access ReDoc: http://localhost:8001/redoc")
    print("=" * 60)

if __name__ == "__main__":
    demo_system()