import { createSign } from 'node:crypto';
import type { Env } from '../config/env.js';

export interface AiProviderRequest {
  /** Sağlayıcıdaki model kimliği (gemini-2.5-flash) */
  model: string;
  system: string;
  /** Maskelenmiş istek */
  prompt: string;
  /** Maskelenmiş kural metni: sahte sağlayıcı bunu döndürür, gerçek sağlayıcıya örnek olarak gider */
  taslak: string;
  maxOutputTokens: number;
}

export interface AiProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Yapay zekâ sağlayıcısı (T11). Ağ geçidi sağlayıcıdan bağımsızdır; istekler buraya maskelenmiş gelir. */
export interface AiProvider {
  readonly ad: 'fake' | 'vertex';
  generate(r: AiProviderRequest): Promise<AiProviderResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** Token tahmini: Türkçe metinde yaklaşık 4 karakter */
const tahmin = (s: string) => Math.max(1, Math.ceil(s.length / 4));

/** Geliştirme ve test: kural metnini döndürür; maliyet token tahminiyle sayılır (bütçe denemesi için) */
export class FakeAiProvider implements AiProvider {
  readonly ad = 'fake';
  readonly calls: AiProviderRequest[] = [];
  /** Test: true iken hata verir */
  fail = false;
  /** Test: doluysa taslak yerine bu metni döner (sağlayıcının kurala aykırı yanıtını denemek için) */
  yanit: string | null = null;
  async generate(r: AiProviderRequest): Promise<AiProviderResult> {
    this.calls.push(r);
    if (this.fail) throw new Error('sahte sağlayıcı hatası');
    const text = this.yanit ?? r.taslak;
    return { text, inputTokens: tahmin(r.system + r.prompt), outputTokens: tahmin(text) };
  }
}

/**
 * Google Vertex AI Gemini (cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference):
 * hizmet hesabıyla imzalı JWT → OAuth erişim jetonu → `POST .../publishers/google/models/{model}:generateContent`.
 * Gerçek anahtarla henüz denenmedi (hesap açılınca güncel belgeye göre doğrulanacak).
 */
class VertexAiProvider implements AiProvider {
  readonly ad = 'vertex';
  private readonly sa: { project_id: string; client_email: string; private_key: string };
  private jeton: { deger: string; bitis: number } | null = null;

  constructor(
    json: string,
    private readonly location: string,
  ) {
    this.sa = JSON.parse(Buffer.from(json, 'base64').toString('utf8'));
  }

  private async erisim() {
    if (this.jeton && this.jeton.bitis > Date.now() + 60_000) return this.jeton.deger;
    const simdi = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const govde = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
      iss: this.sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
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
    if (!j.access_token) throw new Error(`Vertex erişim jetonu alınamadı (${r.status})`);
    this.jeton = { deger: j.access_token, bitis: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  }

  async generate(q: AiProviderRequest): Promise<AiProviderResult> {
    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.sa.project_id}/locations/${this.location}/publishers/google/models/${q.model}:generateContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.erisim()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: q.system }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${q.prompt}\n\nKurallarla hazırlanan taslak (olgular bunlardır):\n${q.taslak}` },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: q.maxOutputTokens },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`Vertex yanıtı ${r.status}`);
    const j = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = (j.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('Vertex boş yanıt verdi');
    return {
      text,
      inputTokens: j.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}

/** none: sağlayıcı yok (ağ geçidi çağrı yapmaz, kural metni kullanılır) */
export function createAiProvider(env: Env): AiProvider | null {
  if (env.AI_PROVIDER === 'fake') return new FakeAiProvider();
  if (env.AI_PROVIDER === 'vertex')
    return new VertexAiProvider(env.VERTEX_SERVICE_ACCOUNT as string, env.VERTEX_LOCATION);
  return null;
}
