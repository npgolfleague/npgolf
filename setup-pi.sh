#!/bin/bash
# Setup script for Raspberry Pi 5
# Run this on your Raspberry Pi to install Docker and deploy the app

set -e

echo "======================================"
echo "Raspberry Pi 5 Setup for npgolf"
echo "======================================"

# Install Docker
echo ""
echo "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    echo "Docker installed! You'll need to log out and back in for group changes to take effect."
    echo "After logging back in, run this script again to continue setup."
    exit 0
else
    echo "Docker is already installed."
fi

# Check if docker-compose-pi.yml exists
if [ ! -f "docker-compose-pi.yml" ]; then
    echo "Error: docker-compose-pi.yml not found in current directory"
    echo "Please copy docker-compose-pi.yml to this directory first"
    exit 1
fi

# Pull images and start containers
echo ""
echo "Pulling Docker images..."
docker compose -f docker-compose-pi.yml pull

echo ""
echo "Starting containers..."
docker compose -f docker-compose-pi.yml up -d

echo ""
echo "Waiting for MySQL to be ready..."
sleep 10

# Restore database if backup exists
if ls npgolf_backup_*.sql 1> /dev/null 2>&1; then
    echo ""
    echo "Restoring database from backup..."
    cat npgolf_backup_*.sql | docker exec -i npgolf-mysql-pi mysql -uroot -proot npgolf
    echo "Database restored!"
else
    echo ""
    echo "No database backup found. Starting with empty database."
    echo "To restore later, copy your backup file and run:"
    echo "cat npgolf_backup_*.sql | docker exec -i npgolf-mysql-pi mysql -uroot -proot npgolf"
fi

echo ""
echo "======================================"
echo "Setup complete!"
echo "======================================"
echo ""
echo "Your application is now running at:"
echo "  http://localhost:3000"
echo "  http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Useful commands:"
echo "  View logs:     docker logs npgolf-app-pi"
echo "  Stop app:      docker compose -f docker-compose-pi.yml down"
echo "  Restart app:   docker compose -f docker-compose-pi.yml restart"
echo "  Update app:    docker compose -f docker-compose-pi.yml pull && docker compose -f docker-compose-pi.yml up -d"
echo ""
