import crypto from 'crypto';
import { OriginalAnalysis, Variation } from './schemas.js';

export interface JobRecord {
  jobId: string;
  photoBuffer: Buffer;
  mimeType: string;
  originalFileName: string;
  diamondCount: number;
  countFor: 'piece' | 'pair';
  sku: string;
  stoneSize: string;
  metal: string;
  mustKeep: string;
  quality: 'low' | 'medium' | 'high';
  clusterRhodiumFill: boolean;
  headShapeVariance: boolean;
  original: OriginalAnalysis;
  variations: Variation[];
  images: Map<number, string>; // index -> base64
  createdAt: number;
}

class JobManager {
  private jobs = new Map<string, JobRecord>();
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor() {
    // Cleanup expired jobs every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  createJob(params: {
    photoBuffer: Buffer;
    mimeType: string;
    originalFileName: string;
    diamondCount: number;
    countFor: 'piece' | 'pair';
    sku: string;
    stoneSize: string;
    metal: string;
    mustKeep: string;
    quality: 'low' | 'medium' | 'high';
    clusterRhodiumFill: boolean;
    headShapeVariance: boolean;
    original: OriginalAnalysis;
    variations: Variation[];
  }): JobRecord {
    const jobId = crypto.randomBytes(8).toString('hex');
    const job: JobRecord = {
      ...params,
      jobId,
      images: new Map(),
      createdAt: Date.now(),
    };
    this.jobs.set(jobId, job);
    return job;
  }

  getJob(jobId: string): JobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    if (Date.now() - job.createdAt > this.TTL_MS) {
      this.jobs.delete(jobId);
      return undefined;
    }
    return job;
  }

  setImage(jobId: string, index: number, imageBase64: string): boolean {
    const job = this.getJob(jobId);
    if (!job) return false;
    job.images.set(index, imageBase64);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > this.TTL_MS) {
        this.jobs.delete(id);
      }
    }
  }
}

export const jobStore = new JobManager();
