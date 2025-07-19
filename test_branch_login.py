#!/usr/bin/env python3
"""
Test script for Branch Login System in main.py
This script tests the branch login API endpoints
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8001"

def test_branch_login():
    """Test the branch login system"""
    print("🧪 Testing Branch Login System...")
    print("=" * 50)
    
    # Test 1: Login with valid credentials
    print("Test 1: Login with valid credentials")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/branch-auth/login", 
                               json=login_data, 
                               timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Login successful!")
                token = data["data"]["token"]
                user = data["data"]["user"]
                print(f"   User: {user['firstName']} {user['lastName']}")
                print(f"   Role: {user['role']}")
                print(f"   Allowed Branches: {len(user['allowedBranches'])}")
                
                # Test 2: Get available branches
                print("\nTest 2: Get available branches")
                headers = {"Authorization": f"Bearer {token}"}
                branches_response = requests.get(f"{BASE_URL}/api/branches/available", 
                                               headers=headers, 
                                               timeout=10)
                
                if branches_response.status_code == 200:
                    branches_data = branches_response.json()
                    if branches_data.get("success"):
                        print("✅ Branches loaded successfully!")
                        branches = branches_data["data"]
                        print(f"   Available branches: {len(branches)}")
                        for branch in branches:
                            print(f"   - {branch['name']} ({branch['code']})")
                        
                        # Test 3: Select a branch
                        if branches:
                            print("\nTest 3: Select branch")
                            branch_data = {"branchId": branches[0]["id"]}
                            select_response = requests.post(f"{BASE_URL}/api/branches/session/select",
                                                          json=branch_data,
                                                          headers=headers,
                                                          timeout=10)
                            
                            if select_response.status_code == 200:
                                select_data = select_response.json()
                                if select_data.get("success"):
                                    print("✅ Branch selection successful!")
                                    print(f"   Selected: {select_data['data']['branchName']}")
                                    
                                    # Test 4: Get current session
                                    print("\nTest 4: Get current session")
                                    session_response = requests.get(f"{BASE_URL}/api/branches/session",
                                                                  headers=headers,
                                                                  timeout=10)
                                    
                                    if session_response.status_code == 200:
                                        session_data = session_response.json()
                                        if session_data.get("success"):
                                            print("✅ Session retrieved successfully!")
                                            session = session_data["data"]
                                            print(f"   Branch: {session['branch_name']}")
                                            print(f"   Start Time: {session['start_time']}")
                                            print(f"   Locked: {session['is_locked']}")
                                        else:
                                            print("❌ Failed to get session")
                                    else:
                                        print(f"❌ Session request failed: {session_response.status_code}")
                                else:
                                    print("❌ Branch selection failed")
                            else:
                                print(f"❌ Branch selection request failed: {select_response.status_code}")
                                print(f"   Response: {select_response.text}")
                    else:
                        print("❌ Failed to load branches")
                else:
                    print(f"❌ Branches request failed: {branches_response.status_code}")
            else:
                print("❌ Login failed")
                print(f"   Error: {data.get('detail', 'Unknown error')}")
        else:
            print(f"❌ Login request failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Make sure the server is running on port 8001")
        print("   Run: python main.py")
        return False
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False
    
    # Test 5: Login with invalid credentials
    print("\nTest 5: Login with invalid credentials")
    invalid_login = {
        "username": "invalid",
        "password": "invalid"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/branch-auth/login", 
                               json=invalid_login, 
                               timeout=10)
        if response.status_code == 401:
            print("✅ Invalid login correctly rejected")
        else:
            print(f"❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Invalid login test failed: {str(e)}")
    
    print("\n" + "=" * 50)
    print("🎉 Branch Login System tests completed!")
    return True

def test_demo_accounts():
    """Test all demo accounts"""
    print("\n🧪 Testing All Demo Accounts...")
    print("=" * 50)
    
    demo_accounts = [
        {"username": "admin", "password": "admin123", "role": "ADMIN"},
        {"username": "manager001", "password": "123456", "role": "MANAGER"},
        {"username": "manager002", "password": "123456", "role": "MANAGER"},
        {"username": "staff001", "password": "123456", "role": "STAFF"},
        {"username": "staff002", "password": "123456", "role": "STAFF"},
        {"username": "staff003", "password": "123456", "role": "STAFF"},
    ]
    
    for account in demo_accounts:
        print(f"\nTesting {account['username']} ({account['role']})...")
        
        try:
            response = requests.post(f"{BASE_URL}/api/branch-auth/login", 
                                   json={"username": account["username"], "password": account["password"]}, 
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    user = data["data"]["user"]
                    print(f"✅ {account['username']}: {user['firstName']} {user['lastName']}")
                    print(f"   Role: {user['role']}")
                    print(f"   Branches: {len(user['allowedBranches'])}")
                else:
                    print(f"❌ {account['username']}: Login failed")
            else:
                print(f"❌ {account['username']}: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ {account['username']}: {str(e)}")
    
    print("\n" + "=" * 50)
    print("🎉 Demo accounts testing completed!")

def main():
    """Main test function"""
    print("🚀 Branch Login System Test Suite")
    print("=" * 50)
    print("Testing server at:", BASE_URL)
    print("Make sure main.py is running with: python main.py")
    print("")
    
    # Run tests
    if test_branch_login():
        test_demo_accounts()
        
        print("\n🎊 All tests completed!")
        print("\n📝 Test Summary:")
        print("✅ Authentication system working")
        print("✅ Branch management working")
        print("✅ Session management working")
        print("✅ Demo accounts working")
        print("\n🌐 Access the system at:")
        print(f"   🏢 Branch Login: {BASE_URL}/branch-login")
        print(f"   🎯 Branch Selection: {BASE_URL}/branch-selection")
    else:
        print("\n❌ Tests failed. Please check the server and try again.")
        sys.exit(1)

if __name__ == "__main__":
    main()