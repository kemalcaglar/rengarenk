import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Redis } from 'ioredis';
import { type WebSocket, WebSocketServer } from 'ws';
import { AuthService } from '../auth/auth.service.js';
import { ENV, type Env } from '../config/env.js';

const KANAL = 'rr:canli';
/** Giriş iletisi bu süre içinde gelmezse bağlantı kapanır */
const GIRIS_SURESI_MS = 10_000;
const NABIZ_MS = 30_000;

type Soket = WebSocket & { userId?: string; canli?: boolean };

/**
 * Anlık iletim (Teknik tasarım §8): `/ws` üzerinden WebSocket. İstemci bağlanınca ilk iletide erişim jetonunu
 * gönderir (`{"tip":"giris","jeton":"…"}`); jeton adres satırına yazılmaz, böylece günlüklere düşmez. Jetonun süresi
 * dolunca bağlantı kapanır, istemci yeni jetonla yeniden bağlanır. Birden çok API sürecinde iletiler Redis yayınıyla
 * dağıtılır; Redis yoksa yalnızca bu süreçteki bağlantılara gider. Çevrimdışı kullanıcıya bildirim katmanı ulaşır.
 */
@Injectable()
export class RealtimeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(RealtimeService.name);
  private readonly sockets = new Map<string, Set<Soket>>();
  private wss: WebSocketServer | null = null;
  private pub: Redis | null = null;
  private sub: Redis | null = null;
  private nabiz: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly auth: AuthService,
    private readonly host: HttpAdapterHost,
  ) {}

  onApplicationBootstrap() {
    const server = this.host.httpAdapter?.getHttpServer() as Server | undefined;
    if (server) this.attach(server);
  }

  /** HTTP sunucusunun yükseltme isteklerini `/ws` için devralır. */
  attach(server: Server) {
    if (this.wss) return;
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (!req.url?.startsWith('/ws')) return;
      this.wss?.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws as Soket));
    });
    this.nabiz = setInterval(() => {
      for (const ws of this.wss?.clients ?? []) {
        const s = ws as Soket;
        if (s.canli === false) {
          s.terminate();
          continue;
        }
        s.canli = false;
        s.ping();
      }
    }, NABIZ_MS);
    this.listen().catch((err: Error) => this.log.warn(`Redis yayını açılamadı: ${err.message}`));
  }

  private async listen() {
    this.pub = new Redis(this.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.sub = new Redis(this.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.pub.on('error', () => {});
    this.sub.on('error', () => {});
    await Promise.all([this.pub.connect(), this.sub.connect()]);
    await this.sub.subscribe(KANAL);
    this.sub.on('message', (_k, raw: string) => {
      try {
        const { u, d } = JSON.parse(raw) as { u: string[]; d: unknown };
        this.deliver(u, d);
      } catch {
        // bozuk ileti yok sayılır
      }
    });
  }

  private onConnection(ws: Soket) {
    ws.canli = true;
    ws.on('pong', () => {
      ws.canli = true;
    });
    const zaman = setTimeout(() => ws.close(4001, 'giris'), GIRIS_SURESI_MS);
    ws.on('message', async (raw) => {
      if (ws.userId) return; // istemciden yalnızca giriş iletisi beklenir; mesajlar HTTP ile gönderilir
      try {
        const m = JSON.parse(String(raw)) as { tip?: string; jeton?: string };
        if (m.tip !== 'giris' || typeof m.jeton !== 'string') throw new Error('giris');
        const claims = (await this.auth.verifyAccess(m.jeton)) as { sub: string; exp?: number };
        clearTimeout(zaman);
        ws.userId = claims.sub;
        const set = this.sockets.get(claims.sub) ?? new Set<Soket>();
        set.add(ws);
        this.sockets.set(claims.sub, set);
        if (claims.exp) {
          const kalan = claims.exp * 1000 - Date.now();
          setTimeout(() => ws.close(4002, 'jeton'), Math.max(0, Math.min(kalan, 2 ** 31 - 1)));
        }
        ws.send(JSON.stringify({ tip: 'hazir' }));
      } catch {
        ws.close(4001, 'giris');
      }
    });
    ws.on('close', () => {
      clearTimeout(zaman);
      if (!ws.userId) return;
      const set = this.sockets.get(ws.userId);
      set?.delete(ws);
      if (set && !set.size) this.sockets.delete(ws.userId);
    });
  }

  private deliver(userIds: string[], data: unknown) {
    const raw = JSON.stringify(data);
    for (const u of userIds) for (const ws of this.sockets.get(u) ?? []) ws.send(raw);
  }

  /** Kullanıcılara anlık ileti gönderir (veritabanı işlemi bittikten sonra çağrılır). */
  async publish(userIds: string[], data: unknown) {
    const u = [...new Set(userIds)];
    if (!u.length) return;
    if (this.pub?.status === 'ready') {
      try {
        await this.pub.publish(KANAL, JSON.stringify({ u, d: data }));
        return;
      } catch {
        // Redis düştüyse yerel bağlantılara gönderilir
      }
    }
    this.deliver(u, data);
  }

  onModuleDestroy() {
    if (this.nabiz) clearInterval(this.nabiz);
    for (const ws of this.wss?.clients ?? []) ws.terminate();
    this.wss?.close();
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
