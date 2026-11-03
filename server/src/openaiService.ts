import 'dotenv/config';
import OpenAI, { toFile } from 'openai';
import { AnalysisResponse, AnalysisResponseSchema, Quality, Variation } from './schemas.js';
import { buildImagePrompt, getAnalysisSystemPrompt } from './prompts.js';
import { JobRecord, jobStore } from './jobs.js';

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is missing.');
    }
    openaiClient = new OpenAI({
      apiKey,
      timeout: 180000,
    });
  }
  return openaiClient;
}

const ANALYSIS_JSON_SCHEMA = {
  name: 'jewellery_analysis_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      original: {
        type: 'object',
        properties: {
          productType: { type: 'string', description: 'ring, earrings, pendant, bangle, etc.' },
          metal: { type: 'string', description: 'metal color and purity identified' },
          motif: { type: 'string', description: 'Core motif theme named in a few words with signature details, e.g. heart / love with bypass loop' },
          stoneCount: { type: 'number', description: 'count of stones detected on the original' },
          stoneLayout: { type: 'string', description: 'how stones are arranged' },
          summary: { type: 'string', description: '1-sentence structural summary' },
        },
        required: ['productType', 'metal', 'motif', 'stoneCount', 'stoneLayout', 'summary'],
        additionalProperties: false,
      },
      variations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number', description: '1 to 10' },
            name: { type: 'string', description: '2-3 words distinctive jewellery name' },
            description: { type: 'string', description: 'max 2 sentences describing the design concept' },
            motifTreatment: { type: 'string', description: 'one line on how this design interprets the motif' },
            stoneCount: { type: 'number', description: 'must match the per-piece diamond count exactly' },
            stoneLayout: { type: 'string', description: 'exact placement of every stone' },
            setting: { type: 'string', description: 'prong, bezel, channel, pave, etc.' },
            sizeMm: { type: 'string', description: 'estimated dimensions e.g. 18 x 6' },
            goldVsOriginal: { type: 'string', description: 'lighter, about the same, or more' },
            imagePrompt: { type: 'string', description: 'detailed visual prompt for sketch generator' },
          },
          required: [
            'index',
            'name',
            'description',
            'motifTreatment',
            'stoneCount',
            'stoneLayout',
            'setting',
            'sizeMm',
            'goldVsOriginal',
            'imagePrompt',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['original', 'variations'],
    additionalProperties: false,
  },
};

// Retry helper for 429 and 5xx
async function withRetry<T>(
  actionName: string,
  fn: () => Promise<T>,
  retries = 2,
  delays = [2000, 6000]
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status || err?.statusCode || 500;
      const isRateLimit = status === 429;
      const isServerError = status >= 500 && status < 600;
      const isModeration = err?.code === 'moderation_blocked' || err?.error?.code === 'moderation_blocked';
      const isQuota = err?.code === 'insufficient_quota' || err?.error?.code === 'insufficient_quota';

      if (isModeration || isQuota || attempt >= retries || (!isRateLimit && !isServerError)) {
        console.error(`[OpenAI ${actionName}] Terminal error:`, { status, code: err?.code || err?.error?.code, message: err?.message });
        throw err;
      }

      const delay = delays[attempt] || 4000;
      console.warn(`[OpenAI ${actionName}] Attempt ${attempt + 1} failed with status ${status}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

export async function analyzeDesign(params: {
  photoBuffer: Buffer;
  mimeType: string;
  originalFileName: string;
  diamondCount: number;
  countFor: 'piece' | 'pair';
  sku: string;
  stoneSize: string;
  metal: string;
  mustKeep: string;
  quality: Quality;
  clusterRhodiumFill?: boolean;
  headShapeVariance?: boolean;
}): Promise<JobRecord> {
  const { photoBuffer, mimeType, diamondCount, countFor, sku, stoneSize, metal, mustKeep, quality, clusterRhodiumFill = false, headShapeVariance = false } = params;

  // Calculate per-piece count: for earrings with "pair", divide by 2
  const perPieceCount = countFor === 'pair' ? Math.max(1, Math.round(diamondCount / 2)) : diamondCount;

  const base64Photo = photoBuffer.toString('base64');
  const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-4o';

  const clusterRhodiumNote = clusterRhodiumFill
    ? ' MANDATORY SETTING: Diamonds must be seated nearby in a tight cluster or line cluster, set in white rhodium to seamlessly fill diamond gaps as one unified diamond surface.'
    : '';

  const headShapeVarianceNote = headShapeVariance
    ? ' MANDATORY SETTING: 40%-50% geometric shape difference in the head and centerpiece motif across variations (e.g. geometric, navette, petal, chevron, or open loop contours).'
    : '';

  const userContent = [
    {
      type: 'text' as const,
      text: `Analyze this reference jewellery item. Diamond count per piece: ${perPieceCount} (total entered: ${diamondCount}, for: ${countFor}). SKU: ${sku || 'None'}. Stone size: ${stoneSize || 'estimate'}. Metal request: ${metal || 'same as photo'}. Must keep constraints: ${mustKeep || 'none'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate exactly 10 distinct, lightweight concept variations.`,
    },
    {
      type: 'image_url' as const,
      image_url: {
        url: `data:${mimeType};base64,${base64Photo}`,
        detail: 'high' as const,
      },
    },
  ];

  const runAnalysisCall = async (): Promise<AnalysisResponse> => {
    const response = await getOpenAI().chat.completions.create({
      model: textModel,
      messages: [
        { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, clusterRhodiumFill, headShapeVariance) },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: ANALYSIS_JSON_SCHEMA,
      },
      temperature: 0.7,
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('No content received from OpenAI analysis model.');
    }

    const parsedJson = JSON.parse(rawContent);
    const validated = AnalysisResponseSchema.parse(parsedJson);

    // Enforce uniqueness of names
    const names = new Set(validated.variations.map((v) => v.name.toLowerCase()));
    if (names.size < validated.variations.length) {
      throw new Error('Duplicate variation names returned by model; retrying.');
    }

    return validated;
  };

  let analysisResult: AnalysisResponse;
  try {
    analysisResult = await withRetry('analyzeDesign', runAnalysisCall, 1, [2000]);
  } catch (initialErr) {
    console.warn('[Analysis] Initial structured parsing failed or returned duplicates, retrying once...', initialErr);
    analysisResult = await runAnalysisCall();
  }

  // Force every variation's stoneCount to the perPieceCount and ensure index 1..10
  const normalizedVariations: Variation[] = analysisResult.variations.map((v, i) => {
    const fixedIndex = i + 1;
    const fixedStoneCount = perPieceCount;
    return {
      ...v,
      index: fixedIndex,
      stoneCount: fixedStoneCount,
      // Ensure imagePrompt reflects the exact per-piece count
      imagePrompt: v.imagePrompt,
    };
  });

  const job = jobStore.createJob({
    photoBuffer,
    mimeType,
    originalFileName: params.originalFileName,
    diamondCount: perPieceCount,
    countFor,
    sku,
    stoneSize,
    metal,
    mustKeep,
    quality,
    clusterRhodiumFill,
    headShapeVariance,
    original: analysisResult.original,
    variations: normalizedVariations,
  });

  console.log(`[Job Created] ID: ${job.jobId} | Variations: ${job.variations.length} | Per-piece Count: ${job.diamondCount} | Rhodium Fill: ${job.clusterRhodiumFill} | Head Shape Variance: ${job.headShapeVariance}`);
  return job;
}

export async function generateCardImage(
  jobId: string,
  index: number,
  qualityOverride?: Quality,
  fallbackVariation?: Variation,
  fallbackContext?: {
    diamondCount?: number;
    motif?: string;
    clusterRhodiumFill?: boolean;
    headShapeVariance?: boolean;
  }
): Promise<{ index: number; imageBase64: string }> {
  const job = jobStore.getJob(jobId);
  const variation = job?.variations.find((v) => v.index === index) || fallbackVariation;
  if (!variation) {
    throw new Error(`Variation index ${index} not found for job ${jobId}`);
  }

  const diamondCount = job?.diamondCount ?? fallbackContext?.diamondCount ?? variation.stoneCount;
  const motif = job?.original?.motif ?? fallbackContext?.motif ?? '';
  const clusterRhodiumFill = job?.clusterRhodiumFill ?? fallbackContext?.clusterRhodiumFill ?? false;
  const headShapeVariance = job?.headShapeVariance ?? fallbackContext?.headShapeVariance ?? false;

  const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst';
  const size = (process.env.IMAGE_SIZE as any) || '1024x1024';
  const quality = (qualityOverride || job?.quality || process.env.IMAGE_QUALITY || 'medium') as any;

  const prompt = buildImagePrompt(variation, diamondCount, motif, clusterRhodiumFill, headShapeVariance);

  const startTime = Date.now();
  console.log(`[Generate Start] Job: ${jobId} | Card: ${index} | Model: ${imageModel} | Quality: ${quality}`);

  const hasPhotoBuffer = job?.photoBuffer && job.photoBuffer.length > 0;

  const imageBuffer = await withRetry(`generateCardImage #${index}`, async () => {
    try {
      if (hasPhotoBuffer) {
        const file = await toFile(job!.photoBuffer, 'reference_photo.png', { type: job!.mimeType });
        const editResponse = await getOpenAI().images.edit({
          model: imageModel,
          image: file,
          prompt,
          size,
          quality,
        });

        const b64 = editResponse.data?.[0]?.b64_json;
        if (b64) return b64;
        const url = editResponse.data?.[0]?.url;
        if (url) {
          const resp = await fetch(url);
          const arrayBuf = await resp.arrayBuffer();
          return Buffer.from(arrayBuf).toString('base64');
        }
      } else {
        // Fallback to text-to-image generate if photo buffer is not cached
        const genResponse = await getOpenAI().images.generate({
          model: imageModel,
          prompt,
          size,
          quality,
        });

        const b64 = genResponse.data?.[0]?.b64_json;
        if (b64) return b64;
        const url = genResponse.data?.[0]?.url;
        if (url) {
          const resp = await fetch(url);
          const arrayBuf = await resp.arrayBuffer();
          return Buffer.from(arrayBuf).toString('base64');
        }
      }

      throw new Error('Images API response contained neither b64_json nor URL');
    } catch (err: any) {
      // If sunburst is temporarily unavailable or rejects format, fallback to flare or images.generate
      const errMsg = err?.message || '';
      if (errMsg.includes('model') || errMsg.includes('not supported') || errMsg.includes('invalid_request_error')) {
        console.warn(`[Generate Fallback] Model ${imageModel} error: ${errMsg}. Trying gpt-image-2.5-flare...`);
        if (hasPhotoBuffer) {
          const file = await toFile(job!.photoBuffer, 'reference_photo.png', { type: job!.mimeType });
          const flareResponse = await getOpenAI().images.edit({
            model: 'gpt-image-2.5-flare',
            image: file,
            prompt,
            size,
            quality,
          });
          const flareB64 = flareResponse.data?.[0]?.b64_json;
          if (flareB64) return flareB64;
        } else {
          const flareResponse = await getOpenAI().images.generate({
            model: 'gpt-image-2.5-flare',
            prompt,
            size,
            quality,
          });
          const flareB64 = flareResponse.data?.[0]?.b64_json;
          if (flareB64) return flareB64;
        }
      }
      throw err;
    }
  });

  const durationMs = Date.now() - startTime;
  console.log(`[Generate Done] Job: ${jobId} | Card: ${index} | Completed in ${(durationMs / 1000).toFixed(1)}s`);

  // Cache in job store
  jobStore.setImage(jobId, index, imageBuffer);

  return {
    index,
    imageBase64: imageBuffer,
  };
}
