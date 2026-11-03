import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
  private tmpDir = os.tmpdir();

  constructor() {
    // Cleanup expired jobs every 10 minutes, unref to avoid blocking serverless function completion
    const timer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  private getFilePath(jobId: string): string {
    return path.join(this.tmpDir, `swa_job_${jobId}.json`);
  }

  private getPhotoPath(jobId: string): string {
    return path.join(this.tmpDir, `swa_job_${jobId}.photo`);
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

    // Save JSON and photo buffer to /tmp for multi-instance serverless resilience
    try {
      const serializable = {
        jobId: job.jobId,
        mimeType: job.mimeType,
        originalFileName: job.originalFileName,
        diamondCount: job.diamondCount,
        countFor: job.countFor,
        sku: job.sku,
        stoneSize: job.stoneSize,
        metal: job.metal,
        mustKeep: job.mustKeep,
        quality: job.quality,
        clusterRhodiumFill: job.clusterRhodiumFill,
        headShapeVariance: job.headShapeVariance,
        original: job.original,
        variations: job.variations,
        createdAt: job.createdAt,
      };
      fs.writeFileSync(this.getFilePath(jobId), JSON.stringify(serializable), 'utf8');
      if (job.photoBuffer && job.photoBuffer.length > 0) {
        fs.writeFileSync(this.getPhotoPath(jobId), job.photoBuffer);
      }
    } catch (e) {
      console.warn('[JobStore] Warning: Could not write job to tmp cache', e);
    }

    return job;
  }

  getJob(jobId: string): JobRecord | undefined {
    let job = this.jobs.get(jobId);
    if (!job) {
      // Try restoring from /tmp disk cache
      try {
        const filePath = this.getFilePath(jobId);
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(raw);
          const photoPath = this.getPhotoPath(jobId);
          const photoBuffer = fs.existsSync(photoPath) ? fs.readFileSync(photoPath) : Buffer.alloc(0);
          job = {
            ...data,
            photoBuffer,
            images: new Map(),
          };
          this.jobs.set(jobId, job as JobRecord);
        }
      } catch (e) {
        console.warn('[JobStore] Warning: Failed to read job from tmp cache', e);
      }
    }

    if (!job) return undefined;
    if (Date.now() - job.createdAt > this.TTL_MS) {
      this.jobs.delete(jobId);
      try {
        const filePath = this.getFilePath(jobId);
        const photoPath = this.getPhotoPath(jobId);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
      } catch {}
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
        try {
          const filePath = this.getFilePath(id);
          const photoPath = this.getPhotoPath(id);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
        } catch {}
      }
    }
  }
}

export const jobStore = new JobManager();
