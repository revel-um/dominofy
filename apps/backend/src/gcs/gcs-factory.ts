import { Injectable } from '@nestjs/common';
import { GcsService } from './gcs.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './gcs.entity';

/**
 * GCS Service Factory - provides a singleton instance of GcsService
 * that can be used anywhere in the application without dependency injection
 */
export class GcsServiceFactory {
  private static instance: GcsService | null = null;

  /**
   * Initialize the GCS service instance
   * This should be called during application bootstrap
   */
  public static initialize(assetRepository: Repository<Asset>): void {
    if (!GcsServiceFactory.instance) {
      GcsServiceFactory.instance = new GcsService(assetRepository);
    }
  }

  /**
   * Get the singleton GCS service instance
   * Returns null if not initialized
   */
  public static getInstance(): GcsService | null {
    return GcsServiceFactory.instance;
  }

  /**
   * Reset the instance (mainly for testing)
   */
  public static reset(): void {
    GcsServiceFactory.instance = null;
  }
}

/**
 * Convenience function to get the GCS service instance
 * Throws an error if not initialized
 */
export function getGcsService(): GcsService {
  const instance = GcsServiceFactory.getInstance();
  if (!instance) {
    throw new Error('GcsService not initialized. Call GcsServiceFactory.initialize() during app bootstrap.');
  }
  return instance;
}