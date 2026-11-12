import type { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { AI_MODELS } from '@rengarenk/shared';
import { describe, expect, it } from 'vitest';
import { BedrockAiProvider, type BedrockConverseClient } from '../src/ai/ai.provider.js';

/** Bedrock bağdaştırıcısı (Karar 37, 57): Converse isteğinin biçimi ve yanıtın okunması; ağa çıkmaz. */
class SahteIstemci implements BedrockConverseClient {
  komutlar: ConverseCommand[] = [];
  constructor(private readonly yanit: Awaited<ReturnType<BedrockConverseClient['send']>>) {}
  async send(command: ConverseCommand) {
    this.komutlar.push(command);
    return this.yanit;
  }
}

describe('Bedrock sağlayıcısı', () => {
  it('maskeli isteği Converse biçiminde gönderir, metni ve token sayısını okur', async () => {
    const istemci = new SahteIstemci({
      output: { message: { content: [{ text: ' Merhaba ' }, { text: '[TELEFON_1]' }] } },
      usage: { inputTokens: 120, outputTokens: 30 },
    });
    const p = new BedrockAiProvider(istemci);
    const r = await p.generate({
      model: AI_MODELS.bedrock.kucuk.id,
      system: 'Kısa yaz.',
      prompt: 'Talep: [TELEFON_1]',
      taslak: 'kural metni',
      maxOutputTokens: 256,
    });
    expect(p.ad).toBe('bedrock');
    expect(r).toEqual({ text: 'Merhaba [TELEFON_1]', inputTokens: 120, outputTokens: 30 });
    const girdi = istemci.komutlar[0]?.input;
    expect(girdi?.modelId).toBe('eu.amazon.nova-lite-v1:0');
    expect(girdi?.system).toEqual([{ text: 'Kısa yaz.' }]);
    expect(girdi?.inferenceConfig).toEqual({ temperature: 0.2, maxTokens: 256 });
    const metin = girdi?.messages?.[0]?.content?.[0]?.text ?? '';
    expect(metin).toContain('Talep: [TELEFON_1]');
    expect(metin).toContain('kural metni');
  });

  it('boş yanıtta hata verir (ağ geçidi kural metnine döner)', async () => {
    const p = new BedrockAiProvider(new SahteIstemci({ output: { message: { content: [] } } }));
    await expect(
      p.generate({ model: 'x', system: 's', prompt: 'p', taslak: 't', maxOutputTokens: 10 }),
    ).rejects.toThrow('Bedrock boş yanıt verdi');
  });
});
