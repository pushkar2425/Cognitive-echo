const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const OpenAIService = require('../services/OpenAIService');
const prisma = require('../config/database');
const config = require('../config/config');

const router = express.Router();
const openaiService = new OpenAIService();

// Configure multer for audio/video uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/webm',
      'audio/wav', 
      'audio/mp3',
      'audio/ogg',
      'video/webm',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

/**
 * POST /api/speech/transcribe
 * Transcribe audio using Whisper API
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcription = await openaiService.transcribeAudio(
      req.file.buffer,
      req.file.mimetype.split('/')[1]
    );

    // Log API usage
    await logApiUsage({
      userId: req.user.id,
      service: 'whisper',
      endpoint: '/transcribe',
      tokens: transcription.text.length,
      success: true
    });

    res.json({
      success: true,
      transcription,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    await logApiUsage({
      userId: req.user.id,
      service: 'whisper',
      endpoint: '/transcribe',
      success: false,
      errorCode: error.message
    });

    res.status(500).json({
      error: 'Transcription failed',
      message: error.message
    });
  }
});

/**
 * POST /api/speech/analyze
 * Analyze multimodal input (audio + video)
 */
router.post('/analyze', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'video_frame', maxCount: 1 }
]), async (req, res) => {
  try {
    const { audio, video_frame } = req.files;
    const { transcript, context } = req.body;

    if (!audio && !transcript) {
      return res.status(400).json({ 
        error: 'Either audio file or transcript required' 
      });
    }

    let transcriptionResult;
    
    // Transcribe audio if provided
    if (audio && audio[0]) {
      transcriptionResult = await openaiService.transcribeAudio(
        audio[0].buffer,
        audio[0].mimetype.split('/')[1]
      );
    } else {
      // Use provided transcript
      transcriptionResult = { text: transcript };
    }

    // Process video frame
    let videoFrame = null;
    if (video_frame && video_frame[0]) {
      videoFrame = video_frame[0].buffer.toString('base64');
    }

    // Get user profile
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        settings: true, 
        condition: true, 
        severity: true 
      }
    });

    // Process with GPT-4o
    const analysis = await openaiService.processMultimodalInput({
      transcription: transcriptionResult,
      videoFrame,
      userId: req.user.id,
      conversationHistory: JSON.parse(context || '[]'),
      userProfile: {
        condition: user?.condition,
        severity: user?.severity,
        settings: user?.settings
      }
    });

    // Log API usage
    await logApiUsage({
      userId: req.user.id,
      service: 'gpt-4o',
      endpoint: '/analyze',
      tokens: transcriptionResult.text.length + (analysis.intendedMeaning?.length || 0),
      success: true
    });

    res.json({
      success: true,
      analysis,
      transcription: transcriptionResult,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    await logApiUsage({
      userId: req.user.id,
      service: 'gpt-4o',
      endpoint: '/analyze',
      success: false,
      errorCode: error.message
    });

    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

/**
 * POST /api/speech/visual-aid
 * Generate visual aid for a concept
 */
router.post('/visual-aid', async (req, res) => {
  try {
    const { concept, context = {} } = req.body;

    if (!concept) {
      return res.status(400).json({ error: 'Concept is required' });
    }

    const visualAid = await openaiService.generateVisualAid(concept, {
      ...context,
      style: 'therapeutic'
    });

    // Log API usage
    await logApiUsage({
      userId: req.user.id,
      service: 'dall-e-3',
      endpoint: '/visual-aid',
      success: true
    });

    res.json({
      success: true,
      visualAid,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Visual aid generation error:', error);
    
    await logApiUsage({
      userId: req.user.id,
      service: 'dall-e-3',
      endpoint: '/visual-aid',
      success: false,
      errorCode: error.message
    });

    res.status(500).json({
      error: 'Visual aid generation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/speech/session/start
 * Start a new therapy session
 */
router.post('/session/start', async (req, res) => {
  try {
    const session = await prisma.session.create({
      data: {
        userId: req.user.id,
        startedAt: new Date(),
        transcript: '',
        predictions: {},
        completedSentences: [],
        successfulPredictions: 0,
        totalPredictions: 0
      }
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        startedAt: session.startedAt
      }
    });

  } catch (error) {
    console.error('Session start error:', error);
    res.status(500).json({
      error: 'Failed to start session',
      message: error.message
    });
  }
});

/**
 * PUT /api/speech/session/:sessionId/update
 * Update session data
 */
router.put('/session/:sessionId/update', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      transcript, 
      predictions, 
      completedSentences, 
      confidence,
      visualAids 
    } = req.body;

    // Verify session belongs to user
    const existingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: req.user.id
      }
    });

    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcript || existingSession.transcript,
        predictions: predictions || existingSession.predictions,
        completedSentences: completedSentences || existingSession.completedSentences,
        confidence: confidence !== undefined ? confidence : existingSession.confidence,
        visualAids: visualAids || existingSession.visualAids,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      session: updatedSession
    });

  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({
      error: 'Failed to update session',
      message: error.message
    });
  }
});

/**
 * POST /api/speech/session/:sessionId/end
 * End therapy session
 */
router.post('/session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { completedSentences = [] } = req.body;

    // Verify session belongs to user
    const existingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: req.user.id
      }
    });

    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const endedAt = new Date();
    const duration = Math.floor((endedAt - existingSession.startedAt) / 1000);

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        endedAt,
        duration,
        completedSentences,
        updatedAt: new Date()
      }
    });

    // Update user progress
    await updateUserProgress(req.user.id, {
      sessionCompleted: true,
      wordsImproved: completedSentences.length,
      averageConfidence: existingSession.confidence || 0
    });

    // Generate Memory Garden entry if enough sentences
    if (completedSentences.length >= 3) {
      try {
        const memoryGardenArt = await openaiService.generateMemoryGardenArt(
          completedSentences
        );

        await prisma.memoryGarden.create({
          data: {
            userId: req.user.id,
            title: `Communication Session - ${endedAt.toLocaleDateString()}`,
            description: `Session with ${completedSentences.length} completed thoughts`,
            theme: memoryGardenArt.theme,
            artworkUrl: memoryGardenArt.url,
            sessionIds: [sessionId],
            sentences: completedSentences,
            emotions: [memoryGardenArt.emotions],
            keyWords: [], // Could be extracted from sentences
            artPrompt: memoryGardenArt.prompt,
            colors: memoryGardenArt.colors,
            generatedAt: new Date()
          }
        });

      } catch (artError) {
        console.error('Memory Garden generation failed:', artError);
        // Don't fail the session end if artwork generation fails
      }
    }

    res.json({
      success: true,
      session: updatedSession,
      statistics: {
        duration,
        completedSentences: completedSentences.length,
        successRate: updatedSession.totalPredictions > 0 
          ? updatedSession.successfulPredictions / updatedSession.totalPredictions 
          : 0
      }
    });

  } catch (error) {
    console.error('Session end error:', error);
    res.status(500).json({
      error: 'Failed to end session',
      message: error.message
    });
  }
});

/**
 * POST /api/speech/feedback
 * Submit feedback on AI predictions
 */
router.post('/feedback', async (req, res) => {
  try {
    const {
      sessionId,
      predictionAccepted,
      aiSuggestion,
      actualIntent,
      predictionType // 'word', 'visual', 'audio'
    } = req.body;

    // Update session statistics
    if (sessionId) {
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId: req.user.id
        }
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

    res.json({
      success: true,
      message: 'Feedback recorded successfully'
    });

  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({
      error: 'Failed to record feedback',
      message: error.message
    });
  }
});

/**
 * Helper function to log API usage
 */
async function logApiUsage(data) {
  try {
    await prisma.apiUsage.create({
      data: {
        userId: data.userId,
        service: data.service,
        endpoint: data.endpoint,
        tokens: data.tokens,
        success: data.success,
        errorCode: data.errorCode,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}

/**
 * Helper function to update user progress
 */
async function updateUserProgress(userId, progressData) {
  const today = new Date().toISOString().split('T')[0];

  try {
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
  } catch (error) {
    console.error('Failed to update user progress:', error);
  }
}

module.exports = router;