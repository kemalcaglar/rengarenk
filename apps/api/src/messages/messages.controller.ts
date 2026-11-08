import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { chatMessageSchema, firstMessageSchema, vehicleMessageSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { MessagesService } from './messages.service.js';

type AuthedRequest = { user: AccessClaims };
const uuid = new ParseUUIDPipe();

/** İlk mesaj: talebe (Karar 08, 11) ve alıcıdan portföy aracına (Karar 27) */
@Controller()
@UseGuards(AuthGuard)
export class FirstMessageController {
  constructor(private readonly messages: MessagesService) {}

  /** Talep sayfasındaki iletişim kutusu: yazılabilir mi, kalan hak */
  @Get('talepler/:no/mesaj')
  state(
    @Req() req: AuthedRequest,
    @Param('no', new ParseIntPipe()) no: number,
    @Query('hesap') hesap?: string,
  ) {
    return this.messages.demandState(req.user.sub, no, z.uuid().safeParse(hesap).success ? hesap : undefined);
  }

  @Post('talepler/:no/mesaj')
  first(
    @Req() req: AuthedRequest,
    @Param('no', new ParseIntPipe()) no: number,
    @Body(new ZodPipe(firstMessageSchema)) b: z.output<typeof firstMessageSchema>,
  ) {
    return this.messages.sendFirst(req.user.sub, no, b);
  }

  @Post('araclar/:no/mesaj')
  vehicle(
    @Req() req: AuthedRequest,
    @Param('no', new ParseIntPipe()) no: number,
    @Body(new ZodPipe(vehicleMessageSchema)) b: z.output<typeof vehicleMessageSchema>,
  ) {
    return this.messages.sendToVehicle(req.user.sub, no, b.metin);
  }
}

/** Mesajlarım ve sohbet ekranı */
@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.messages.list(req.user.sub);
  }

  @Get('unread')
  unread(@Req() req: AuthedRequest, @Query('hesap') hesap?: string) {
    return this.messages.unreadCount(req.user.sub, z.uuid().safeParse(hesap).success ? hesap : undefined);
  }

  @Get(':id')
  detail(@Req() req: AuthedRequest, @Param('id', uuid) id: string) {
    return this.messages.detail(req.user.sub, id);
  }

  @Post(':id/messages')
  send(
    @Req() req: AuthedRequest,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(chatMessageSchema)) b: z.output<typeof chatMessageSchema>,
  ) {
    return this.messages.send(req.user.sub, id, b);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@Req() req: AuthedRequest, @Param('id', uuid) id: string) {
    return this.messages.decline(req.user.sub, id);
  }

  @Post(':id/share-phone')
  @HttpCode(200)
  sharePhone(@Req() req: AuthedRequest, @Param('id', uuid) id: string) {
    return this.messages.sharePhone(req.user.sub, id);
  }

  @Post(':id/block')
  @HttpCode(200)
  block(@Req() req: AuthedRequest, @Param('id', uuid) id: string) {
    return this.messages.block(req.user.sub, id, true);
  }

  @Delete(':id/block')
  unblock(@Req() req: AuthedRequest, @Param('id', uuid) id: string) {
    return this.messages.block(req.user.sub, id, false);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@Req() req: AuthedRequest, @Param('id', uuid) id: string) {
    return this.messages.read(req.user.sub, id);
  }
}
