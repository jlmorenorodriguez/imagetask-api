# Image Processing API

REST API built with NestJS and TypeScript for asynchronous image processing and task management.

## 📋 Table of Contents

- [Features](#-features)
- [Technologies](#-technologies)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Usage](#-api-usage)
- [Endpoints Documentation](#-endpoints-documentation)
- [Image Processing](#-image-processing)
- [Error Handling](#-error-handling)
- [Testing](#-testing)
- [Monitoring & Logs](#-monitoring--logs)


## ✨ Features

- 🖼️ **Asynchronous image processing** with queues (Bull Queue)
- 📏 **Automatic variant generation** in multiple resolutions (1024px, 800px)
- 💰 **Task management** with dynamic pricing
- 🔄 **Real-time task states** (pending → processing → completed/failed)
- 🌐 **Support for URLs** and local files
- 🚦 **Rate limiting** and security headers
- 📊 **Structured logging** with request tracking
- 🛡️ **Centralized error handling**
- 📚 **Automatic documentation** with Swagger
- 🧪 **Complete test suite** (unit, integration, E2E)
- 🐳 **Dockerized** for local development

## 🛠️ Technologies

### Backend
- **NestJS** - Scalable Node.js framework
- **TypeScript** - Typed superset of JavaScript
- **MongoDB** - NoSQL database (Docker)
- **Redis** - Cache and queue management (Docker)
- **Bull Queue** - Asynchronous job processing
- **Sharp** - Image processing library
- **Mongoose** - MongoDB ORM

### Documentation & Testing
- **Swagger/OpenAPI** - Automatic API documentation
- **Jest** - Testing framework
- **Supertest** - HTTP API testing

## 🏗️ Architecture

### Project Structure

```
src/
├── app.module.ts              # Main module
├── main.ts                    # Entry point
├── common/                    # Shared elements
│   ├── filters/              # Exception filters
│   ├── interceptors/         # Request/Response interceptors
│   ├── middleware/           # Custom middleware
│   ├── pipes/               # Validation pipes
│   └── common.module.ts     # Global configuration
├── tasks/                    # Task management module
│   ├── dto/                 # Data Transfer Objects
│   ├── entities/            # MongoDB entities
│   ├── processors/          # Bull Queue processors
│   ├── tasks.controller.ts  # REST controller
│   ├── tasks.service.ts     # Business logic
│   └── tasks.module.ts      # Module configuration
├── images/                   # Image processing module
│   ├── services/            # Processing services
│   ├── utils/              # Image utilities
│   └── images.module.ts    # Module configuration
└── config/                  # Configurations
```

### Processing Flow

```
Client Request → TasksController → TasksService → MongoDB (Task created)
                                                 ↓
                                              Bull Queue (Job added)
                                                 ↓
                              ImageProcessingProcessor → ImageProcessingService
                                                 ↓
                              Sharp (Process image) + FileStorageService (Save variants)
                                                 ↓
                                              MongoDB (Update status)
```

## 🚀 Installation

### Prerequisites

- **Node.js** v18 or higher
- **Docker** and **Docker Compose**
- **npm** or **yarn**

### Installation Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd imagetask-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker**
```bash
docker-compose up -d
```

5. **Start the application**
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## ⚙️ Configuration

### Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/image_processing?authSource=admin

# Redis (Bull Queue)
REDIS_HOST=localhost
REDIS_PORT=6379

# File storage
OUTPUT_DIRECTORY=./output
UPLOAD_DIRECTORY=./uploads

# Image processing
MAX_FILE_SIZE=10485760
SUPPORTED_FORMATS=jpg,jpeg,png,webp
IMAGE_RESOLUTIONS=1024,800

# API
API_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### Docker Compose

MongoDB and Redis services are configured in `docker-compose.yml`:

```yaml
services:
  mongodb:
    image: mongo:7
    ports: ["27017:27017"]
    
  redis:
    image: redis:7-alpine  
    ports: ["6379:6379"]
```

## 📖 API Usage

### Base URL
```
http://localhost:3000
```

### Interactive Documentation
```
http://localhost:3000/api/docs
```

### Authentication
No authentication required currently. Rate limiting: 100 requests/15min per IP.

## 🔌 Endpoints Documentation

### Health Check

#### `GET /`
Checks application status.

**Response:**
```json
{
  "message": "Image Processing API is running successfully",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```

### Task Management

#### `POST /tasks`
Creates a new image processing task.

**Body:**
```json
{
  "originalPath": "/path/to/image.jpg"
  // or
  "originalPath": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "65d4a54b89c5e342b2c2c5f6",
    "status": "pending",
    "price": 25.5
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_1705312200_abc123def",
    "version": "1.0.0"
  }
}
```

#### `GET /tasks/:taskId`
Gets status and details of a specific task.

**Response (Pending):**
```json
{
  "success": true,
  "data": {
    "taskId": "65d4a54b89c5e342b2c2c5f6",
    "status": "pending",
    "price": 25.5,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response (Completed):**
```json
{
  "success": true,
  "data": {
    "taskId": "65d4a54b89c5e342b2c2c5f6",
    "status": "completed",
    "price": 25.5,
    "images": [
      {
        "resolution": "1024",
        "path": "/output/65d4a54b89c5e342b2c2c5f6/1024/f322b730b287da77e1c519c7ffef4fc2.jpg"
      },
      {
        "resolution": "800", 
        "path": "/output/65d4a54b89c5e342b2c2c5f6/800/202fd8b3174a774bac24428e8cb230a1.jpg"
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:32:15.000Z"
  }
}
```

#### `GET /tasks`
Gets all tasks ordered by creation date.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "taskId": "65d4a54b89c5e342b2c2c5f6",
      "status": "completed",
      "price": 25.5,
      "images": [...],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:32:15.000Z"
    }
  ]
}
```

### Task States

| State | Description |
|--------|-------------|
| `pending` | Task created, waiting for processing |
| `processing` | Image being processed |
| `completed` | Processing completed successfully |
| `failed` | Error during processing |

## 🖼️ Image Processing

### Supported Formats
- **Input**: JPG, JPEG, PNG, WebP
- **Output**: JPG (optimized for consistency)

### Generated Resolutions
- **1024px** width (maintaining aspect ratio)
- **800px** width (maintaining aspect ratio)

### File Structure
```
output/
└── {taskId}/
    ├── 1024/
    │   └── {md5hash}.jpg
    └── 800/
        └── {md5hash}.jpg
```

### Validations
- **Maximum size**: 10MB
- **Minimum dimensions**: 100x100px
- **Maximum dimensions**: 10000x10000px
- **JPEG quality**: 90%

### Download Process (URLs)
1. URL and format validation
2. Download with timeout (30s)
3. Content-type validation
4. Size verification
5. Processing with Sharp

## 🛡️ Error Handling

### Error Types

#### Validation Errors (400)
```json
{
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/tasks",
  "method": "POST",
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    "originalPath: originalPath should not be empty"
  ]
}
```

#### Resource Not Found (404)
```json
{
  "statusCode": 404,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/tasks/invalid-id",
  "method": "GET",
  "message": "Task with ID invalid-id not found",
  "error": "Not Found"
}
```

#### Rate Limit Exceeded (429)
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "retryAfter": 900
}
```

#### Server Error (500)
```json
{
  "statusCode": 500,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/tasks",
  "method": "POST",
  "message": "An unexpected error occurred",
  "error": "Internal Server Error"
}
```

### Rate Limiting Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312200
Retry-After: 900
```

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test

# Unit tests in watch mode
npm run test:watch

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Complete coverage
npm run test:cov
```

### Test Coverage

- **Services**: TasksService, ImageProcessingService, FileStorageService
- **Controllers**: TasksController with validations
- **Processors**: ImageProcessingProcessor with Bull Queue
- **Utilities**: Validations, transformations, helpers
- **Integration**: Complete API end-to-end


## 📊 Monitoring & Logs

### Structured Logging

Each request has a unique ID for tracking:

```json
{
  "level": "log",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": "LoggingInterceptor",
  "message": "Incoming Request: POST /tasks",
  "requestId": "req_1705312200_abc123def",
  "method": "POST",
  "url": "/tasks",
  "ip": "127.0.0.1",
  "userAgent": "Mozilla/5.0...",
  "body": {"originalPath": "/test/image.jpg"},
  "duration": 245
}
```

### Captured Metrics

- **Request ID** unique per request
- **Processing duration**
- **Response size**
- **HTTP status codes**
- **Error information** with stack traces
- **User metadata** (IP, User-Agent)

### Sanitization

Logs automatically hide sensitive fields:
- Passwords
- Authentication tokens
- API Keys
- Credit card numbers
