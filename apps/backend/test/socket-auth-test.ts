import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken'; // Assuming we can use jsonwebtoken or similar, or just fetch via API if needed.
// We'll use jsonwebtoken to sign a test token locally matching the server secret.

const SERVER_URL = 'http://localhost:2020/activity';
const JWT_SECRET = process.env.JWT_SECRET || 'secretKey';

async function testAuth() {
  console.log('--- Testing Activity Gateway Authentication ---');

  // Case 1: No Token
  console.log('\n1. Connecting WITHOUT token...');
  await new Promise<void>((resolve) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
    });

    socket.on('connect', () => {
      console.error('❌ Error: Connected without token! (Should have failed)');
      socket.disconnect();
      resolve();
    });

    socket.on('disconnect', (reason) => {
      // In newer socket.io, server disconnect might be "io server disconnect"
      console.log('✅ Disconnected as expected:', reason);
      resolve();
    });

    socket.on('connect_error', (err) => {
      console.log('✅ Connection Error as expected:', err.message);
      resolve();
    });
  });

  // Case 2: With Valid Token
  console.log('\n2. Connecting WITH valid token...');
  const token = jwt.sign({ sub: 'test-user', id: 'test-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });

  await new Promise<void>((resolve) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });

    socket.on('connect', () => {
      console.log('✅ Connected successfully with token:', socket.id);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Connected Error with valid token:', err.message);
      resolve();
    });
  });
}

testAuth().catch((err) => console.error(err));
