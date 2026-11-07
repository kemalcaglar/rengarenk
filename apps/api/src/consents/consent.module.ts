import { Global, Module } from '@nestjs/common';
import { ConsentController } from './consent.controller.js';
import { ConsentService } from './consent.service.js';

/** Rıza kayıtları ve yasal metinler (Karar 46, 59). Giriş akışı da kullanır. */
@Global()
@Module({ controllers: [ConsentController], providers: [ConsentService], exports: [ConsentService] })
export class ConsentModule {}
