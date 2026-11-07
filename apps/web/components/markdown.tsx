import { colors } from '@rengarenk/shared';
import type { ReactNode } from 'react';

/** Satır içi: **kalın** ve [metin](https://…) bağlantı; HTML yorumlanmaz. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    else
      out.push(
        <a key={`${key}-a${i++}`} href={m[3]} rel="noreferrer">
          {m[2]}
        </a>,
      );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

const cell = {
  padding: '10px 12px',
  borderBottom: '1px solid #EEF0F5',
  textAlign: 'left' as const,
  fontSize: 14,
};

/**
 * Yasal metin ve yardım yazıları için küçük Markdown gösterici: başlık (##, ###), paragraf, madde ve sıra
 * listesi, tablo, alıntı. Tasarımın kart ve yazı ölçüleri (Yardim.dc.html).
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div style={{ fontSize: 15, lineHeight: 1.65, color: colors.inkSoft }}>
      {blocks.map((raw, bi) => {
        const b = raw.trim();
        const key = `b${bi}`;
        if (!b) return null;
        if (b.startsWith('### '))
          return (
            <h3 key={key} style={{ margin: '22px 0 6px', fontSize: 17, fontWeight: 800, color: colors.ink }}>
              {inline(b.slice(4), key)}
            </h3>
          );
        if (b.startsWith('## '))
          return (
            <h2 key={key} style={{ margin: '26px 0 8px', fontSize: 19, fontWeight: 800, color: colors.ink }}>
              {inline(b.slice(3), key)}
            </h2>
          );
        const lines = b.split('\n');
        if (lines.every((l) => l.trim().startsWith('|'))) {
          const rows = lines
            .filter((l) => !/^\s*\|\s*-{3,}/.test(l))
            .map((l) =>
              l
                .trim()
                .replace(/^\||\|$/g, '')
                .split('|')
                .map((c) => c.trim()),
            );
          const [headRow, ...bodyRows] = rows;
          const head = (headRow ?? []).map((c, ci) => ({ c, id: `${key}h${ci}` }));
          const body = bodyRows.map((r, ri) => ({
            id: `${key}r${ri}`,
            cells: r.map((c, ci) => ({ c, id: `${key}r${ri}c${ci}` })),
          }));
          return (
            <div key={key} style={{ overflowX: 'auto', margin: '12px 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
                <thead>
                  <tr>
                    {head.map(({ c, id }) => (
                      <th
                        key={id}
                        style={{ ...cell, fontWeight: 800, color: colors.ink, background: '#F6F8FD' }}
                      >
                        {inline(c, id)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r) => (
                    <tr key={r.id}>
                      {r.cells.map(({ c, id }) => (
                        <td key={id} style={cell}>
                          {inline(c, id)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (lines.every((l) => /^\s*[-*] /.test(l)))
          return (
            <ul key={key} style={{ margin: '8px 0', paddingLeft: 22 }}>
              {lines
                .map((l, li) => ({ l, id: `${key}l${li}` }))
                .map(({ l, id }) => (
                  <li key={id} style={{ margin: '4px 0' }}>
                    {inline(l.replace(/^\s*[-*] (\[[ x]\] )?/, ''), id)}
                  </li>
                ))}
            </ul>
          );
        if (lines.every((l) => /^\s*\d+\. /.test(l)))
          return (
            <ol key={key} style={{ margin: '8px 0', paddingLeft: 24 }}>
              {lines
                .map((l, li) => ({ l, id: `${key}o${li}` }))
                .map(({ l, id }) => (
                  <li key={id} style={{ margin: '4px 0' }}>
                    {inline(l.replace(/^\s*\d+\. /, ''), id)}
                  </li>
                ))}
            </ol>
          );
        if (lines.every((l) => l.startsWith('>')))
          return (
            <blockquote
              key={key}
              style={{
                margin: '12px 0',
                padding: '12px 16px',
                background: '#F6F8FD',
                borderRadius: 14,
                color: colors.ink,
                fontWeight: 600,
              }}
            >
              {inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' '), key)}
            </blockquote>
          );
        return (
          <p key={key} style={{ margin: '8px 0' }}>
            {inline(lines.join(' '), key)}
          </p>
        );
      })}
    </div>
  );
}
