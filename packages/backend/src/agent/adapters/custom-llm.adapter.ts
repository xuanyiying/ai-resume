import { AIEngineService } from '../../ai-providers/ai-engine.service';

/**
 * CustomLLM adapter that wraps AIEngineService for LangChain compatibility
 * Ensures all LLM calls go through existing monitoring and optimization
 *
 * Property 1: LangChain Adapter Routing
 * Validates: Requirements 1.3
 */
export class CustomLLM {
  lmType = 'custom-ai-engine';

  constructor(
    private aiEngineService: AIEngineService,
    private userId: string,
    private scenario: string
  ) {}

  _llmType(): string {
    return 'custom-ai-engine';
  }

  /**
   * Call the LLM through AIEngineService
   * Routes all requests through existing monitoring, tracking, and optimization
   *
   * @param prompt - The prompt to send to the LLM
   * @param _stop - Stop sequences (unused)
   * @returns The LLM response content
   */
  async _call(prompt: string, _stop?: string[]): Promise<string> {
    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        temperature: 0.7,
        maxTokens: 2000,
      },
      this.userId,
      this.scenario
    );

    return response.content;
  }
}
