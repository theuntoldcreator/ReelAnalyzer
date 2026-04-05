#!/bin/bash
echo "Starting ReelAnalyzer..."

# Build Frontend
echo "Building Frontend..."
cd frontend
npm install
npm run build
cd ..

# Start Backend Server (serving built frontend)
echo "Starting FastAPI Backend on Port 7860..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 7860

# Exit when backend stops
