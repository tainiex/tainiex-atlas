// Mock uuid to avoid ESM issues in Jest
jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-0000-0000-000000000000'),
}));
