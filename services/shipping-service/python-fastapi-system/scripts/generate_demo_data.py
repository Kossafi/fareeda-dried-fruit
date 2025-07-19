#!/usr/bin/env python3
"""
Script to generate demo data for the dried fruits inventory system
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.utils.demo_data import generate_demo_data


def main():
    """Main function to generate demo data"""
    print("🌟 Dried Fruits Inventory Demo Data Generator")
    print("=" * 50)
    
    try:
        summary = generate_demo_data()
        
        print("\n🎉 Demo data generation completed successfully!")
        print("=" * 50)
        print("📊 Generated Data Summary:")
        print(f"   👥 Users: {summary['users']}")
        print(f"   🏢 Branches: {summary['branches']}")
        print(f"   🥭 Products: {summary['products']}")
        print(f"   👨‍💼 Customers: {summary['customers']}")
        print(f"   🚛 Vehicles: {summary['vehicles']}")
        print(f"   👨‍🔧 Drivers: {summary['drivers']}")
        print(f"   🛣️ Routes: {summary['routes']}")
        print(f"   💰 Transactions: {summary['transactions']}")
        print(f"   📦 Shipments: {summary['shipments']}")
        print(f"   📅 Days of data: {summary['days_covered']}")
        
        print("\n✅ You can now:")
        print("   1. Login with: admin / admin123")
        print("   2. Test the API endpoints")
        print("   3. View analytics and reports")
        print("   4. Explore the system features")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()