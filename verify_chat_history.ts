import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ChatService } from './src/chat/chat.service';
import { ChatRole } from '@shared/index';
import { ChatMessage } from './src/chat/chat-message.entity';
import { ChatMessageHistory } from './src/chat/chat-message-history.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatSession } from './src/chat/chat-session.entity';

async function verify() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const chatService = app.get(ChatService);
    const historyRepo = app.get(getRepositoryToken(ChatMessageHistory));
    const messageRepo = app.get(getRepositoryToken(ChatMessage));
    const sessionRepo = app.get(getRepositoryToken(ChatSession));

    // 1. Setup User & Session (Mocking User ID)
    // Let's just find ANY session to get a userId
    const existingSession = await sessionRepo.findOne({ where: {} });
    if (!existingSession) { console.log('No session found to grab userId. Ensure DB has data.'); process.exit(0); }
    const userId = existingSession.userId;

    console.log('Using UserID:', userId);

    // 2. Create New Session
    const session = await chatService.createSession(userId);
    console.log('Created Session:', session.id);

    // 3. Send Message A (Root)
    const msgA = await chatService.addMessage(session.id, userId, 'Message A', ChatRole.USER);
    console.log('Msg A:', msgA.id, 'Parent:', msgA.parentId);

    // 4. Send Message B (Reply to A)
    const msgB = await chatService.addMessage(session.id, userId, 'Message B', ChatRole.USER, msgA.id);
    console.log('Msg B:', msgB.id, 'Parent:', msgB.parentId);

    if (msgB.parentId !== msgA.id) throw new Error('Msg B parent invalid');

    // 5. Send Message C (Reply to B, Implicit)
    // Should default to last message (B)
    const msgC = await chatService.addMessage(session.id, userId, 'Message C', ChatRole.USER);
    console.log('Msg C:', msgC.id, 'Parent:', msgC.parentId);

    if (msgC.parentId !== msgB.id) throw new Error('Msg C parent invalid (implicit linkage failed)');

    // 6. Verify Path
    const path = await chatService.getHistoryPath(session.id, msgC.id);
    console.log('Path Length:', path.length);
    // Expected: A -> B -> C
    if (path[0].id !== msgA.id) throw new Error('Path root invalid');
    if (path[2].id !== msgC.id) throw new Error('Path leaf invalid');

    console.log('--- Linear Verification Passed ---');

    // 7. Test Update (Edit B)
    console.log('Updating Msg B...');
    const updatedB = await chatService.updateMessage(session.id, userId, msgB.id, 'Message B Edited');
    console.log('Updated B Content:', updatedB.content);

    // 8. Verify History
    const histories = await historyRepo.find({ where: { messageId: msgB.id } });
    console.log('History entries for B:', histories.length);
    if (histories.length !== 1) throw new Error('History not created');
    console.log('Original Content in History:', histories[0].content);
    if (histories[0].content !== 'Message B') throw new Error('History content mismatch');

    // 9. Verify C still points to B
    const recheckC = await messageRepo.findOne({ where: { id: msgC.id } });
    if (recheckC.parentId !== msgB.id) throw new Error('Linkage broken after update');

    console.log('--- Edit Verification Passed ---');
    await app.close();
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
