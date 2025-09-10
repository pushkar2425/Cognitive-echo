#!/bin/bash

# Cognitive Echo Backend Deployment Script
# This script sets up the complete backend infrastructure

set -e  # Exit on any error

echo "🚀 Starting Cognitive Echo Backend Deployment..."
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ $NODE_VERSION -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_success "Docker found - container deployment available"
    else
        print_warning "Docker not found - manual database setup required"
    fi
    
    # Check PostgreSQL (if not using Docker)
    if ! command -v docker &> /dev/null && ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL not found - please install PostgreSQL or Docker"
    fi
    
    print_success "Prerequisites check completed"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cp .env.example .env
        print_warning "Created .env file from .env.example"
        print_warning "Please update .env with your actual values before continuing"
        
        # Generate JWT secret
        JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        sed -i "s/your_super_secret_jwt_key_here/$JWT_SECRET/" .env
        print_success "Generated JWT secret"
        
        echo ""
        echo "🔧 IMPORTANT: Update your .env file with:"
        echo "   - OPENAI_API_KEY: Your OpenAI API key"
        echo "   - DATABASE_URL: Your PostgreSQL connection string"
        echo "   - REDIS_URL: Your Redis connection string (optional)"
        echo ""
        
        read -p "Press Enter to continue after updating .env file..."
    fi
    
    # Create necessary directories
    mkdir -p logs
    mkdir -p uploads
    mkdir -p temp
    
    print_success "Environment setup completed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    npm ci --only=production
    
    print_success "Dependencies installed"
}

# Setup database with Docker
setup_database_docker() {
    print_status "Setting up database with Docker..."
    
    # Check if docker-compose exists
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        print_error "Docker Compose not found"
        return 1
    fi
    
    # Start database services
    $COMPOSE_CMD up -d db redis
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Test database connection
    if $COMPOSE_CMD exec db pg_isready -U postgres; then
        print_success "Database is ready"
    else
        print_error "Database connection failed"
        return 1
    fi
}

# Setup database manually
setup_database_manual() {
    print_status "Setting up database manually..."
    
    # Check if DATABASE_URL is set
    if grep -q "postgresql://" .env; then
        print_success "DATABASE_URL found in .env"
    else
        print_error "Please set DATABASE_URL in .env file"
        return 1
    fi
    
    # Test database connection
    if npx prisma db ping; then
        print_success "Database connection successful"
    else
        print_error "Database connection failed"
        return 1
    fi
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Generate Prisma client
    npx prisma generate
    
    # Run migrations
    npx prisma migrate deploy
    
    print_success "Database migrations completed"
}

# Seed database
seed_database() {
    print_status "Seeding database..."
    
    # Create seed script if it doesn't exist
    if [ ! -f src/database/seed.js ]; then
        print_warning "Seed script not found, skipping database seeding"
        return
    fi
    
    npm run seed
    
    print_success "Database seeding completed"
}

# Setup SSL certificates (production)
setup_ssl() {
    if [ "$NODE_ENV" = "production" ]; then
        print_status "Setting up SSL certificates..."
        
        # This would typically involve Let's Encrypt setup
        print_warning "SSL setup requires manual configuration in production"
        print_warning "Consider using Let's Encrypt with certbot"
    fi
}

# Start services
start_services() {
    print_status "Starting services..."
    
    if [ "$1" = "docker" ]; then
        # Start with Docker
        if command -v docker-compose &> /dev/null; then
            docker-compose up -d
        else
            docker compose up -d
        fi
        print_success "Services started with Docker"
    else
        # Start manually
        if [ "$NODE_ENV" = "production" ]; then
            npm start
        else
            npm run dev
        fi
    fi
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Wait a moment for services to start
    sleep 5
    
    # Check health endpoint
    if curl -f http://localhost:3000/health &> /dev/null; then
        print_success "Health check passed"
        print_success "🎉 Cognitive Echo backend is running!"
        echo ""
        echo "📍 API Base URL: http://localhost:3000"
        echo "📍 Health Check: http://localhost:3000/health"
        echo "📍 WebSocket: ws://localhost:3000"
    else
        print_error "Health check failed"
        print_error "Please check the logs for more information"
        return 1
    fi
}

# Main deployment function
main() {
    echo "Select deployment method:"
    echo "1. Docker (Recommended)"
    echo "2. Manual setup"
    echo "3. Development mode"
    read -p "Enter choice [1-3]: " choice
    
    case $choice in
        1)
            DEPLOYMENT_MODE="docker"
            ;;
        2)
            DEPLOYMENT_MODE="manual"
            ;;
        3)
            DEPLOYMENT_MODE="development"
            export NODE_ENV=development
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    print_status "Starting deployment in $DEPLOYMENT_MODE mode"
    
    # Run deployment steps
    check_prerequisites
    setup_environment
    install_dependencies
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        setup_database_docker
    else
        setup_database_manual
    fi
    
    run_migrations
    seed_database
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        start_services "docker"
    else
        print_success "Setup completed!"
        print_status "To start the server, run: npm start"
        print_status "For development mode, run: npm run dev"
    fi
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        health_check
    fi
}

# Cleanup function
cleanup() {
    print_status "Cleaning up deployment artifacts..."
    
    # Remove temporary files
    rm -rf temp/*
    
    # Clean npm cache
    npm cache clean --force
    
    print_success "Cleanup completed"
}

# Error handling
trap 'print_error "Deployment failed! Check the logs above."; exit 1' ERR

# Command line options
case "${1:-}" in
    --cleanup)
        cleanup
        exit 0
        ;;
    --health-check)
        health_check
        exit 0
        ;;
    --help)
        echo "Cognitive Echo Backend Deployment Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --cleanup      Clean up deployment artifacts"
        echo "  --health-check Run health check only"
        echo "  --help         Show this help message"
        echo ""
        echo "Interactive deployment will start if no options provided."
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac