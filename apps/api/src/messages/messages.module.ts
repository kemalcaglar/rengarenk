import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { FlagsModule } from '../flags/flags.module.js';
import { ModerationCoreModule, ModerationServiceModule } from '../moderation/moderation.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { TrustModule } from '../trust/trust.module.js';
import { FirstMessageDraft } from './first-message-draft.js';
import { MessageSafety } from './message-safety.js';
import { ConversationsController, FirstMessageController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { RealtimeService } from './realtime.service.js';

/** Mesajlaşma (Aşama 5): ilk mesaj ve haklar, sohbet, araç kartı, numara paylaşımı, engelleme, anlık iletim. */
@Module({
  imports: [AuthModule, EntitlementsModule, TrustModule, ModerationCoreModule, ModerationServiceModule],
  controllers: [FirstMessageController, ConversationsController],
  providers: [MessagesService, FirstMessageDraft, RealtimeService, OutboxService],
  exports: [MessagesService, RealtimeService],
})
export class MessagesModule {}

/** İşçi: yapay zekâ destekli mesaj güvenliği (Karar 42) */
@Module({
  imports: [FlagsModule],
  providers: [MessageSafety, OutboxService],
  exports: [MessageSafety],
})
export class MessageSafetyModule {}
