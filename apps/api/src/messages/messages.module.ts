import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { ConversationsController, FirstMessageController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { RealtimeService } from './realtime.service.js';

/** Mesajlaşma (Aşama 5): ilk mesaj ve haklar, sohbet, araç kartı, numara paylaşımı, engelleme, anlık iletim. */
@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [FirstMessageController, ConversationsController],
  providers: [MessagesService, RealtimeService, OutboxService],
  exports: [MessagesService, RealtimeService],
})
export class MessagesModule {}
