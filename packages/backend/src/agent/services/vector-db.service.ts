/**
 * Vector Database Service
 * Manages vector storage and similarity search using pgvector
 * Requirements: 9.2, 9.3
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimilaritySearchResult {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  similarity: number;
}

@Injectable()
export class VectorDbService {
  private readonly logger = new Logger(VectorDbService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Add documents to vector database
   * Generates embeddings and stores them
   * Property 33: Embedding Storage Completeness
   * Validates: Requirements 9.2
   */
  async addDocuments(
    documents: Array<{ content: string; metadata?: Record<string, unknown> }>
  ): Promise<VectorDocument[]> {
    try {
      const results: VectorDocument[] = [];

      for (const doc of documents) {
        // Generate embedding for document
        const embedding = await this.embeddingService.generateEmbedding(
          doc.content
        );

        // Store in database
        const created = await (this.prisma as any).vectorDocument.create({
          data: {
            content: doc.content,
            embedding: embedding as unknown, // pgvector type
            metadata: doc.metadata || {},
          },
        });

        results.push({
          id: created.id,
          content: created.content,
          embedding,
          metadata: created.metadata as Record<string, unknown>,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        });

        this.logger.debug(
          `Added document to vector database: ${created.id} (${doc.content.length} chars)`
        );
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Failed to add documents: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Perform similarity search using pgvector
   * Property 34: Top-K Retrieval Accuracy
   * Property 35: Similarity Score Inclusion
   * Validates: Requirements 9.3, 9.5
   */
  async similaritySearch(
    query: string,
    k: number = 5
  ): Promise<SimilaritySearchResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding =
        await this.embeddingService.generateEmbedding(query);

      // Use pgvector for similarity search
      // The <=> operator computes the L2 distance
      // We convert distance to similarity: similarity = 1 / (1 + distance)
      const results = await (this.prisma as any).$queryRaw<
        Array<{
          id: string;
          content: string;
          metadata: Record<string, unknown>;
          distance: number;
        }>
      >`
        SELECT 
          id, 
          content, 
          metadata,
          embedding <=> ${JSON.stringify(queryEmbedding)}::vector as distance
        FROM vector_documents
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${k}
      `;

      // Convert distance to similarity score
      const searchResults: SimilaritySearchResult[] = results.map((result) => ({
        id: result.id,
        content: result.content,
        metadata: result.metadata,
        similarity: 1 / (1 + result.distance), // Convert L2 distance to similarity
      }));

      this.logger.debug(
        `Similarity search completed: found ${searchResults.length} results for query (${query.length} chars)`
      );

      return searchResults;
    } catch (error) {
      this.logger.error(
        `Failed to perform similarity search: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<VectorDocument | null> {
    try {
      const doc = await (this.prisma as any).vectorDocument.findUnique({
        where: { id },
      });

      if (!doc) {
        return null;
      }

      return {
        id: doc.id,
        content: doc.content,
        embedding: doc.embedding as number[],
        metadata: doc.metadata as Record<string, unknown>,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get document: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Delete document by ID
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      await (this.prisma as any).vectorDocument.delete({
        where: { id },
      });

      this.logger.debug(`Deleted document from vector database: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete document: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(
    id: string,
    metadata: Record<string, unknown>
  ): Promise<VectorDocument> {
    try {
      const updated = await (this.prisma as any).vectorDocument.update({
        where: { id },
        data: {
          metadata,
        },
      });

      return {
        id: updated.id,
        content: updated.content,
        embedding: updated.embedding as number[],
        metadata: updated.metadata as Record<string, unknown>,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update document metadata: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Clear all documents from vector database
   */
  async clear(): Promise<void> {
    try {
      await (this.prisma as any).vectorDocument.deleteMany({});
      this.logger.debug('Cleared all documents from vector database');
    } catch (error) {
      this.logger.error(
        `Failed to clear vector database: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get total document count
   */
  async getDocumentCount(): Promise<number> {
    try {
      return await (this.prisma as any).vectorDocument.count();
    } catch (error) {
      this.logger.error(
        `Failed to get document count: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
