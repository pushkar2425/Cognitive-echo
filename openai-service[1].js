const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    
    this.conversationContexts = new Map(); // Store conversation contexts
    this.maxContextLength = 4000; // Maximum context to maintain
  }

  /**
   * Transcribe audio using Whisper API
   * @param {Buffer} audioBuffer - Audio data buffer
   * @param {string} format - Audio format (webm, mp3, wav, etc.)
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio(audioBuffer, format = 'webm') {
    try {
      // Create temporary file for audio processing
      const tempFileName = `temp_${Date.now()}.${format}`;
      const tempFilePath = path.join(config.uploadPath, tempFileName);
      
      await fs.writeFile(tempFilePath, audioBuffer);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: await fs.readFile(tempFilePath),
        model: config.whisperModel,
        language: 'en', // Can be made configurable
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });
      
      // Clean up temporary file
      await fs.unlink(tempFilePath);
      
      return {
        text: transcription.text,
        words: transcription.words,
        language: transcription.language,
        duration: transcription.duration,
        confidence: this.calculateTranscriptionConfidence(transcription.words)
      };
      
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw new Error(`Speech transcription failed: ${error.message}`);
    }
  }

  /**
   * Process multimodal input (audio + video) using GPT-4o
   * @param {Object} params - Processing parameters
   * @returns {Promise<Object>} AI analysis and predictions
   */
  async processMultimodalInput({
    transcription,
    videoFrame,
    userId,
    conversationHistory = [],
    userProfile = {}
  }) {
    try {
      // Get or create conversation context
      const contextKey = `${userId}_${Date.now()}`;
      let context = this.conversationContexts.get(userId) || [];
      
      // Build comprehensive prompt
      const systemPrompt = this.buildSystemPrompt(userProfile);
      
      // Prepare messages for GPT-4o
      const messages = [
        { role: 'system', content: systemPrompt },
        ...this.formatConversationHistory(context),
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Current fragmented speech: "${transcription.text}"\n\nPlease analyze this multimodal input and provide assistance.`
            }
          ]
        }
      ];
      
      // Add video frame if provided
      if (videoFrame) {
        messages[messages.length - 1].content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${videoFrame}`,
            detail: 'low' // Optimize for speed
          }
        });
      }
      
      const response = await this.openai.chat.completions.create({
        model: config.gptModel,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Update conversation context
      this.updateConversationContext(userId, {
        transcription: transcription.text,
        analysis,
        timestamp: new Date()
      });
      
      return this.formatAnalysisResponse(analysis);
      
    } catch (error) {
      console.error('Multimodal processing error:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Generate visual aid using DALL-E 3
   * @param {string} concept - Concept to visualize
   * @param {Object} context - Additional context for generation
   * @returns {Promise<Object>} Generated image data
   */
  async generateVisualAid(concept, context = {}) {
    try {
      const prompt = this.buildDallePrompt(concept, context);
      
      const response = await this.openai.images.generate({
        model: config.dalleModel,
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url'
      });
      
      return {
        url: response.data[0].url,
        prompt: prompt,
        concept: concept,
        generatedAt: new Date()
      };
      
    } catch (error) {
      console.error('DALL-E generation error:', error);
      throw new Error(`Visual aid generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Memory Garden artwork
   * @param {Array} sentences - Completed sentences from sessions
   * @param {Object} userThemes - User's communication themes
   * @returns {Promise<Object>} Artistic visualization
   */
  async generateMemoryGardenArt(sentences, userThemes = {}) {
    try {
      // Analyze themes and emotions from sentences
      const themeAnalysis = await this.openai.chat.completions.create({
        model: config.gptModel,
        messages: [
          {
            role: 'system',
            content: `Analyze the following sentences for themes, emotions, and visual elements. Create an artistic concept for a memory garden visualization.`
          },
          {
            role: 'user',
            content: `Sentences: ${sentences.join('. ')}\n\nCreate a cohesive artistic theme.`
          }
        ],
        max_tokens: 500,
        response_format: { type: "json_object" }
      });
      
      const themes = JSON.parse(themeAnalysis.choices[0].message.content);
      
      // Generate artistic prompt
      const artPrompt = `Create a beautiful, serene memory garden artwork representing ${themes.primaryTheme}. 
        Include elements: ${themes.visualElements.join(', ')}. 
        Emotional tone: ${themes.emotion}. 
        Style: impressionistic, therapeutic, hope-inspiring. 
        Colors: soft, calming palette with ${themes.suggestedColors.join(', ')}`;
      
      const artwork = await this.openai.images.generate({
        model: config.dalleModel,
        prompt: artPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd'
      });
      
      return {
        url: artwork.data[0].url,
        theme: themes.primaryTheme,
        emotions: themes.emotion,
        visualElements: themes.visualElements,
        colors: themes.suggestedColors,
        prompt: artPrompt,
        sentences: sentences,
        createdAt: new Date()
      };
      
    } catch (error) {
      console.error('Memory Garden generation error:', error);
      throw new Error(`Memory Garden artwork generation failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt for GPT-4o
   */
  buildSystemPrompt(userProfile) {
    return `You are an AI assistant specialized in helping people with aphasia and speech disorders communicate effectively. Your role is to:

1. Analyze fragmented speech and predict intended meaning
2. Provide contextual word predictions and suggestions
3. Interpret facial expressions and gestures from video input
4. Generate appropriate assistance based on confidence levels
5. Maintain empathy and encouragement

User Profile:
- Condition: ${userProfile.condition || 'Unknown'}
- Severity: ${userProfile.severity || 'Unknown'}
- Preferences: ${JSON.stringify(userProfile.settings || {})}

Response Format (JSON):
{
  "intendedMeaning": "predicted complete sentence",
  "confidence": 0.0-1.0,
  "wordPredictions": ["word1", "word2", "word3"],
  "assistanceLevel": "low|medium|high",
  "visualCues": {
    "suggested": true/false,
    "concept": "concept to visualize"
  },
  "audioHint": {
    "suggested": true/false,
    "text": "hint to speak"
  },
  "emotionalContext": "detected emotional state",
  "recommendations": "specific suggestions"
}`;
  }

  /**
   * Build DALL-E prompt for visual aids
   */
  buildDallePrompt(concept, context) {
    return `Simple, clear illustration of ${concept}. 
      Medical/therapeutic style, high contrast, easy to understand. 
      Suitable for speech therapy assistance. 
      Clean background, professional quality.
      ${context.style ? `Style: ${context.style}` : ''}`;
  }

  /**
   * Calculate transcription confidence from word-level data
   */
  calculateTranscriptionConfidence(words) {
    if (!words || words.length === 0) return 0;
    
    // Simple confidence calculation based on word timing consistency
    const avgConfidence = words.reduce((sum, word) => {
      // Whisper doesn't provide confidence directly, so we estimate
      const wordLength = word.end - word.start;
      const expectedLength = word.word.length * 0.1; // ~100ms per character
      const confidence = Math.min(1, expectedLength / wordLength);
      return sum + confidence;
    }, 0) / words.length;
    
    return Math.max(0, Math.min(1, avgConfidence));
  }

  /**
   * Format conversation history for GPT-4o
   */
  formatConversationHistory(context) {
    return context.slice(-5).map(item => ({
      role: 'assistant',
      content: `Previous: "${item.transcription}" -> Analysis: ${JSON.stringify(item.analysis)}`
    }));
  }

  /**
   * Update conversation context
   */
  updateConversationContext(userId, data) {
    let context = this.conversationContexts.get(userId) || [];
    context.push(data);
    
    // Keep only recent context
    if (context.length > 10) {
      context = context.slice(-10);
    }
    
    this.conversationContexts.set(userId, context);
  }

  /**
   * Format analysis response
   */
  formatAnalysisResponse(analysis) {
    return {
      predictions: analysis.wordPredictions || [],
      confidence: analysis.confidence || 0,
      intendedMeaning: analysis.intendedMeaning || '',
      assistanceLevel: analysis.assistanceLevel || 'low',
      visualAidSuggested: analysis.visualCues?.suggested || false,
      visualConcept: analysis.visualCues?.concept || null,
      audioHintSuggested: analysis.audioHint?.suggested || false,
      audioHintText: analysis.audioHint?.text || null,
      emotionalContext: analysis.emotionalContext || 'neutral',
      recommendations: analysis.recommendations || ''
    };
  }

  /**
   * Clean up conversation contexts (should be called periodically)
   */
  cleanupContexts() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [userId, context] of this.conversationContexts) {
      const filtered = context.filter(item => {
        return (now - new Date(item.timestamp).getTime()) < maxAge;
      });
      
      if (filtered.length === 0) {
        this.conversationContexts.delete(userId);
      } else {
        this.conversationContexts.set(userId, filtered);
      }
    }
  }
}

module.exports = OpenAIService;