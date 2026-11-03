import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AnalyzeInputSchema, GenerateInputSchema } from './schemas.js';
import { analyzeDesign, generateCardImage } from './openaiService.js';
import { jobStore } from './jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8787;

// Configure CORS
app.use(cors({ origin: true, credentials: true }));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage (max 10MB as in PLAN.md)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, or WebP are permitted.'));
    }
  },
});

// Optional simple password middleware if APP_PASSWORD is set
app.use((req: Request, res: Response, next: NextFunction) => {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword || req.path === '/api/health' || !req.path.startsWith('/api')) {
    return next();
  }
  const provided = req.headers['x-app-password'] || req.query.password;
  if (provided !== appPassword) {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Valid studio password required.',
      },
    });
  }
  next();
});

// Health check endpoint (Milestone 1)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'jewellery-variation-studio',
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o',
    imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst',
    time: new Date().toISOString(),
  });
});

// Configuration endpoint
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://eylkbycxhptmmqcpvloz.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    maxParallel: Number(process.env.MAX_PARALLEL || 3),
    imageQuality: process.env.IMAGE_QUALITY || 'medium',
    textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o',
    imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst',
    hasPassword: Boolean(process.env.APP_PASSWORD),
  });
});

// Analysis endpoint (Milestone 3)
app.post('/api/analyze', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'missing_image',
          message: 'Reference jewellery photo is required (JPG, PNG, or WebP, max 10 MB).',
        },
      });
    }

    const parseResult = AnalyzeInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message || 'Invalid form parameters';
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: issue,
        },
      });
    }

    const { diamondCount, countFor, sku, stoneSize, metal, mustKeep, quality, clusterRhodiumFill, headShapeVariance } = parseResult.data;

    const job = await analyzeDesign({
      photoBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalFileName: req.file.originalname,
      diamondCount,
      countFor,
      sku: sku || '',
      stoneSize: stoneSize || '',
      metal: metal || 'same',
      mustKeep: mustKeep || '',
      quality,
      clusterRhodiumFill,
      headShapeVariance,
    });

    res.json({
      jobId: job.jobId,
      original: job.original,
      variations: job.variations,
      diamondCount: job.diamondCount,
      countFor: job.countFor,
      sku: job.sku,
      clusterRhodiumFill: job.clusterRhodiumFill,
      headShapeVariance: job.headShapeVariance,
    });
  } catch (err: any) {
    next(err);
  }
});

// Generation endpoint (Milestone 4)
app.post('/api/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = GenerateInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message || 'Invalid generate parameters';
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: issue,
        },
      });
    }

    const { jobId, index, quality, variation, diamondCount, motif, clusterRhodiumFill, headShapeVariance } = parseResult.data;
    const result = await generateCardImage(jobId, index, quality, variation, {
      diamondCount,
      motif,
      clusterRhodiumFill,
      headShapeVariance,
    });
    res.json(result);
  } catch (err: any) {
    next(err);
  }
});

// Job query endpoint
app.get('/api/jobs/:jobId', (req: Request, res: Response) => {
  const job = jobStore.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'Job not found or expired',
      },
    });
  }

  const imagesObj: Record<number, string> = {};
  for (const [idx, b64] of job.images.entries()) {
    imagesObj[idx] = b64;
  }

  res.json({
    jobId: job.jobId,
    original: job.original,
    variations: job.variations,
    diamondCount: job.diamondCount,
    countFor: job.countFor,
    sku: job.sku,
    clusterRhodiumFill: job.clusterRhodiumFill,
    headShapeVariance: job.headShapeVariance,
    createdAt: job.createdAt,
    images: imagesObj,
  });
});

// Serve client in production if built
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[Production] Serving static files from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err);

  // Multer errors (e.g. file too large)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: {
          code: 'file_too_large',
          message: 'Image size exceeds maximum allowed 10 MB.',
        },
      });
    }
    return res.status(400).json({
      error: {
        code: 'upload_error',
        message: err.message,
      },
    });
  }

  // OpenAI moderation or policy errors
  if (err?.code === 'moderation_blocked' || err?.error?.code === 'moderation_blocked') {
    return res.status(422).json({
      error: {
        code: 'moderation_blocked',
        message: 'The request was flagged by OpenAI content policy. Please adjust notes or image.',
      },
    });
  }

  // Rate limit
  if (err?.status === 429 || err?.statusCode === 429) {
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'OpenAI rate limit exceeded. Please wait a moment before retrying.',
      },
    });
  }

  // Quota exceeded
  if (err?.code === 'insufficient_quota' || err?.error?.code === 'insufficient_quota') {
    return res.status(402).json({
      error: {
        code: 'quota_exceeded',
        message: 'OpenAI API quota exceeded. Check billing in OpenAI dashboard.',
      },
    });
  }

  const statusCode = err?.status || err?.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: err?.code || 'internal_error',
      message: err?.message || 'An unexpected error occurred.',
    },
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✨ SWA Jewellery Studio Server running on http://localhost:${PORT}`);
  });
}

export default app;

