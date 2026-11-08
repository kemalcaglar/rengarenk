import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

export type EidsSonuc = 'bekliyor' | 'onaylandi' | 'reddedildi';

/**
 * EİDS (Elektronik İlan Doğrulama Sistemi, Ticaret Bakanlığı; yönetmelik m.22/ç): ilan platformu aracın plakasıyla
 * istek açar, ruhsat sahibi e-Devlet'ten onaylar ya da reddeder. Bakanlık erişimi verince gerçek bağdaştırıcı bu
 * arayüzü uygular.
 */
export interface EidsProvider {
  readonly ad: string;
  /** İstek açar; kurumun referansını döner (bağlantı yoksa null) */
  request(i: { plate: string; chassisTail: string | null; taxNo: string }): Promise<string | null>;
  status(reference: string): Promise<{ sonuc: EidsSonuc; not?: string }>;
}

/** Bağlantı yok: istek açılamaz, araç doğrulama bekler ve alıcılara görünmez (Karar 17). */
export class NoEids implements EidsProvider {
  readonly ad = 'none';
  async request() {
    return null;
  }
  async status() {
    return { sonuc: 'bekliyor' as const, not: 'EİDS bağlantısı henüz kurulmadı' };
  }
}

/** Geliştirme ve test: "0" ile biten plaka reddedilir, "9" ile biten bekler, diğerleri onaylanır. */
export class FakeEids implements EidsProvider {
  readonly ad = 'fake';
  async request(i: { plate: string }) {
    return `sahte-${i.plate}`;
  }
  async status(reference: string) {
    if (reference.endsWith('0'))
      return { sonuc: 'reddedildi' as const, not: 'Ruhsat sahibi ilanı onaylamadı' };
    if (reference.endsWith('9')) return { sonuc: 'bekliyor' as const };
    return { sonuc: 'onaylandi' as const };
  }
}

@Injectable()
export class EidsFactory {
  constructor(@Inject(ENV) private readonly env: Env) {}
  create(): EidsProvider {
    return this.env.EIDS_PROVIDER === 'fake' ? new FakeEids() : new NoEids();
  }
}
