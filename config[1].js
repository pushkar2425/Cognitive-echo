module.exports = {
  // Server configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  websocketPort: process.env.WEBSOCKET_PORT || 8080,

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // OpenAI API
  openaiApiKey: process.env.OPENAI_API_KEY,

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpireTime: process.env.JWT_EXPIRE_TIME || '24h',

  // File upload
  maxFileSize: process.env.MAX_FILE_SIZE || 10485760, // 10MB
  uploadPath: process.env.UPLOAD_PATH || './uploads',

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],

  // Rate limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // OpenAI API settings
  whisperModel: 'whisper-1',
  gptModel: 'gpt-4o',
  dalleModel: 'dall-e-3',

  // Real-time processing settings
  maxTranscriptionLength: 5000,
  predictionThreshold: 0.7,
  maxPredictions: 5,

  // Memory Garden settings
  maxMemoryItems: 100,
  artworkGenerationEnabled: true
};