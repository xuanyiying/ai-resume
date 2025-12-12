import { Tool } from '@langchain/core/tools';
import { RAGService, RetrievedDocument } from '../services/rag.service';

/**
 * RAG Retrieval Tool
 * Retrieves relevant documents from knowledge base
 * Requirements: 1.4, 3.5
 */
export class RAGRetrievalTool extends Tool {
  name = 'knowledge_retrieval';
  description = 'Retrieves relevant information from knowledge base';

  constructor(private ragService: RAGService) {
    super();
  }

  async _call(query: string): Promise<string> {
    try {
      const results: RetrievedDocument[] = await this.ragService.retrieve(
        query,
        5
      );
      return JSON.stringify(results);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Failed to retrieve documents: ${errorMessage}`,
        results: [],
      });
    }
  }
}
