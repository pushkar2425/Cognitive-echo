const winston = require('winston');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const OpenAIService = require('./OpenAIService');
const prisma = require('../config/database');

class SocketService {
  constructor(io) {
    this.io = io;
    this.openaiService = new OpenAIService();
    this.activeConnections = new Map(); // userId -> socket mapping
    this.processingQueue = new Map(); // userId -> processing status
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/socket.log' })
      ]
    });
    
    // Clean up contexts periodically
    setInterval(() => {
      this.openaiService.cleanupContexts();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Handle new socket connection
   * @param {Object} socket - Socket.io socket instance
   */
  handleConnection(socket) {
    this.logger.info('New socket connection', { socketId: socket.id });

    // Authentication middleware
    socket.on('authenticate', async (data) => {
      try {
        const { token } = data;
        const decoded = jwt.verify(token, config.jwtSecret);
        
        socket.userId = decoded.id;
        socket.authenticated = true;
        
        // Store active connection
        this.activeConnections.set(decoded.id, socket);
        
        // Join user-specific room
        socket.join(`user_${decoded.id}`);
        
        socket.emit('authenticated', { success: true, userId: decoded.id });
        this.logger.info('Socket authenticated', { 
          socketId: socket.id, 
          userId: decoded.id 
        });
        
      } catch (error) {
        socket.emit('authentication_error', { error: 'Invalid token' });
        this.logger.error('Socket authentication failed', { 
          socketId: socket.id, 
          error: error.message 
        });
      }
    });

    // Real-time speech processing
    socket.on('process_speech', async (data) => {
      if (!socket.authenticated) {
        socket.emit('error', { error: 'Not authenticated' });
        return;
      }

      try {
        await this.processSpeechInput(socket, data);
      } catch (error) {
        this.logger.error('Speech processing error', {
          userId: socket.userId,
          error: error.message
        });
        socket.emit('processing_error', { error: error.message });
      }
    });

    // Start new session
    socket.on('start_session', async () => {
      if (!socket.authenticated) {
        socket.emit('error', { error: 'Not authenticated' });
        return;
      }

      try {
        const session = await this.startNewSession(socket.userId);
        socket.sessionId = session.id;
        socket.emit('session_started', { sessionId: session.id });
        
      } catch (error) {
        this.logger.error('Session start error', {
          userId: socket.userId,
          error: error.message
        });
        socket.emit('session_error', { error: error.message });
      }
    });

    // End session
    socket.on('end_session', async () => {
      if (!socket.authenticated || !socket.sessionId) {
        return;
      }

      try {
        await this.endSession(socket.sessionId);
        socket.emit('session_ended', { sessionId: socket.sessionId });
        delete socket.sessionId;
        
      } catch (error) {
        this.logger.error('Session end error', {
          userId: socket.userId,
          sessionId: socket.sessionId,
          error: error.message
        });
      }
    });

    // User feedback on AI suggestions
    socket.on('feedback', async (data) => {
      if (!socket.authenticated) {
        return;
      }

      try {
        await this.processFeedback(socket.userId, data);
      } catch (error) {
        this.logger.error('Feedback processing error', {
          userId: socket.userId,
          error: error.message
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Process speech input in real-time
   * @param {Object} socket - Socket instance
   * @param {Object} data - Speech data
   */
  async processSpeechInput(socket, data) {
    const { audioData, videoFrame, timestamp } = data;
    const userId = socket.userId;

    // Check if already processing for this user
    if (this.processingQueue.has(userId)) {
      socket.emit('processing_busy', { message: 'Still processing previous input' });
      return;
    }

    // Mark as processing
    this.processingQueue.set(userId, true);
    
    try {
      // Send immediate acknowledgment
      socket.emit('processing_started', { timestamp });

      // Step 1: Transcribe audio using Whisper
      const transcriptionResult = await this.openaiService.transcribeAudio(
        Buffer.from(audioData, 'base64'),
        'webm'
      );

      // Send transcription immediately
      socket.emit('transcription_ready', {
        text: transcriptionResult.text,
        confidence: transcriptionResult.confidence,
        words: transcriptionResult.words
      });

      // Step 2: Process with GPT-4o for predictions and analysis
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true, condition: true, severity: true }
      });

      const analysis = await this.openaiService.processMultimodalInput({
        transcription: transcriptionResult,
        videoFrame,
        userId,
        userProfile: {
          condition: user?.condition,
          severity: user?.severity,
          settings: user?.settings
        }
      });

      // Send predictions and assistance
      socket.emit('predictions_ready', {
        predictions: analysis.predictions,
        confidence: analysis.confidence,
        intendedMeaning: analysis.intendedMeaning,
        assistanceLevel: analysis.assistanceLevel,
        emotionalContext: analysis.emotionalContext
      });

      // Step 3: Generate visual aid if suggested
      if (analysis.visualAidSuggested && analysis.visualConcept) {
        try {
          const visualAid = await this.openaiService.generateVisualAid(
            analysis.visualConcept,
            { style: 'therapeutic' }
          );
          
          socket.emit('visual_aid_ready', {
            imageUrl: visualAid.url,
            concept: visualAid.concept,
            prompt: visualAid.prompt
          });
          
        } catch (visualError) {
          this.logger.error('Visual aid generation failed', {
            userId,
            concept: analysis.visualConcept,
            error: visualError.message
          });
        }
      }

      // Step 4: Provide audio hint if suggested
      if (analysis.audioHintSuggested && analysis.audioHintText) {
        socket.emit('audio_hint_ready', {
          text: analysis.audioHintText,
          priority: analysis.assistanceLevel === 'high' ? 'immediate' : 'gentle'
        });
      }

      // Update session data
      if (socket.sessionId) {
        await this.updateSessionData(socket.sessionId, {
          transcription: transcriptionResult.text,
          predictions: analysis.predictions,
          confidence: analysis.confidence,
          assistanceLevel: analysis.assistanceLevel
        });
      }

    } finally {
      // Clear processing flag
      this.processingQueue.delete(userId);
      socket.emit('processing_complete', { timestamp: Date.now() });
    }
  }

  /**
   * Start a new therapy session
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Session object
   */
  async startNewSession(userId) {
    const session = await prisma.session.create({
      data: {
        userId,
        startedAt: new Date(),
        transcript: '',
        predictions: {},
        completedSentences: [],
        successfulPredictions: 0,
        totalPredictions: 0
      }
    });

    this.logger.info('New session started', {
      userId,
      sessionId: session.id
    });

    return session;
  }

  /**
   * End current session and calculate metrics
   * @param {string} sessionId - Session ID
   */
  async endSession(sessionId) {
    const endedAt = new Date();
    
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const duration = Math.floor((endedAt - session.startedAt) / 1000);
    
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        endedAt,
        duration
      }
    });

    // Update user progress
    await this.updateUserProgress(session.userId, {
      sessionCompleted: true,
      wordsImproved: session.completedSentences.length,
      averageConfidence: session.confidence || 0
    });

    this.logger.info('Session ended', {
      sessionId,
      userId: session.userId,
      duration
    });
  }

  /**
   * Process user feedback on AI suggestions
   * @param {string} userId - User ID
   * @param {Object} feedback - Feedback data
   */
  async processFeedback(userId, feedback) {
    const { predictionAccepted, suggestion, actualIntent, sessionId } = feedback;

    // Store feedback for AI improvement
    const feedbackData = {
      userId,
      predictionAccepted,
      aiSuggestion: suggestion,
      actualUserIntent: actualIntent,
      timestamp: new Date(),
      sessionId
    };

    // Update session with feedback
    if (sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });

      if (session) {
        const newSuccessful = session.successfulPredictions + (predictionAccepted ? 1 : 0);
        const newTotal = session.totalPredictions + 1;

        await prisma.session.update({
          where: { id: sessionId },
          data: {
            successfulPredictions: newSuccessful,
            totalPredictions: newTotal
          }
        });
      }
    }

    this.logger.info('Feedback processed', feedbackData);
  }

  /**
   * Update session data during processing
   * @param {string} sessionId - Session ID
   * @param {Object} data - Data to update
   */
  async updateSessionData(sessionId, data) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: data.transcription,
        predictions: data.predictions,
        confidence: data.confidence,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Update user progress metrics
   * @param {string} userId - User ID
   * @param {Object} progressData - Progress data
   */
  async updateUserProgress(userId, progressData) {
    const today = new Date().toISOString().split('T')[0];

    const existingProgress = await prisma.userProgress.findUnique({
      where: {
        userId_date: {
          userId,
          date: new Date(today)
        }
      }
    });

    if (existingProgress) {
      await prisma.userProgress.update({
        where: {
          userId_date: {
            userId,
            date: new Date(today)
          }
        },
        data: {
          totalSessions: existingProgress.totalSessions + (progressData.sessionCompleted ? 1 : 0),
          totalWordsImproved: existingProgress.totalWordsImproved + (progressData.wordsImproved || 0),
          averageConfidence: (existingProgress.averageConfidence + progressData.averageConfidence) / 2,
          updatedAt: new Date()
        }
      });
    } else {
      await prisma.userProgress.create({
        data: {
          userId,
          date: new Date(today),
          totalSessions: progressData.sessionCompleted ? 1 : 0,
          totalWordsImproved: progressData.wordsImproved || 0,
          averageConfidence: progressData.averageConfidence || 0
        }
      });
    }
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket instance
   */
  handleDisconnection(socket) {
    if (socket.userId) {
      this.activeConnections.delete(socket.userId);
      this.processingQueue.delete(socket.userId);
    }

    this.logger.info('Socket disconnected', {
      socketId: socket.id,
      userId: socket.userId
    });
  }

  /**
   * Broadcast message to specific user
   * @param {string} userId - User ID
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  broadcastToUser(userId, event, data) {
    const socket = this.activeConnections.get(userId);
    if (socket && socket.connected) {
      socket.emit(event, data);
    }
  }

  /**
   * Get active connection count
   * @returns {number} Number of active connections
   */
  getActiveConnectionCount() {
    return this.activeConnections.size;
  }
}

module.exports = SocketService;