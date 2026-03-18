#!/bin/bash

# Shopping Monitor Launch Script (Linux)

echo "Starting Monitoring System..."

# Start Backend
cd server
npm start &
echo "✓ Backend started on http://localhost:3001"

# Start Frontend
cd ../client
npm run dev
echo "✓ Frontend started"
