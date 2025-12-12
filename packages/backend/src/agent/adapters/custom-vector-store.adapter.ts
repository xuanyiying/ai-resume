import { VectorStore } from '@langchain/core/vectorstores';
import { Embeddings } from '@langchain/core/embeddings';
import { Document, DocumentInterface } from '@langchain/core/documents';

/**
 * CustomVectorStore adapter for LangChain compatibility
 * Wraps vector database operations for RAG functionality
 *
 * Property 34: Top-K Retrieval Accuracy
 * Property 35: Similarity Score Inclusion
 * Validates: Requirements 1.5, 9.3, 9.5
 */
export class CustomVectorStore extends VectorStore {
  private vectorDbService: unknown;

  constructor(embeddings: Embeddings, vectorDbService?: unknown) {
    super(embeddings, {});
    this.vectorDbService = vectorDbService;
  }

  _vectorstoreType(): string {
    return 'custom-vector-store';
  }

  async addVectors(
    _vectors: number[][],
    documents: DocumentInterface<Record<string, unknown>>[]
  ): Promise<void | string[]> {
    if (!this.vectorDbService) {
      throw new Error('VectorDbService not initialized');
    }

    // Convert LangChain documents to vector DB format
    const docsToAdd = documents.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata || {},
    }));

    // Delegate to vector DB service for embedding generation and storage
    const service = this.vectorDbService as Record<string, unknown>;
    await (service.addDocuments as (docs: unknown[]) => Promise<void>)(
      docsToAdd
    );

    // Return document IDs
    return documents.map((_, index) => `doc_${index}`);
  }

  async similaritySearchVectorWithScore(
    _query: number[],
    _k: number
  ): Promise<[DocumentInterface<Record<string, unknown>>, number][]> {
    throw new Error('Use similaritySearchWithScore instead');
  }

  /**
   * Add documents to the vector store
   * Generates embeddings and stores them in the vector database
   *
   * Property 33: Embedding Storage Completeness
   * Validates: Requirements 9.2
   *
   * @param documents - LangChain documents to add
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.vectorDbService) {
      throw new Error('VectorDbService not initialized');
    }

    // Convert LangChain documents to vector DB format
    const docsToAdd = documents.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata || {},
    }));

    // Delegate to vector DB service for embedding generation and storage
    const service = this.vectorDbService as Record<string, unknown>;
    await (service.addDocuments as (docs: unknown[]) => Promise<void>)(
      docsToAdd
    );
  }

  /**
   * Search for similar documents by query
   * Returns top-k most similar documents with similarity scores
   *
   * Property 34: Top-K Retrieval Accuracy
   * Property 35: Similarity Score Inclusion
   * Validates: Requirements 9.3, 9.5
   *
   * @param query - Query string
   * @param k - Number of results to return
   * @returns Array of [Document, similarity_score] tuples
   */
  async similaritySearchWithScore(
    query: string,
    k: number
  ): Promise<[Document, number][]> {
    if (!this.vectorDbService) {
      throw new Error('VectorDbService not initialized');
    }

    // Delegate to vector DB service for similarity search
    const service = this.vectorDbService as Record<string, unknown>;
    const results = await (
      service.similaritySearch as (
        q: string,
        k: number
      ) => Promise<Record<string, unknown>[]>
    )(query, k);

    // Convert results back to LangChain Document format with scores
    return results.map((result: Record<string, unknown>) => [
      new Document({
        pageContent: result.content as string,
        metadata: result.metadata as Record<string, unknown>,
      }),
      result.similarity as number,
    ]);
  }
}
