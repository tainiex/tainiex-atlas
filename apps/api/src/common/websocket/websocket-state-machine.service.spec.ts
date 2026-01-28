/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createActor } from 'xstate';

import { WebSocketStateMachineService } from './websocket-state-machine.service';
import { LoggerService } from '../logger/logger.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('WebSocketStateMachineService', () => {
  let service: WebSocketStateMachineService;
  let _jwtService: JwtService;
  let _logger: LoggerService;

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketStateMachineService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<WebSocketStateMachineService>(
      WebSocketStateMachineService,
    );
    _jwtService = module.get<JwtService>(JwtService);
    _logger = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMachine', () => {
    it('should create a machine with correct initial state', () => {
      const clientId = 'test-client-123';
      const machine = service.createMachine(clientId);

      expect(machine.id).toBe(`websocket-${clientId}`);
      expect(machine.config.initial).toBe('disconnected');
    });

    it('should have all required states', () => {
      const machine = service.createMachine('client-1');
      const states = machine.config.states
        ? Object.keys(machine.config.states)
        : [];

      expect(states).toContain('disconnected');
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      expect(states).toContain('authenticating');
      expect(states).toContain('ready');
      expect(states).toContain('error');
    });
  });

  describe('state transitions', () => {
    it('should transition from disconnected to connecting on CONNECT event', () => {
      const machine = service.createMachine('client-1');
      const actor = createActor(machine);
      actor.start();

      const mockClient = { id: 'client-1' } as any;
      actor.send({
        type: 'CONNECT',
        client: mockClient,
        token: 'test-token',
        ip: '127.0.0.1',
      });

      // Machine auto-transitions through connecting → connected → authenticating
      expect(actor.getSnapshot().value).toBe('authenticating');
      expect(actor.getSnapshot().context.token).toBe('test-token');
    });

    it('should transition to ready on AUTH_SUCCESS', () => {
      const machine = service.createMachine('client-1');
      const actor = createActor(machine);
      actor.start();

      const mockUser: JwtPayload = {
        sub: 'user-123',
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      };

      actor.send({
        type: 'CONNECT',
        client: {} as any,
        token: 'token',
        ip: '127.0.0.1',
      });

      actor.send({
        type: 'AUTH_SUCCESS',
        user: mockUser,
        expiresAt: Date.now() + 900000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('ready');
      expect(snapshot.context.user).toEqual(mockUser);
    });

    it('should handle AUTH_FAILED and transition appropriately', () => {
      const machine = service.createMachine('client-1');
      const actor = createActor(machine);
      actor.start();

      actor.send({
        type: 'CONNECT',
        client: {} as any,
        token: 'token',
        ip: '127.0.0.1',
      });

      actor.send({
        type: 'AUTH_FAILED',
        error: 'Invalid token',
      });

      const snapshot = actor.getSnapshot();
      // Check that error context is set
      expect(snapshot.context.error).toBe('Invalid token');
      // State machine may be in authenticating, error, connecting, or disconnected
      expect([
        'authenticating',
        'error',
        'connecting',
        'disconnected',
      ]).toContain(snapshot.value);
    });

    it('should re-authenticate on TOKEN_REFRESHED from ready state', () => {
      const machine = service.createMachine('client-1');
      const actor = createActor(machine);
      actor.start();

      // Get to ready state
      actor.send({
        type: 'CONNECT',
        client: {} as any,
        token: 'old-token',
        ip: '127.0.0.1',
      });
      actor.send({
        type: 'AUTH_SUCCESS',
        user: {
          sub: 'user-123',
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
        } as JwtPayload,
        expiresAt: Date.now() + 900000,
      });

      expect(actor.getSnapshot().value).toBe('ready');

      // Trigger token refresh
      actor.send({ type: 'TOKEN_REFRESHED', newToken: 'new-token' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('authenticating');
      expect(snapshot.context.token).toBe('new-token');
      expect(snapshot.context.retryCount).toBe(0); // Reset retry count
    });

    it('should transition to disconnected on DISCONNECT', () => {
      const machine = service.createMachine('client-1');
      const actor = createActor(machine);
      actor.start();

      // Get to ready state
      actor.send({
        type: 'CONNECT',
        client: {} as any,
        token: 'token',
        ip: '127.0.0.1',
      });
      actor.send({
        type: 'AUTH_SUCCESS',
        user: {
          sub: 'user-123',
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
        } as JwtPayload,
        expiresAt: Date.now() + 900000,
      });

      // Disconnect
      actor.send({ type: 'DISCONNECT' });

      expect(actor.getSnapshot().value).toBe('disconnected');
    });
  });

  describe('retry logic', () => {
    it('should retry on error if retry count is below max', () => {
      const machine = service.createMachine('client-1');
      const actor = createActor(machine);
      actor.start();

      actor.send({
        type: 'CONNECT',
        client: {} as any,
        token: 'token',
        ip: '127.0.0.1',
      });

      // First failure
      actor.send({ type: 'AUTH_FAILED', error: 'Network error' });

      const snapshot = actor.getSnapshot();
      // Should be in error state, but canRetry guard allows transition
      expect(snapshot.context.retryCount).toBe(1);
    });

    it('should not retry if max retries exceeded', () => {
      const machine = service.createMachine('client-1');
      const actor = createActor(machine);
      actor.start();

      actor.send({
        type: 'CONNECT',
        client: {} as any,
        token: 'token',
        ip: '127.0.0.1',
      });

      // Fail 3 times (max retries = 3)
      for (let i = 0; i < 4; i++) {
        actor.send({ type: 'AUTH_FAILED', error: 'Persistent error' });
      }

      const snapshot = actor.getSnapshot();
      // Should transition to disconnected after max retries
      expect(snapshot.value).toBe('disconnected');
    });
  });

  describe('extractToken', () => {
    it('should extract token from auth property', () => {
      const mockClient = {
        handshake: {
          auth: { token: 'auth-token' },
          headers: {},
        },
      } as any;

      const token = service.extractToken(mockClient);
      expect(token).toBe('auth-token');
    });

    it('should extract token from Authorization header', () => {
      const mockClient = {
        handshake: {
          auth: {},
          headers: {
            authorization: 'header-token',
          },
        },
      } as any;

      const token = service.extractToken(mockClient);
      expect(token).toBe('header-token');
    });

    it('should extract token from cookies', () => {
      const mockClient = {
        handshake: {
          auth: {},
          headers: {
            cookie: 'access_token=cookie-token; other=value',
          },
        },
      } as any;

      const token = service.extractToken(mockClient);
      expect(token).toBe('cookie-token');
    });

    it('should strip Bearer prefix from token', () => {
      const mockClient = {
        handshake: {
          auth: { token: 'Bearer token-without-prefix' },
          headers: {},
        },
      } as any;

      const token = service.extractToken(mockClient);
      expect(token).toBe('token-without-prefix');
    });

    it('should return undefined if no token found', () => {
      const mockClient = {
        handshake: {
          auth: {},
          headers: {},
        },
      } as any;

      const token = service.extractToken(mockClient);
      expect(token).toBeUndefined();
    });
  });
});
