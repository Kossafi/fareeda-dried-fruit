# 🛠️ Setup Instructions

## ✅ Prerequisites

### System Requirements
- **Python 3.8+** (recommended: Python 3.9 or 3.10)
- **pip** (Python package manager)
- **Git** (for cloning repository)
- **Terminal/Command Prompt** access

### Check Your Python Installation
```bash
python3 --version  # Should show 3.8+ 
pip3 --version     # Should show pip version
```

## 📥 Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd "fareedadriedfruits Hub&Store"
```

### 2. Install Python Dependencies
```bash
# Install all required packages
pip3 install -r requirements.txt

# If you get permission errors on macOS/Linux:
sudo pip3 install -r requirements.txt

# Or use virtual environment (recommended):
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Verify Installation
```bash
# Test if main dependencies are installed
python3 -c "import fastapi, uvicorn, jwt, bcrypt; print('✅ All dependencies installed!')"
```

## 🚀 Running the System

### Method 1: Direct Python (Recommended)
```bash
python3 main.py
```

### Method 2: Using Scripts

#### macOS/Linux:
```bash
# Make scripts executable (first time only)
chmod +x start-system.sh
chmod +x stop-system.sh

# Start system
./start-system.sh

# Stop system (in another terminal)
./stop-system.sh
```

#### Windows:
```batch
# Start system
start-system.bat

# Stop system
stop-system.bat
```

## 🌐 Accessing the System

After starting, open your web browser and go to:

### Main URLs
- **🔐 Login**: http://localhost:8001/branch-login
- **📊 Dashboard**: http://localhost:8001/dashboard
- **🏠 Home**: http://localhost:8001/

### Demo Accounts
| Role | Username | Password | Access |
|------|----------|----------|--------|
| Admin | admin | admin123 | All branches |
| Manager | manager001 | 123456 | All branches |
| Manager | manager002 | 123456 | SPG, EMQ only |
| Staff | staff001 | 123456 | CLP, SPG only |
| Staff | staff002 | 123456 | SPG, EMQ only |
| Staff | staff003 | 123456 | EMQ only |

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using port 8001
lsof -i :8001  # macOS/Linux
netstat -ano | findstr :8001  # Windows

# Kill the process
kill -9 <PID>  # macOS/Linux
taskkill /F /PID <PID>  # Windows
```

#### 2. Python Module Not Found
```bash
# Reinstall dependencies
pip3 install -r requirements.txt --force-reinstall

# Check Python path
which python3
which pip3
```

#### 3. Permission Denied (macOS/Linux)
```bash
# Use sudo for installation
sudo pip3 install -r requirements.txt

# Or use virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 4. Database Issues
```bash
# Remove existing database (will reset all data)
rm branch_system.db

# Restart the application (database will be recreated)
python3 main.py
```

#### 5. Browser Issues
- Clear browser cache and cookies
- Try incognito/private mode
- Try different browser (Chrome, Firefox, Safari)
- Check browser console for JavaScript errors (F12)

### Performance Tips

#### For Development
```bash
# Run with auto-reload (development mode)
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

#### For Production
```bash
# Run with Gunicorn (install separately)
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

## 🧪 Testing the System

### 1. Test Branch Login API
```bash
python3 test_branch_login.py
```

### 2. Manual API Testing
```bash
# Test login endpoint
curl -X POST "http://localhost:8001/api/branch-auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### 3. Test Sales Recording
1. Login to the system
2. Select a branch
3. Go to Dashboard
4. Click "บันทึกการขาย" button
5. Fill out the form and submit

## 📁 Project Structure

```
fareedadriedfruits Hub&Store/
├── main.py                 # Main FastAPI application
├── requirements.txt        # Python dependencies
├── branch_system.db       # SQLite database (auto-created)
├── web/                   # Frontend HTML files
│   ├── dashboard.html     # Main dashboard with sales recording
│   └── ...               # Other HTML pages
├── start-system.sh        # Linux/macOS start script
├── start-system.bat       # Windows start script
├── test_branch_login.py   # API testing script
├── README.md              # Main documentation
├── SETUP.md              # This file
├── CHANGELOG.md          # Version history
└── LICENSE               # MIT License
```

## 🔒 Security Notes

### For Production Deployment
1. **Change Default Passwords**: Update all demo account passwords
2. **Update JWT Secret**: Change the JWT_SECRET in main.py
3. **Use HTTPS**: Set up SSL certificates
4. **Database Security**: Use PostgreSQL instead of SQLite
5. **Environment Variables**: Move secrets to .env file
6. **Firewall**: Restrict access to necessary ports only

### Environment Variables (.env file)
```bash
# Create .env file in project root
JWT_SECRET=your-super-secret-jwt-key-here
DATABASE_URL=sqlite:///./branch_system.db
DEBUG=False
PORT=8001
```

## 📞 Support

If you encounter issues:
1. Check this SETUP.md file
2. Review error messages in terminal
3. Check browser console (F12) for frontend errors
4. Verify all prerequisites are installed
5. Try restarting the system

## 🎯 Next Steps

After successful setup:
1. **Explore the Dashboard**: Login and check different features
2. **Test Sales Recording**: Try recording a few sales transactions
3. **Try Different Roles**: Login with different demo accounts
4. **Check Reports**: View sales summaries and analytics
5. **Customize**: Modify products, branches, or add new features