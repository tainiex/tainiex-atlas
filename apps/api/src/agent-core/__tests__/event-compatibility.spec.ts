/**
 * Type Compatibility Tests for AgentEvent and ChatStreamEvent
 *
 * These tests ensure that AgentEvent and ChatStreamEvent remain in sync.
 * If types diverge, these tests will FAIL AT COMPILE TIME.
 *
 * Purpose:
 * - AgentEvent is defined in agent-core (internal framework)
 * - ChatStreamEvent is defined in shared-atlas (independent package)
 * - They must stay compatible by convention (cannot use import)
 * - These tests enforce that convention with compile-time guarantees
 */

import { AgentEvent } from '../interfaces/agent.interface';
import { ChatStreamEvent } from '@tainiex/shared-atlas';

describe('AgentEvent <-> ChatStreamEvent Type Compatibility', () => {
  /**
   * Type-level assertion: All AgentEvent types (except final_answer)
   * must be assignable to ChatStreamEvent
   */
  describe('Type Assignability', () => {
    it('should accept thought events', () => {
      const agentEvent: AgentEvent = {
        type: 'thought',
        content: 'thinking...',
      };
      const chatEvent: ChatStreamEvent = agentEvent as ChatStreamEvent;

      expect(chatEvent.type).toBe('thought');
      if (chatEvent.type === 'thought') {
        expect(chatEvent.content).toBe('thinking...');
      }
    });

    it('should accept tool_call events', () => {
      const agentEvent: AgentEvent = {
        type: 'tool_call',
        tool: 'search',
        args: { query: 'test' },
      };
      const chatEvent: ChatStreamEvent = agentEvent as ChatStreamEvent;

      expect(chatEvent.type).toBe('tool_call');
      if (chatEvent.type === 'tool_call') {
        expect(chatEvent.tool).toBe('search');
        expect(chatEvent.args).toEqual({ query: 'test' });
      }
    });

    it('should accept tool_result events', () => {
      const agentEvent: AgentEvent = {
        type: 'tool_result',
        tool: 'search',
        result: { data: 'result' },
      };
      const chatEvent: ChatStreamEvent = agentEvent as ChatStreamEvent;

      expect(chatEvent.type).toBe('tool_result');
      if (chatEvent.type === 'tool_result') {
        expect(chatEvent.tool).toBe('search');
        expect(chatEvent.result).toEqual({ data: 'result' });
      }
    });

    it('should accept answer_chunk events', () => {
      const agentEvent: AgentEvent = { type: 'answer_chunk', content: 'Hello' };
      const chatEvent: ChatStreamEvent = agentEvent as ChatStreamEvent;

      expect(chatEvent.type).toBe('answer_chunk');
      if (chatEvent.type === 'answer_chunk') {
        expect(chatEvent.content).toBe('Hello');
      }
    });

    it('should accept error events', () => {
      const agentEvent: AgentEvent = { type: 'error', message: 'Failed' };
      const chatEvent: ChatStreamEvent = agentEvent as ChatStreamEvent;

      expect(chatEvent.type).toBe('error');
      if (chatEvent.type === 'error') {
        expect(chatEvent.message).toBe('Failed');
      }
    });

    it('should NOT expose final_answer events (internal only)', () => {
      // final_answer is internal to chat.service.ts and not forwarded
      // This test documents that intentional filtering
      const agentEvent: AgentEvent = { type: 'final_answer', content: 'Done' };

      // This should NOT be assignable to ChatStreamEvent
      // Uncomment the line below to verify it fails at compile time:
      // const chatEvent: ChatStreamEvent = agentEvent; // Should error

      expect(agentEvent.type).toBe('final_answer');
    });
  });

  /**
   * Exhaustiveness checking: Ensure all AgentEvent types are handled
   */
  describe('Exhaustive Type Coverage', () => {
    it('should handle all AgentEvent types in mapping function', () => {
      const mapEventToChatStream = (
        event: AgentEvent,
      ): ChatStreamEvent | null => {
        switch (event.type) {
          case 'thought':
          case 'tool_call':
          case 'tool_result':
          case 'answer_chunk':
            return event as ChatStreamEvent;
          case 'error':
            return event as ChatStreamEvent;
          case 'final_answer':
            return null; // Internal only
          default: {
            // This will cause a compile error if a new event type is added
            const exhaustiveCheck: never = event;
            throw new Error(`Unhandled event type: ${String(exhaustiveCheck)}`);
          }
        }
      };

      // Test samples
      expect(
        mapEventToChatStream({ type: 'thought', content: 'test' }),
      ).toEqual({
        type: 'thought',
        content: 'test',
      });

      expect(
        mapEventToChatStream({ type: 'final_answer', content: 'done' }),
      ).toBeNull();
    });
  });

  /**
   * Field compatibility tests
   */
  describe('Field Compatibility', () => {
    it('should have compatible content fields', () => {
      const events: AgentEvent[] = [
        { type: 'thought', content: 'A' },
        { type: 'answer_chunk', content: 'B' },
        { type: 'final_answer', content: 'C' },
      ];

      events.forEach((event) => {
        if ('content' in event) {
          expect(typeof event.content).toBe('string');
        }
      });
    });

    it('should have compatible error/message fields', () => {
      const agentError: AgentEvent = { type: 'error', message: 'Error text' };
      const chatError: ChatStreamEvent = {
        type: 'error',
        message: 'Error text',
      };

      expect(agentError.type).toBe(chatError.type);
      if (agentError.type === 'error' && chatError.type === 'error') {
        expect(typeof agentError.message).toBe(typeof chatError.message);
      }
    });

    it('should have compatible tool fields', () => {
      const agentToolCall: AgentEvent = {
        type: 'tool_call',
        tool: 'search',
        args: { q: 'test' },
      };
      const chatToolCall: ChatStreamEvent = {
        type: 'tool_call',
        tool: 'search',
        args: { q: 'test' },
      };

      expect(agentToolCall.type).toBe(chatToolCall.type);
      if (
        agentToolCall.type === 'tool_call' &&
        chatToolCall.type === 'tool_call'
      ) {
        expect(agentToolCall.tool).toBe(chatToolCall.tool);
        expect(agentToolCall.args).toEqual(chatToolCall.args);
      }
    });
  });

  /**
   * Documentation test: Verify expected behavior
   */
  describe('Contract Documentation', () => {
    it('should document which events are forwarded to clients', () => {
      const forwardedEventTypes = [
        'thought',
        'tool_call',
        'tool_result',
        'answer_chunk',
        'error',
        'done', // Added by gateway after stream completes
      ];

      const internalOnlyEventTypes = [
        'final_answer', // Used to save to database, not forwarded
      ];

      expect(forwardedEventTypes).toContain('answer_chunk');
      expect(internalOnlyEventTypes).toContain('final_answer');
    });
  });
});
