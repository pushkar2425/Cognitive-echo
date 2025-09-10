# Cognitive Echo Backend

## 🚀 Production-Ready AI Communication Assistant Backend

A complete, scalable backend system for Cognitive Echo - the revolutionary real-time AI-powered communication assistant for individuals with aphasia and speech disorders.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Security](#security)
- [Monitoring](#monitoring)
- [Contributing](#contributing)

---

## 🎯 Overview

This backend provides the complete infrastructure for Cognitive Echo's AI-powered communication assistance system, featuring:

- **Real-time multimodal AI processing** using OpenAI's latest APIs
- **WebSocket-based communication** for instant response times
- **Production-grade security** with JWT authentication and rate limiting
- **Scalable architecture** designed for millions of users
- **Comprehensive logging** and monitoring capabilities

### Core Technologies

- **Node.js 18+** with Express.js framework
- **PostgreSQL** for primary data storage
- **Redis** for caching and session management
- **Socket.io** for real-time communication
- **Prisma ORM** for database operations
- **OpenAI APIs** (Whisper, GPT-4o, DALL-E 3)

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Load Balancer  │    │  API Gateway    │
│   Web App       │◄──►│   (Nginx/ALB)    │◄──►│   Express.js    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌─────────────────────────────────┼─────────────┐
                       │                                 │             │
             ┌─────────▼──────────┐         ┌────────────▼──┐   ┌─────▼─────┐
             │   Socket.io        │         │   OpenAI      │   │   Redis   │
             │   WebSocket Server │         │   Services    │   │   Cache   │
             └────────────────────┘         └───────────────┘   └───────────┘
                       │
             ┌─────────▼──────────┐
             │   PostgreSQL       │
             │   Database         │
             └────────────────────┘
```

---

## ✨ Features

### Core API Features

- **🎙️ Speech Processing**
  - Real-time speech-to-text using Whisper API
  - Multimodal analysis with GPT-4o (audio + video)
  - Contextual word predictions and suggestions
  - Confidence scoring and adaptive assistance

- **🖼️ Visual Aid Generation**
  - Dynamic image creation with DALL-E 3
  - Context-aware therapeutic illustrations
  - Custom prompt optimization for speech therapy

- **🌸 Memory Garden**
  - AI-generated artistic visualizations
  - Communication progress tracking
  - Thematic artwork from session data

- **👤 User Management**
  - Secure JWT authentication
  - Profile customization and settings
  - Progress tracking and analytics

### Real-time Features

- **⚡ WebSocket Communication**
  - Sub-second response times
  - Collaborative AI feedback loop
  - Live session management

- **📊 Real-time Analytics**
  - Session progress tracking
  - API usage monitoring
  - Performance metrics

### Production Features

- **🔒 Security**
  - JWT-based authentication
  - Rate limiting and DDoS protection
  - Input validation and sanitization
  - CORS and security headers

- **📈 Scalability**
  - Horizontal scaling support
  - Database connection pooling
  - Redis caching layer
  - Load balancer ready

- **🔍 Monitoring**
  - Comprehensive logging
  - Health check endpoints
  - Error tracking and alerting
  - API usage analytics

---

## ⚡ Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (optional but recommended)
- OpenAI API key

### Installation

1. **Clone and Setup**
   ```bash
   git clone [repository-url]
   cd cognitive-echo-backend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Using Docker (recommended)
   docker-compose up -d db redis
   
   # Or manually setup PostgreSQL and Redis
   ```

4. **Run Migrations**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Start Server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Automated Deployment

```bash
chmod +x deploy.sh
./deploy.sh
```

The deployment script provides interactive setup with Docker or manual configuration options.

---

## 📡 API Documentation

### Authentication

All protected endpoints require JWT authentication:

```javascript
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Speech Processing

```http
POST /api/speech/transcribe
Content-Type: multipart/form-data

# Transcribe audio using Whisper API
```

```http
POST /api/speech/analyze  
Content-Type: multipart/form-data

# Analyze multimodal input (audio + video)
```

```http
POST /api/speech/visual-aid
Content-Type: application/json

{
  "concept": "apple",
  "context": { "style": "therapeutic" }
}
```

#### Session Management

```http
POST /api/speech/session/start
# Start new therapy session

PUT /api/speech/session/:id/update  
# Update session data

POST /api/speech/session/:id/end
# End session and calculate metrics
```

#### Memory Garden

```http
GET /api/memory-garden
# Get user's memory garden entries

POST /api/memory-garden
# Create new memory garden entry

POST /api/memory-garden/:id/regenerate-artwork
# Regenerate artwork for entry
```

#### User Management

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
GET /api/user/profile
PUT /api/user/settings
```

### WebSocket Events

```javascript
// Client -> Server
socket.emit('authenticate', { token });
socket.emit('process_speech', { audioData, videoFrame });
socket.emit('start_session');
socket.emit('feedback', { predictionAccepted, actualIntent });

// Server -> Client  
socket.on('transcription_ready', data => {});
socket.on('predictions_ready', data => {});
socket.on('visual_aid_ready', data => {});
socket.on('audio_hint_ready', data => {});
```

---

## 🚀 Deployment

### Docker Deployment (Recommended)

```yaml
# docker-compose.yml included
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/cognitive_echo
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: cognitive_echo
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password

  redis:
    image: redis:7-alpine
```

### Cloud Deployment

#### AWS Deployment
```bash
# Using AWS ECS with Application Load Balancer
# Dockerfile and deployment scripts included
```

#### Google Cloud Platform
```bash
# Using Cloud Run with Cloud SQL
gcloud run deploy cognitive-echo-backend \
  --image gcr.io/project/cognitive-echo-backend \
  --platform managed \
  --region us-central1
```

#### Heroku
```bash
# Heroku deployment ready
git push heroku main
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
WEBSOCKET_PORT=8080

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/cognitive_echo"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# OpenAI API (required)
OPENAI_API_KEY=your_openai_api_key_here

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE_TIME=24h

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Database Schema

The complete Prisma schema includes:

- **Users**: Authentication and profile data
- **Sessions**: Therapy session tracking
- **MemoryGarden**: Artistic visualizations
- **UserProgress**: Progress analytics
- **ApiUsage**: Usage monitoring
- **AuditLogs**: Security auditing

---

## 👨‍💻 Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis
docker-compose up -d db redis

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Development Scripts

```bash
npm run dev          # Start development server with hot reload
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Database Management

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# Reset database
npx prisma migrate reset

# View database
npx prisma studio
```

---

## 🧪 Testing

### Test Suite

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "OpenAI Service"

# Run tests with coverage
npm run test:coverage
```

### Test Categories

- **Unit Tests**: Individual service and utility functions
- **Integration Tests**: API endpoint testing
- **WebSocket Tests**: Real-time communication testing
- **Database Tests**: Data persistence and queries

---

## 🔐 Security

### Security Features

- **Authentication**: JWT-based with secure token handling
- **Rate Limiting**: Per-user and per-IP request limits
- **Input Validation**: Joi schema validation for all inputs
- **CORS Protection**: Configurable origin restrictions
- **Security Headers**: Helmet.js security middleware
- **SQL Injection Prevention**: Prisma ORM parameter binding
- **File Upload Security**: MIME type validation and size limits

### Security Best Practices

```javascript
// JWT tokens expire in 24 hours
// Passwords hashed with bcrypt (12 rounds)
// All API requests logged for audit
// Sensitive data encrypted at rest
// HTTPS enforced in production
```

---

## 📊 Monitoring

### Health Checks

```http
GET /health
{
  "status": "OK",
  "timestamp": "2025-08-10T12:00:00Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### Logging

```javascript
// Structured JSON logging with Winston
// Log levels: error, warn, info, debug
// Separate log files for different services
// Log rotation and archiving
```

### Metrics

- API response times
- OpenAI API usage and costs
- Active WebSocket connections
- Database query performance
- Error rates and types

---

## 📈 Performance

### Optimization Features

- **Database Connection Pooling**: Prisma connection pool
- **Redis Caching**: Session and frequently accessed data
- **Gzip Compression**: Response compression middleware  
- **Query Optimization**: Efficient database queries with Prisma
- **Asset Optimization**: File upload handling and storage

### Performance Targets

- **API Response Time**: < 200ms (95th percentile)
- **WebSocket Latency**: < 100ms
- **Speech Processing**: < 2s end-to-end
- **Concurrent Users**: 10,000+ with proper scaling

---

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

### Code Standards

- ESLint configuration for code quality
- Prettier for code formatting
- Conventional commits for clear history
- 80%+ test coverage requirement

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🆘 Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Email**: support@cognitive-echo.com

---

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core API implementation
- ✅ Real-time WebSocket communication
- ✅ OpenAI API integration
- ✅ Database schema and migrations

### Phase 2 (Next 3 months)
- [ ] Multi-language support
- [ ] Advanced caching strategies
- [ ] Kubernetes deployment
- [ ] Enhanced monitoring

### Phase 3 (Next 6 months)
- [ ] Machine learning model fine-tuning
- [ ] Advanced analytics dashboard
- [ ] Third-party integrations
- [ ] Mobile app support

---

## 📊 Project Status

- **Status**: Production Ready ✅
- **Version**: 1.0.0
- **Last Updated**: August 2025
- **Maintainers**: Cognitive Echo Team

---

**Built with ❤️ for the speech therapy community**

*Empowering communication through advanced AI technology*