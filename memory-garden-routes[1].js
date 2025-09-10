const express = require('express');
const prisma = require('../config/database');
const OpenAIService = require('../services/OpenAIService');

const router = express.Router();
const openaiService = new OpenAIService();

/**
 * GET /api/memory-garden
 * Get all memory garden entries for user
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const memoryGarden = await prisma.memoryGarden.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip,
      take: parseInt(limit),
      select: {
        id: true,
        title: true,
        description: true,
        theme: true,
        artworkUrl: true,
        sentences: true,
        emotions: true,
        keyWords: true,
        colors: true,
        createdAt: true,
        generatedAt: true
      }
    });

    const total = await prisma.memoryGarden.count({
      where: {
        userId: req.user.id
      }
    });

    res.json({
      success: true,
      data: memoryGarden,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Memory garden fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch memory garden',
      message: error.message
    });
  }
});

/**
 * GET /api/memory-garden/:id
 * Get specific memory garden entry
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const memoryEntry = await prisma.memoryGarden.findFirst({
      where: {
        id,
        userId: req.user.id
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!memoryEntry) {
      return res.status(404).json({
        error: 'Memory garden entry not found'
      });
    }

    // Get related sessions if available
    const relatedSessions = await prisma.session.findMany({
      where: {
        id: {
          in: memoryEntry.sessionIds
        },
        userId: req.user.id
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        duration: true,
        completedSentences: true,
        successfulPredictions: true,
        totalPredictions: true
      }
    });

    res.json({
      success: true,
      data: {
        ...memoryEntry,
        relatedSessions
      }
    });

  } catch (error) {
    console.error('Memory garden entry fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch memory garden entry',
      message: error.message
    });
  }
});

/**
 * POST /api/memory-garden
 * Create new memory garden entry
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      sentences,
      sessionIds = [],
      theme,
      emotions = [],
      keyWords = [],
      generateArtwork = true
    } = req.body;

    if (!title || !sentences || sentences.length === 0) {
      return res.status(400).json({
        error: 'Title and sentences are required'
      });
    }

    let artworkData = {
      artworkUrl: null,
      artPrompt: null,
      colors: [],
      generatedAt: null
    };

    // Generate artwork if requested and enabled
    if (generateArtwork && sentences.length > 0) {
      try {
        const artwork = await openaiService.generateMemoryGardenArt(
          sentences,
          { theme, emotions, keyWords }
        );

        artworkData = {
          artworkUrl: artwork.url,
          artPrompt: artwork.prompt,
          colors: artwork.colors,
          generatedAt: new Date()
        };

      } catch (artworkError) {
        console.error('Artwork generation failed:', artworkError);
        // Continue without artwork rather than failing the entire request
      }
    }

    // Create memory garden entry
    const memoryEntry = await prisma.memoryGarden.create({
      data: {
        userId: req.user.id,
        title,
        description: description || '',
        theme: theme || 'general',
        sessionIds,
        sentences,
        emotions,
        keyWords,
        ...artworkData
      }
    });

    res.status(201).json({
      success: true,
      message: 'Memory garden entry created successfully',
      data: memoryEntry
    });

  } catch (error) {
    console.error('Memory garden creation error:', error);
    res.status(500).json({
      error: 'Failed to create memory garden entry',
      message: error.message
    });
  }
});

/**
 * PUT /api/memory-garden/:id
 * Update memory garden entry
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      sentences,
      emotions,
      keyWords,
      regenerateArtwork = false
    } = req.body;

    // Verify ownership
    const existingEntry = await prisma.memoryGarden.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!existingEntry) {
      return res.status(404).json({
        error: 'Memory garden entry not found'
      });
    }

    let updateData = {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(sentences && { sentences }),
      ...(emotions && { emotions }),
      ...(keyWords && { keyWords }),
      updatedAt: new Date()
    };

    // Regenerate artwork if requested
    if (regenerateArtwork && sentences && sentences.length > 0) {
      try {
        const artwork = await openaiService.generateMemoryGardenArt(
          sentences,
          { theme: existingEntry.theme, emotions, keyWords }
        );

        updateData = {
          ...updateData,
          artworkUrl: artwork.url,
          artPrompt: artwork.prompt,
          colors: artwork.colors,
          generatedAt: new Date()
        };

      } catch (artworkError) {
        console.error('Artwork regeneration failed:', artworkError);
        // Continue with other updates
      }
    }

    const updatedEntry = await prisma.memoryGarden.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Memory garden entry updated successfully',
      data: updatedEntry
    });

  } catch (error) {
    console.error('Memory garden update error:', error);
    res.status(500).json({
      error: 'Failed to update memory garden entry',
      message: error.message
    });
  }
});

/**
 * DELETE /api/memory-garden/:id
 * Delete memory garden entry
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existingEntry = await prisma.memoryGarden.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!existingEntry) {
      return res.status(404).json({
        error: 'Memory garden entry not found'
      });
    }

    await prisma.memoryGarden.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Memory garden entry deleted successfully'
    });

  } catch (error) {
    console.error('Memory garden deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete memory garden entry',
      message: error.message
    });
  }
});

/**
 * POST /api/memory-garden/:id/regenerate-artwork
 * Regenerate artwork for existing entry
 */
router.post('/:id/regenerate-artwork', async (req, res) => {
  try {
    const { id } = req.params;
    const { style, additionalContext } = req.body;

    // Verify ownership
    const existingEntry = await prisma.memoryGarden.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!existingEntry) {
      return res.status(404).json({
        error: 'Memory garden entry not found'
      });
    }

    if (!existingEntry.sentences || existingEntry.sentences.length === 0) {
      return res.status(400).json({
        error: 'Cannot generate artwork without sentences'
      });
    }

    // Generate new artwork
    const artwork = await openaiService.generateMemoryGardenArt(
      existingEntry.sentences,
      {
        theme: existingEntry.theme,
        emotions: existingEntry.emotions,
        keyWords: existingEntry.keyWords,
        style,
        additionalContext
      }
    );

    // Update entry with new artwork
    const updatedEntry = await prisma.memoryGarden.update({
      where: { id },
      data: {
        artworkUrl: artwork.url,
        artPrompt: artwork.prompt,
        colors: artwork.colors,
        generatedAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Artwork regenerated successfully',
      data: {
        id: updatedEntry.id,
        artworkUrl: updatedEntry.artworkUrl,
        artPrompt: updatedEntry.artPrompt,
        colors: updatedEntry.colors,
        generatedAt: updatedEntry.generatedAt
      }
    });

  } catch (error) {
    console.error('Artwork regeneration error:', error);
    res.status(500).json({
      error: 'Failed to regenerate artwork',
      message: error.message
    });
  }
});

/**
 * GET /api/memory-garden/stats
 * Get memory garden statistics for user
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await prisma.memoryGarden.aggregate({
      where: {
        userId: req.user.id
      },
      _count: {
        id: true
      }
    });

    // Get theme distribution
    const themeStats = await prisma.memoryGarden.groupBy({
      by: ['theme'],
      where: {
        userId: req.user.id
      },
      _count: {
        theme: true
      }
    });

    // Get recent entries
    const recentEntries = await prisma.memoryGarden.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        title: true,
        theme: true,
        createdAt: true,
        sentences: true
      }
    });

    // Calculate total sentences across all entries
    const allEntries = await prisma.memoryGarden.findMany({
      where: {
        userId: req.user.id
      },
      select: {
        sentences: true
      }
    });

    const totalSentences = allEntries.reduce((sum, entry) => {
      return sum + (entry.sentences ? entry.sentences.length : 0);
    }, 0);

    res.json({
      success: true,
      data: {
        totalEntries: stats._count.id,
        totalSentences,
        themeDistribution: themeStats.map(item => ({
          theme: item.theme,
          count: item._count.theme
        })),
        recentEntries
      }
    });

  } catch (error) {
    console.error('Memory garden stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch memory garden statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/memory-garden/bulk-create
 * Create multiple memory garden entries from session data
 */
router.post('/bulk-create', async (req, res) => {
  try {
    const { sessionIds, groupByTheme = true } = req.body;

    if (!sessionIds || sessionIds.length === 0) {
      return res.status(400).json({
        error: 'Session IDs are required'
      });
    }

    // Get sessions with completed sentences
    const sessions = await prisma.session.findMany({
      where: {
        id: {
          in: sessionIds
        },
        userId: req.user.id,
        completedSentences: {
          not: {
            equals: []
          }
        }
      },
      select: {
        id: true,
        completedSentences: true,
        startedAt: true,
        endedAt: true
      }
    });

    if (sessions.length === 0) {
      return res.status(400).json({
        error: 'No sessions found with completed sentences'
      });
    }

    const createdEntries = [];

    if (groupByTheme) {
      // Analyze all sentences together and group by themes
      const allSentences = sessions.flatMap(session => session.completedSentences);
      
      if (allSentences.length > 0) {
        const artwork = await openaiService.generateMemoryGardenArt(allSentences);
        
        const entry = await prisma.memoryGarden.create({
          data: {
            userId: req.user.id,
            title: `Communication Journey - ${new Date().toLocaleDateString()}`,
            description: `Combined insights from ${sessions.length} therapy sessions`,
            theme: artwork.theme,
            sessionIds: sessions.map(s => s.id),
            sentences: allSentences,
            emotions: [artwork.emotions],
            keyWords: artwork.visualElements || [],
            artworkUrl: artwork.url,
            artPrompt: artwork.prompt,
            colors: artwork.colors,
            generatedAt: new Date()
          }
        });

        createdEntries.push(entry);
      }

    } else {
      // Create separate entries for each session
      for (const session of sessions) {
        if (session.completedSentences.length > 0) {
          const artwork = await openaiService.generateMemoryGardenArt(
            session.completedSentences
          );

          const entry = await prisma.memoryGarden.create({
            data: {
              userId: req.user.id,
              title: `Session - ${session.startedAt.toLocaleDateString()}`,
              description: `Therapy session with ${session.completedSentences.length} completed thoughts`,
              theme: artwork.theme,
              sessionIds: [session.id],
              sentences: session.completedSentences,
              emotions: [artwork.emotions],
              keyWords: artwork.visualElements || [],
              artworkUrl: artwork.url,
              artPrompt: artwork.prompt,
              colors: artwork.colors,
              generatedAt: new Date()
            }
          });

          createdEntries.push(entry);
        }
      }
    }

    res.json({
      success: true,
      message: `Created ${createdEntries.length} memory garden entries`,
      data: createdEntries
    });

  } catch (error) {
    console.error('Bulk memory garden creation error:', error);
    res.status(500).json({
      error: 'Failed to create memory garden entries',
      message: error.message
    });
  }
});

module.exports = router;