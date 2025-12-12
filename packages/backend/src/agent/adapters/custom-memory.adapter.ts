import { BaseMemory } from '@langchain/core/memory';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { RedisService } from '../../redis/redis.service';

/**
 * CustomMemory adapter for LangChain compatibility
 * Wraps Redis-based conversation history storage with TTL-based expiration
 *
 * Property 26: Cache-First Behavior
 * Property 28: Cache Expiration Handling
 * Validates: Requirements 4.3, 7.1, 7.5
 */
export class CustomMemory extends BaseMemory {
  private sessionId: string;
  private readonly DEFAULT_TTL = 3600; // 1 hour in seconds
  chatHistory: BaseMessage[] = [];

  constructor(
    private redisService: RedisService,
    sessionId: string
  ) {
    super();
    this.sessionId = sessionId;
  }

  /**
   * Load conversation history from Redis
   * Returns the stored conversation history for the session
   *
   * @returns Memory variables containing conversation history
   */
  async loadMemoryVariables(): Promise<Record<string, BaseMessage[]>> {
    const key = `interview:${this.sessionId}:history`;
    const history = await this.redisService.get(key);

    // Refresh TTL on access to keep active sessions alive
    if (history) {
      await this.redisService.expire(key, this.DEFAULT_TTL);
    }

    const messages = history ? JSON.parse(history) : [];

    // Convert to BaseMessage objects
    this.chatHistory = messages.map((msg: Record<string, string>) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      }
      return new AIMessage(msg.content);
    });

    return {
      chatHistory: this.chatHistory,
    };
  }

  /**
   * Save conversation context to Redis
   * Stores both user input and assistant output with timestamps
   * Implements TTL-based expiration for automatic cleanup
   *
   * Property 26: Cache-First Behavior
   * Property 28: Cache Expiration Handling
   * Validates: Requirements 4.3, 7.1, 7.5
   *
   * @param inputValues - User input values
   * @param outputValues - Assistant output values
   */
  async saveContext(
    inputValues: Record<string, string>,
    outputValues: Record<string, string>
  ): Promise<void> {
    const key = `interview:${this.sessionId}:history`;
    const history = await this.redisService.get(key);
    const messages = history ? JSON.parse(history) : [];

    // Add user message
    messages.push({
      role: 'user',
      content: inputValues.input,
      timestamp: new Date().toISOString(),
    });

    // Add assistant message
    messages.push({
      role: 'assistant',
      content: outputValues.output,
      timestamp: new Date().toISOString(),
    });

    // Store with TTL-based expiration
    // This ensures conversation history is automatically cleaned up
    await this.redisService.set(
      key,
      JSON.stringify(messages),
      this.DEFAULT_TTL
    );

    // Update in-memory chat history
    this.chatHistory.push(new HumanMessage(inputValues.input));
    this.chatHistory.push(new AIMessage(outputValues.output));
  }

  /**
   * Get memory key for this memory instance
   * Required by BaseMemory interface
   *
   * @returns Array of memory keys
   */
  get memoryKeys(): string[] {
    return ['chatHistory'];
  }

  /**
   * Clear conversation history for this session
   * Removes the session key from Redis
   */
  async clear(): Promise<void> {
    const key = `interview:${this.sessionId}:history`;
    await this.redisService.del(key);
    this.chatHistory = [];
  }
}
