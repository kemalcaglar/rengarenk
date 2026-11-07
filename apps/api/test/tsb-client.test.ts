import { describe, expect, it } from 'vitest';
import { HttpTsbClient } from '../src/catalog/tsb-client.js';

/** Gerçek istemcinin isteklerini, ağa çıkmadan, fetch'in kendi başlık denetiminden geçirerek dener. */
function fakeFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fn = (async (input: string | URL, init?: RequestInit) => {
    new Headers(init?.headers); // ASCII dışı başlık varsa burada hata fırlar (gerçek fetch gibi)
    const url = String(input);
    calls.push(url);
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) return new Response('yok', { status: 404 });
    const body = hit[1];
    return body instanceof Uint8Array ? new Response(body) : Response.json(body);
  }) as typeof fetch;
  return { fn, calls };
}

describe('TSB istemcisi', () => {
  it('son dosya ve arşiv adresini okur; başlıklar geçerlidir', async () => {
    const f = fakeFetch({
      GetLatestExcelFile: {
        HasError: false,
        Message: 'Ekim',
        Result: '/content/InsuranceExcelFiles/202610R2.xlsx',
      },
      'GetInsuranceDataArchiveFile?Year=2020&MonthId=5': '/content/InsuranceExcelFiles/202004R1.xlsx',
      'GetInsuranceDataArchiveFile?Year=2019': null,
    });
    const c = new HttpTsbClient('https://www.tsb.org.tr', f.fn);
    expect(await c.latest()).toEqual({
      fileName: '202610R2.xlsx',
      url: 'https://www.tsb.org.tr/content/InsuranceExcelFiles/202610R2.xlsx',
      monthLabel: 'Ekim',
    });
    expect((await c.archive(2020, 4))?.fileName).toBe('202004R1.xlsx');
    expect(await c.archive(2019, 1)).toBeNull();
  });

  it('başka siteye ya da xlsx olmayan dosyaya yönlendirmeyi reddeder', async () => {
    const other = new HttpTsbClient(
      'https://www.tsb.org.tr',
      fakeFetch({ GetLatestExcelFile: { Result: 'https://kotu.example/x.xlsx' } }).fn,
    );
    await expect(other.latest()).rejects.toThrow('beklenmeyen');
    const exe = new HttpTsbClient(
      'https://www.tsb.org.tr',
      fakeFetch({ GetLatestExcelFile: { Result: '/content/x.exe' } }).fn,
    );
    await expect(exe.latest()).rejects.toThrow('xlsx');
  });
});
