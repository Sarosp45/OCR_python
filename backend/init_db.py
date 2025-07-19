#!/usr/bin/env python3
"""
Database initialization script for OCR Document Automation System
"""

import os
import sys
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def create_mysql_database():
    """Create MySQL database if it doesn't exist"""
    import pymysql
    
    mysql_host = os.getenv('MYSQL_HOST', 'localhost')
    mysql_port = int(os.getenv('MYSQL_PORT', '3306'))
    mysql_user = os.getenv('MYSQL_USER', 'root')
    mysql_password = os.getenv('MYSQL_PASSWORD', 'password')
    mysql_database = os.getenv('MYSQL_DATABASE', 'ocr_automation')
    
    try:
        # Connect to MySQL server (without specifying database)
        connection = pymysql.connect(
            host=mysql_host,
            port=mysql_port,
            user=mysql_user,
            password=mysql_password,
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # Create database if it doesn't exist
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{mysql_database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ Database '{mysql_database}' created or already exists")
            
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ Error creating MySQL database: {e}")
        return False

def initialize_tables():
    """Initialize database tables using SQLAlchemy"""
    try:
        from app import app, db
        
        with app.app_context():
            # Drop all tables (be careful in production!)
            print("🗑️  Dropping existing tables...")
            db.drop_all()
            
            # Create all tables
            print("🏗️  Creating tables...")
            db.create_all()
            
            print("✅ Database tables created successfully")
            
            # Print table information
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"📊 Created tables: {', '.join(tables)}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error initializing tables: {e}")
        return False

def create_sample_data():
    """Create sample categories and data for testing"""
    try:
        from app import app, db
        from models import Category
        
        with app.app_context():
            # Check if categories already exist
            if Category.query.count() > 0:
                print("📋 Sample data already exists, skipping...")
                return True
            
            # Create sample categories
            sample_categories = [
                {'name': 'Invoices', 'model_type': 'cloud'},
                {'name': 'Receipts', 'model_type': 'cloud'},
                {'name': 'Contracts', 'model_type': 'hf'},
                {'name': 'ID Documents', 'model_type': 'hf'},
                {'name': 'Bank Statements', 'model_type': 'cloud'},
            ]
            
            for cat_data in sample_categories:
                category = Category(
                    name=cat_data['name'],
                    model_type=cat_data['model_type']
                )
                db.session.add(category)
            
            db.session.commit()
            print(f"✅ Created {len(sample_categories)} sample categories")
            
        return True
        
    except Exception as e:
        print(f"❌ Error creating sample data: {e}")
        return False

def main():
    """Main initialization function"""
    print("🚀 Initializing OCR Document Automation Database...")
    print("=" * 50)
    
    # Check if MySQL is configured
    mysql_password = os.getenv('MYSQL_PASSWORD', 'password')
    
    if mysql_password and mysql_password != 'password':
        print("🔧 MySQL configuration detected")
        if not create_mysql_database():
            print("❌ Failed to create MySQL database")
            return False
    else:
        print("🔧 Using SQLite for development")
    
    # Initialize tables
    if not initialize_tables():
        print("❌ Failed to initialize tables")
        return False
    
    # Create sample data
    if not create_sample_data():
        print("❌ Failed to create sample data")
        return False
    
    print("=" * 50)
    print("✅ Database initialization completed successfully!")
    print("\n📝 Next steps:")
    print("1. Start the backend server: python app.py")
    print("2. Start the frontend: npm start (in frontend directory)")
    print("3. Open http://localhost:3000 in your browser")
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)