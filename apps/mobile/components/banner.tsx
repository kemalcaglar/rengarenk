import { type BannerPlace, butonOran, colors, kartOran } from '@rengarenk/shared';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API, ziyaretciKimligi } from '../lib/api';
import { useOturum } from '../lib/oturum';
import { T } from './t';

interface Banner {
  id: string;
  kol: 'A' | 'B';
  baslik: string;
  metin: string;
  dugme: string;
  url: string;
  renk: string;
  zemin: string;
}

const olay = (id: string, tur: 'gosterim' | 'tiklama', kol: 'A' | 'B') =>
  fetch(`${API}/icerik/banner/${id}/olay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tur, kol }),
  }).catch(() => undefined);

/** Uygulama açıkken aynı banner için tek gösterim sayılır */
const sayilan = new Set<string>();

/**
 * Konsoldan yayınlanan banner ve duyurular (Karar 46): yer, kitle (ziyaretçi, üye, galeri ve il), platform ve tarihe
 * göre API seçer. Gösterim ve tıklama günlük toplam olarak sayılır; kişisel veri gönderilmez.
 */
export function Banner({ yer, style }: { yer: BannerPlace; style?: ViewStyle }) {
  const { durum, istek } = useOturum();
  const router = useRouter();
  const [liste, setListe] = useState<Banner[]>([]);

  useEffect(() => {
    if (durum === 'yukleniyor') return;
    let iptal = false;
    // Ziyaretçide A/B kolu cihazdaki rastgele kimlikten (sunucuda saklanmaz); üyede hesaptan
    const al =
      durum === 'uye'
        ? istek<Banner[]>(`/icerik/banner?yer=${yer}&platform=mobil`)
        : ziyaretciKimligi()
            .then((z) => fetch(`${API}/icerik/banner?yer=${yer}&platform=mobil&z=${encodeURIComponent(z)}`))
            .then((r) => (r.ok ? (r.json() as Promise<Banner[]>) : []));
    al.then((b) => {
      if (iptal) return;
      setListe(b);
      for (const x of b)
        if (!sayilan.has(x.id)) {
          sayilan.add(x.id);
          olay(x.id, 'gosterim', x.kol);
        }
    }).catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [yer, durum, istek]);

  if (!liste.length) return null;
  const git = (b: Banner) => {
    olay(b.id, 'tiklama', b.kol);
    router.push(b.url as Href);
  };

  // Üst şerit ekranların üstünde, çentiğin altında (bakım duyurusu gibi)
  if (yer === 'ust_serit')
    return (
      <SafeAreaView edges={['top']} style={{ backgroundColor: liste[0]?.zemin }}>
        {liste.map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole={b.url ? 'link' : 'text'}
            disabled={!b.url}
            onPress={() => git(b)}
            style={{
              backgroundColor: b.zemin,
              borderBottomWidth: 3,
              borderBottomColor: b.renk,
              paddingVertical: 8,
              paddingHorizontal: 16,
            }}
          >
            <T style={{ fontSize: 13, textAlign: 'center' }}>
              <T style={{ fontSize: 13, fontWeight: '800' }}>{b.baslik}</T>
              {b.metin ? ` · ${b.metin}` : ''}
              {b.dugme && b.url ? (
                <T style={{ fontSize: 13, fontWeight: '800', color: colors.link }}> {b.dugme}</T>
              ) : null}
            </T>
          </Pressable>
        ))}
      </SafeAreaView>
    );

  return (
    <View style={[{ gap: 10 }, style]}>
      {liste.map((b) => (
        <View
          key={b.id}
          accessibilityLabel={yer === 'duyuru' ? 'Duyuru' : 'Banner'}
          style={{
            backgroundColor: b.zemin,
            borderWidth: 1,
            borderColor: colors.line,
            borderLeftWidth: 6,
            borderLeftColor: b.renk,
            borderRadius: kartOran(16),
            padding: 14,
            gap: 10,
          }}
        >
          <View>
            <T style={{ fontSize: 15.5, fontWeight: '800' }}>{b.baslik}</T>
            {b.metin ? (
              <T style={{ fontSize: 13.5, color: colors.inkSoft, marginTop: 3, lineHeight: 19 }}>{b.metin}</T>
            ) : null}
          </View>
          {b.dugme && b.url ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => git(b)}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: colors.ink,
                borderRadius: butonOran(12),
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              <T style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>{b.dugme}</T>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
