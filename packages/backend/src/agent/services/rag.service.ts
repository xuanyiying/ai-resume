/**
 * RAG (Retrieval-Augmented Generation) Service
 * Handles document retrieval and RAG-based generation
 * Requirements: 3.5, 5.2
 */

import { Injectable, Logger } from '@nestjs/common';
import { VectorDbService } from './vector-db.service';
import { AIEngineService } from '../../ai-providers/ai-engine.service';

export interface RetrievedDocument {
  id: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface RAGGenerationResult {
  answer: string;
  sources: RetrievedDocument[];
  inputTokens: number;
  outputTokens: number;
}

export interface InterviewQuestion {
  id?: string;
  question: string;
  suggestedAnswer?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'technical' | 'behavioral' | 'scenario';
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    private vectorDbService: VectorDbService,
    private aiEngineService: AIEngineService
  ) {}

  /**
   * Retrieve relevant documents from knowledge base
   * Property 13: RAG Usage for Common Questions
   * Validates: Requirements 3.5, 5.2
   */
  async retrieve(query: string, k: number = 5): Promise<RetrievedDocument[]> {
    try {
      const results = await this.vectorDbService.similaritySearch(query, k);

      const documents: RetrievedDocument[] = results.map((result) => ({
        id: result.id,
        content: result.content,
        similarity: result.similarity,
        metadata: result.metadata,
      }));

      this.logger.debug(
        `Retrieved ${documents.length} documents for query: "${query.substring(0, 50)}..."`
      );

      return documents;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve documents: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Retrieve and generate answer using RAG
   * Combines retrieval with LLM generation
   */
  async retrieveAndGenerate(
    query: string,
    userId: string,
    k: number = 5
  ): Promise<RAGGenerationResult> {
    try {
      // Step 1: Retrieve relevant documents
      const documents = await this.retrieve(query, k);

      // Step 2: Construct context from retrieved documents
      const context = documents
        .map((doc) => `[Source ${doc.id}]\n${doc.content}`)
        .join('\n\n');

      // Step 3: Generate response with context
      const response = await this.aiEngineService.call(
        {
          model: '',
          prompt: `Based on the following context, answer the question.\n\nContext:\n${context}\n\nQuestion: ${query}`,
        },
        userId,
        'rag-generation'
      );

      this.logger.debug(
        `Generated RAG response for query: "${query.substring(0, 50)}..."`
      );

      return {
        answer: response.content,
        sources: documents,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve and generate: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Retrieve interview questions from knowledge base
   * Filters by experience level and keywords
   * Property 13: RAG Usage for Common Questions
   * Validates: Requirements 3.5
   */
  async retrieveQuestions(
    keywords: string[],
    experienceLevel: 'junior' | 'mid' | 'senior',
    k: number = 10
  ): Promise<InterviewQuestion[]> {
    try {
      // Create search query from keywords
      const searchQuery = `Interview questions for ${keywords.join(', ')} at ${experienceLevel} level`;

      // Retrieve documents
      const documents = await this.retrieve(searchQuery, k);

      // Parse documents as interview questions
      const questions: InterviewQuestion[] = documents
        .map((doc) => {
          try {
            // Try to parse as JSON first
            const parsed = JSON.parse(doc.content) as Record<string, unknown>;
            const difficulty = (parsed.difficulty as string) || 'medium';
            const type = (parsed.type as string) || 'technical';

            // Validate difficulty and type
            const validDifficulty =
              difficulty === 'easy' ||
              difficulty === 'medium' ||
              difficulty === 'hard'
                ? (difficulty as 'easy' | 'medium' | 'hard')
                : 'medium';

            const validType =
              type === 'technical' ||
              type === 'behavioral' ||
              type === 'scenario'
                ? (type as 'technical' | 'behavioral' | 'scenario')
                : 'technical';

            return {
              id: doc.id,
              question: (parsed.question as string) || doc.content,
              suggestedAnswer: (parsed.suggestedAnswer as string) || undefined,
              difficulty: validDifficulty,
              type: validType,
              metadata: {
                ...doc.metadata,
                similarity: doc.similarity,
              },
            };
          } catch {
            // If not JSON, treat content as question
            return {
              id: doc.id,
              question: doc.content,
              difficulty: 'medium' as const,
              type: 'technical' as const,
              metadata: {
                ...doc.metadata,
                similarity: doc.similarity,
              },
            };
          }
        })
        .filter((q) => q.question && q.question.length > 0);

      this.logger.debug(
        `Retrieved ${questions.length} interview questions for keywords: ${keywords.join(', ')}`
      );

      return questions;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve questions: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Add documents to knowledge base
   */
  async addDocuments(
    documents: Array<{ content: string; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    try {
      await this.vectorDbService.addDocuments(documents);
      this.logger.debug(
        `Added ${documents.length} documents to knowledge base`
      );
    } catch (error) {
      this.logger.error(
        `Failed to add documents: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Clear knowledge base
   */
  async clearKnowledgeBase(): Promise<void> {
    try {
      await this.vectorDbService.clear();
      this.logger.debug('Cleared knowledge base');
    } catch (error) {
      this.logger.error(
        `Failed to clear knowledge base: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
