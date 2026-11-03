import { z } from 'zod';

export const QualityEnum = z.enum(['low', 'medium', 'high']);
export type Quality = z.infer<typeof QualityEnum>;

export const CountForEnum = z.enum(['piece', 'pair']);
export type CountFor = z.infer<typeof CountForEnum>;

export const MetalEnum = z.enum(['same', 'yellow', 'rose', 'white', 'two-tone']);
export type Metal = z.infer<typeof MetalEnum>;

export const AnalyzeInputSchema = z.object({
  diamondCount: z.coerce.number().int().min(1, 'Diamond count must be at least 1').max(200, 'Diamond count cannot exceed 200'),
  countFor: CountForEnum.default('piece'),
  sku: z.string().optional().default(''),
  stoneSize: z.string().optional().default(''),
  metal: z.string().optional().default('same'),
  mustKeep: z.string().optional().default(''),
  quality: QualityEnum.default('medium'),
  clusterRhodiumFill: z.preprocess(
    (val) => val === 'true' || val === true || val === '1' || val === 1,
    z.boolean()
  ).default(false),
  headShapeVariance: z.preprocess(
    (val) => val === 'true' || val === true || val === '1' || val === 1,
    z.boolean()
  ).default(false),
});

export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;

export const VariationSchema = z.object({
  index: z.number().int().min(1).max(10),
  name: z.string().min(1),
  description: z.string().min(1),
  motifTreatment: z.string().default(''),
  stoneCount: z.number().int().min(1),
  stoneLayout: z.string().min(1),
  setting: z.string().min(1),
  sizeMm: z.string().min(1),
  goldVsOriginal: z.string().min(1),
  imagePrompt: z.string().min(1),
});

export type Variation = z.infer<typeof VariationSchema>;

export const OriginalAnalysisSchema = z.object({
  productType: z.string(),
  metal: z.string(),
  motif: z.string().default(''),
  stoneCount: z.number(),
  stoneLayout: z.string(),
  summary: z.string(),
});

export type OriginalAnalysis = z.infer<typeof OriginalAnalysisSchema>;

export const AnalysisResponseSchema = z.object({
  original: OriginalAnalysisSchema,
  variations: z.array(VariationSchema).length(10),
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

export const GenerateInputSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  index: z.coerce.number().int().min(1).max(10),
  quality: QualityEnum.optional(),
  variation: VariationSchema.optional(),
  diamondCount: z.coerce.number().optional(),
  motif: z.string().optional(),
  clusterRhodiumFill: z.boolean().optional(),
  headShapeVariance: z.boolean().optional(),
});

export type GenerateInput = z.infer<typeof GenerateInputSchema>;
