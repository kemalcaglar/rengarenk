import { createSign } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

// ── E-posta (Karar 50: Amazon SES, SMTP ile) ───────────────────

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** İşlemsel (varsayılan) ya da ticari: SES'te ayrı yapılandırma kümesi, biri şikâyet alırsa öteki etkilenmez */
  akis?: 'islemsel' | 'ticari';
  /** Ek (ör. zamanlanmış raporun PDF'i ve Excel'i) */
  attachments?: { filename: string; content: Buffer | string; contentType: string }[];
}

export interface EmailResult {
  /** kalici: adres yok ya da alan reddediyor (gönderim dışı listeye alınır) */
  status: 'sent' | 'temporary' | 'permanent';
  id: string | null;
  message: string | null;
}

export interface EmailSender {
  readonly ad: string;
  send(m: EmailMessage): Promise<EmailResult>;
}

class NoEmail implements EmailSender {
  readonly ad = 'none';
  async send(): Promise<EmailResult> {
    return { status: 'temporary', id: null, message: 'E-posta kanalı kapalı' };
  }
}

/** Test: gönderilenler bellekte */
export class MemoryEmail implements EmailSender {
  readonly ad = 'memory';
  readonly sent: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<EmailResult> {
    this.sent.push(m);
    if (m.to.endsWith('@kalici-hata.test'))
      return { status: 'permanent', id: null, message: '550 adres yok' };
    return { status: 'sent', id: `mem-${this.sent.length}`, message: null };
  }
}

/** SES'in yapılandırma kümesini seçen başlık (Karar 50); küme tanımlı değilse boş */
export function sesBasliklari(
  env: Pick<Env, 'SES_YAPILANDIRMA_ISLEMSEL' | 'SES_YAPILANDIRMA_TICARI'>,
  m: Pick<EmailMessage, 'akis'>,
): Record<string, string> {
  const kume = m.akis === 'ticari' ? env.SES_YAPILANDIRMA_TICARI : env.SES_YAPILANDIRMA_ISLEMSEL;
  return kume ? { 'X-SES-CONFIGURATION-SET': kume } : {};
}

class SmtpEmail implements EmailSender {
  readonly ad = 'smtp';
  private readonly t: Transporter;
  constructor(private readonly env: Env) {
    this.t = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === '1',
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
    });
  }
  async send(m: EmailMessage): Promise<EmailResult> {
    try {
      const { akis: _akis, ...ileti } = m;
      const r = await this.t.sendMail({ ...ileti, headers: { ...m.headers, ...sesBasliklari(this.env, m) } });
      if (r.rejected?.length) return { status: 'permanent', id: r.messageId, message: 'Alıcı reddedildi' };
      return { status: 'sent', id: r.messageId ?? null, message: null };
    } catch (e) {
      const err = e as { responseCode?: number; message: string };
      const kalici = (err.responseCode ?? 0) >= 500 && (err.responseCode ?? 0) < 600;
      return { status: kalici ? 'permanent' : 'temporary', id: null, message: err.message.slice(0, 300) };
    }
  }
}

export function createEmailSender(env: Env): EmailSender {
  if (env.EMAIL_PROVIDER === 'smtp') return new SmtpEmail(env);
  if (env.EMAIL_PROVIDER === 'memory') return new MemoryEmail();
  return new NoEmail();
}

// ── Push (Karar 48: Firebase Cloud Messaging) ──────────────────

export interface PushMessage {
  token: string;
  baslik: string;
  metin: string;
  url: string | null;
}

export interface PushResult {
  /** gecersiz: cihaz anahtarı artık geçerli değil (kapatılır) */
  status: 'sent' | 'temporary' | 'invalid';
  id: string | null;
  message: string | null;
}

export interface PushSender {
  readonly ad: string;
  send(m: PushMessage): Promise<PushResult>;
}

class NoPush implements PushSender {
  readonly ad = 'none';
  async send(): Promise<PushResult> {
    return { status: 'temporary', id: null, message: 'Push kanalı kapalı' };
  }
}

/** Geliştirme ve test: "gecersiz" ile başlayan anahtar geçersiz sayılır */
export class FakePush implements PushSender {
  readonly ad = 'fake';
  readonly sent: PushMessage[] = [];
  async send(m: PushMessage): Promise<PushResult> {
    if (m.token.startsWith('gecersiz')) return { status: 'invalid', id: null, message: 'UNREGISTERED' };
    this.sent.push(m);
    return { status: 'sent', id: `fake-${this.sent.length}`, message: null };
  }
}

/**
 * FCM HTTP v1 (firebase.google.com/docs/cloud-messaging/send-message): hizmet hesabıyla imzalı JWT → OAuth erişim
 * jetonu → `POST /v1/projects/{proje}/messages:send`. Push içeriğine kişisel veri konmaz: başlık ve kısa metin.
 */
class FcmPush implements PushSender {
  readonly ad = 'fcm';
  private readonly sa: { project_id: string; client_email: string; private_key: string };
  private jeton: { deger: string; bitis: number } | null = null;
  constructor(json: string) {
    this.sa = JSON.parse(Buffer.from(json, 'base64').toString('utf8'));
  }
  private async erisim() {
    if (this.jeton && this.jeton.bitis > Date.now() + 60_000) return this.jeton.deger;
    const simdi = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const govde = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
      iss: this.sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: simdi,
      exp: simdi + 3600,
    })}`;
    const imza = createSign('RSA-SHA256').update(govde).sign(this.sa.private_key, 'base64url');
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${govde}.${imza}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await r.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) throw new Error(`FCM erişim jetonu alınamadı (${r.status})`);
    this.jeton = { deger: j.access_token, bitis: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  }
  async send(m: PushMessage): Promise<PushResult> {
    try {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${this.sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await this.erisim()}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: m.token,
            notification: { title: m.baslik, body: m.metin },
            data: m.url ? { url: m.url } : {},
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const j = (await r.json().catch(() => ({}))) as {
        name?: string;
        error?: { status?: string; message?: string };
      };
      if (r.ok) return { status: 'sent', id: j.name ?? null, message: null };
      const gecersiz =
        r.status === 404 || j.error?.status === 'UNREGISTERED' || j.error?.status === 'INVALID_ARGUMENT';
      return {
        status: gecersiz ? 'invalid' : 'temporary',
        id: null,
        message: j.error?.message?.slice(0, 300) ?? null,
      };
    } catch (e) {
      return { status: 'temporary', id: null, message: (e as Error).message.slice(0, 300) };
    }
  }
}

export function createPushSender(env: Env): PushSender {
  if (env.PUSH_PROVIDER === 'fcm' && env.FCM_SERVICE_ACCOUNT) return new FcmPush(env.FCM_SERVICE_ACCOUNT);
  if (env.PUSH_PROVIDER === 'fake') return new FakePush();
  return new NoPush();
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export const PUSH_SENDER = Symbol('PUSH_SENDER');
