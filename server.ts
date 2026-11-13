import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, coachAvailable: Boolean(getGeminiClient()) });
  });

  app.post('/api/coach/explain', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'COACH_UNAVAILABLE',
        message: 'Cloud AI Coach is unavailable; using offline engine coach.',
      });
      return;
    }

    try {
      const {
        fen,
        turn,
        lastMove,
        bestMoveSan,
        evaluationText,
        userQuestion,
        playerColor,
        openingName,
        moveHistory,
      } = req.body ?? {};

      if (!fen) {
        res.status(400).json({ error: 'FEN is required' });
        return;
      }

      const prompt = [
        `You are an encouraging, crystal-clear Chess Coach inside CHECKMATE – AI Chess Academy.`,
        `Explain the current position in beginner-friendly language without jargon overload.`,
        `Position FEN: ${fen}`,
        `Side to move: ${turn === 'w' ? 'White' : 'Black'}`,
        playerColor ? `Student plays: ${playerColor === 'w' ? 'White' : 'Black'}` : '',
        openingName ? `Opening context: ${openingName}` : '',
        lastMove ? `Last move played: ${lastMove}` : '',
        bestMoveSan ? `Stockfish recommended move: ${bestMoveSan}` : '',
        evaluationText ? `Engine evaluation: ${evaluationText}` : '',
        Array.isArray(moveHistory) && moveHistory.length > 0
          ? `Recent moves: ${moveHistory.slice(-10).join(' ')}`
          : '',
        userQuestion ? `Student question: ${userQuestion}` : '',
        `Provide a concise headline, a clear 2-3 sentence explanation of what matters right now on the board, 2-3 concrete ideas/threats to watch for, and the practical plan behind the recommended move.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              keyIdeas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              threats: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedPlan: { type: Type.STRING },
            },
            required: ['headline', 'summary', 'keyIdeas', 'threats', 'recommendedPlan'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ source: 'gemini', ...parsed });
    } catch (err) {
      console.error('Coach explain error:', err);
      res.status(502).json({
        error: 'COACH_ERROR',
        message: 'Unable to reach AI Coach right now.',
      });
    }
  });

  app.post('/api/coach/review', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'COACH_UNAVAILABLE',
        message: 'Cloud AI Coach is unavailable; using offline engine review.',
      });
      return;
    }

    try {
      const { playerColor, result, termination, difficulty, summaryStats, keyMoments, openingName } =
        req.body ?? {};

      const prompt = [
        `You are a supportive Chess Coach reviewing a student's completed game.`,
        `Student color: ${playerColor === 'w' ? 'White' : 'Black'}, Opponent AI: ${difficulty}`,
        `Result: ${result} (${termination})`,
        openingName ? `Opening: ${openingName}` : '',
        `Move accuracy stats: ${JSON.stringify(summaryStats)}`,
        `Key moments from engine analysis: ${JSON.stringify(keyMoments)}`,
        `Give a warm, actionable post-game coaching report in simple terms: what the student did well, the biggest turning points (blunders/mistakes or missed tactics), and 3 concrete practice habits for their next game.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdictTitle: { type: Type.STRING },
              overallFeedback: { type: Type.STRING },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              lessonsToImprove: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['verdictTitle', 'overallFeedback', 'strengths', 'lessonsToImprove'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ source: 'gemini', ...parsed });
    } catch (err) {
      console.error('Coach review error:', err);
      res.status(502).json({
        error: 'COACH_ERROR',
        message: 'Unable to generate AI Coach review.',
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CHECKMATE – AI Chess Academy server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
