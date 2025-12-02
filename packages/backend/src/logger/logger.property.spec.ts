import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ErrorLoggerService } from './error-logger.service';
import * as fc from 'fast-check';

/**
 * Logger Property-Based Tests
 * **Feature: resume-optimizer-mvp, Property 33: 结构化日志记录**
 * **Validates: Requirements 12.5**
 */
describe('Logger System - Property Tests', () => {
  let errorLoggerService: ErrorLoggerService;
  let mockLogger: any;

  beforeEach(async () => {
    // Create a mock logger for testing
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorLoggerService,
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    errorLoggerService = module.get<ErrorLoggerService>(ErrorLoggerService);
  });

  describe('Property 33: Structured Logging', () => {
    it('should log all required fields in structured format', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (message: string, context: string) => {
            mockLogger.info.mockClear();

            errorLoggerService.logInfo(message, context);

            expect(mockLogger.info).toHaveBeenCalled();
            const logCall = mockLogger.info.mock.calls[0];
            const logData = logCall[1] as any;

            // Verify all required fields are present
            expect(logData).toHaveProperty('timestamp');
            expect(logData).toHaveProperty('context');
            expect(logData).toHaveProperty('message');

            // Verify timestamp is ISO format
            expect(typeof logData.timestamp).toBe('string');
            expect(new Date(logData.timestamp).toISOString()).toBe(
              logData.timestamp
            );

            // Verify context and message match input
            expect(logData.context).toBe(context);
            expect(logData.message).toBe(message);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include additional data in structured logs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.record({
            userId: fc.string(),
            requestId: fc.string(),
            duration: fc.integer({ min: 0, max: 10000 }),
          }),
          (message: string, context: string, additionalData) => {
            mockLogger.info.mockClear();

            errorLoggerService.logInfo(message, context, additionalData);

            expect(mockLogger.info).toHaveBeenCalled();
            const logCall = mockLogger.info.mock.calls[0];
            const logData = logCall[1] as any;

            // Verify additional data is included
            expect(logData).toHaveProperty('userId');
            expect(logData).toHaveProperty('requestId');
            expect(logData).toHaveProperty('duration');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log errors with stack traces', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (message: string, context: string) => {
            mockLogger.error.mockClear();
            const error = new Error(message);

            errorLoggerService.logError(error, context);

            expect(mockLogger.error).toHaveBeenCalled();
            const logCall = mockLogger.error.mock.calls[0];
            const logData = logCall[1] as any;

            // Verify error fields are present
            expect(logData).toHaveProperty('message');
            expect(logData).toHaveProperty('stack');
            expect(logData).toHaveProperty('context');
            expect(logData).toHaveProperty('timestamp');

            // Verify stack trace is a string
            expect(typeof logData.stack).toBe('string');
            expect(logData.stack).toContain('Error');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support different log levels', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (message: string, context: string) => {
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            errorLoggerService.logInfo(message, context);
            errorLoggerService.logWarning(message, context);
            errorLoggerService.logDebug(message, context);

            expect(mockLogger.info).toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include request context in API error logs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid(),
          fc.option(fc.uuid()),
          (message: string, context: string, requestId: string, userId) => {
            mockLogger.error.mockClear();

            errorLoggerService.logApiError(
              message,
              context,
              requestId,
              userId || undefined
            );

            expect(mockLogger.error).toHaveBeenCalled();
            const logCall = mockLogger.error.mock.calls[0];
            const logData = logCall[1] as any;

            // Verify request context fields
            expect(logData).toHaveProperty('requestId');
            expect(logData).toHaveProperty('userId');
            expect(logData.requestId).toBe(requestId);
            expect(logData.userId).toBe(userId || 'anonymous');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include database context in database error logs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string({ minLength: 1, maxLength: 200 })),
          (message: string, query) => {
            mockLogger.error.mockClear();

            errorLoggerService.logDatabaseError(message, query || undefined);

            expect(mockLogger.error).toHaveBeenCalled();
            const logCall = mockLogger.error.mock.calls[0];
            const logData = logCall[1] as any;

            // Verify database context
            expect(logData).toHaveProperty('context');
            expect(logData.context).toBe('Database');
            if (query) {
              expect(logData).toHaveProperty('query');
              expect(logData.query).toBe(query);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include external service context in service error logs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string({ minLength: 1, maxLength: 200 })),
          fc.option(fc.integer({ min: 400, max: 599 })),
          (service: string, message: string, endpoint, statusCode) => {
            mockLogger.error.mockClear();

            errorLoggerService.logExternalServiceError(
              service,
              message,
              endpoint || undefined,
              statusCode || undefined
            );

            expect(mockLogger.error).toHaveBeenCalled();
            const logCall = mockLogger.error.mock.calls[0];
            const logData = logCall[1] as any;

            // Verify external service context
            expect(logData).toHaveProperty('context');
            expect(logData.context).toContain(service);
            if (endpoint) {
              expect(logData).toHaveProperty('endpoint');
              expect(logData.endpoint).toBe(endpoint);
            }
            if (statusCode) {
              expect(logData).toHaveProperty('statusCode');
              expect(logData.statusCode).toBe(statusCode);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
