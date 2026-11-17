import {
  ACIKLAMA_BOYUTLARI,
  ACIKLAMA_HAM_SINIR,
  ACIKLAMA_RENKLERI,
  ACIKLAMA_SINIR,
  type AciklamaBoyutu,
  type AciklamaEtiketi,
  type AciklamaRengi,
  aciklamaDuz,
  aciklamaSar,
  butonOran,
  colors,
  kartOran,
} from '@rengarenk/shared';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AciklamaGoster } from '../aciklama';
import { T, TInput } from '../t';
import { girdiStil } from './ortak';

type Secim = { start: number; end: number };

/**
 * 5. adım: biçimli açıklama (sahip isteği, 17 Kasım 2026; web `AciklamaEditoru` ile aynı). Araç çubuğu seçili yazıyı
 * etiketle sarar (kalın, italik, renk, boyut); altta talep sayfasındaki görünümü gösterilir. Sınır düz metne uygulanır.
 */
export function AciklamaEditoru({
  value,
  onChange,
  hata,
  etiket = 'Açıklama',
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  hata?: string;
  etiket?: string;
}) {
  const metin = value ?? '';
  const uzunluk = aciklamaDuz(metin).length;
  // Son seçim (araç çubuğuna basınca okunur) ve sarmadan sonra bir kez uygulanacak seçim
  const secim = useRef<Secim>({ start: metin.length, end: metin.length });
  const [zorla, setZorla] = useState<Secim | undefined>(undefined);

  const sar = (e: AciklamaEtiketi, d?: string) => {
    const bas = Math.min(secim.current.start, secim.current.end, metin.length);
    const son = Math.min(Math.max(secim.current.start, secim.current.end), metin.length);
    const r = aciklamaSar(metin, bas, son, { e, d });
    if (r.metin.length > ACIKLAMA_HAM_SINIR) return;
    onChange(r.metin);
    secim.current = { start: r.bas, end: r.son };
    setZorla({ start: r.bas, end: r.son });
  };

  const dugme = {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: butonOran(8),
    minWidth: 34,
    height: 34,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  const ayrac = <View style={{ width: 1, height: 24, backgroundColor: colors.line, marginHorizontal: 2 }} />;

  return (
    <View>
      <T style={{ fontSize: 13, fontWeight: '800', marginBottom: 6 }}>{etiket}</T>
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Açıklama biçimi"
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kalın"
          onPress={() => sar('k')}
          style={dugme}
        >
          <T style={{ fontSize: 14, fontWeight: '800' }}>K</T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="İtalik"
          onPress={() => sar('i')}
          style={dugme}
        >
          <T style={{ fontSize: 14, fontWeight: '700', fontStyle: 'italic' }}>İ</T>
        </Pressable>
        {ayrac}
        {(Object.keys(ACIKLAMA_RENKLERI) as AciklamaRengi[]).map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            accessibilityLabel={`${ACIKLAMA_RENKLERI[r].ad} yazı`}
            onPress={() => sar('renk', r)}
            style={{ ...dugme, minWidth: 30, width: 30, paddingHorizontal: 0 }}
          >
            <View
              style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: ACIKLAMA_RENKLERI[r].hex }}
            />
          </Pressable>
        ))}
        {ayrac}
        {(Object.keys(ACIKLAMA_BOYUTLARI) as AciklamaBoyutu[]).map((b) => (
          <Pressable
            key={b}
            accessibilityRole="button"
            accessibilityLabel={`${ACIKLAMA_BOYUTLARI[b].ad} yazı`}
            onPress={() => sar('boyut', b)}
            style={dugme}
          >
            <T style={{ fontSize: 13 * ACIKLAMA_BOYUTLARI[b].oran, fontWeight: '700' }}>
              {ACIKLAMA_BOYUTLARI[b].ad}
            </T>
          </Pressable>
        ))}
      </View>
      <TInput
        accessibilityLabel={etiket}
        multiline
        numberOfLines={6}
        maxLength={ACIKLAMA_HAM_SINIR}
        value={metin}
        selection={zorla}
        onSelectionChange={(e) => {
          secim.current = e.nativeEvent.selection;
          // Sarmadan sonraki seçim bir kez uygulanır; sonra imleç yine kullanıcıda
          if (zorla) setZorla(undefined);
        }}
        onChangeText={(s) => onChange(s || undefined)}
        style={{ ...girdiStil, minHeight: 120, textAlignVertical: 'top', lineHeight: 21 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
        <T style={{ flex: 1, fontSize: 12, color: colors.muted }}>
          Yazıyı seçip düğmeye bas. Telefon, IBAN veya bağlantı yazma; iletişimi aşağıdan ayarla.
        </T>
        <T style={{ fontSize: 12, color: uzunluk > ACIKLAMA_SINIR ? '#A3271F' : colors.muted }}>
          {uzunluk} / {ACIKLAMA_SINIR}
        </T>
      </View>
      {hata ? (
        <T
          accessibilityRole="alert"
          style={{ color: '#A3271F', fontWeight: '700', fontSize: 12.5, marginTop: 6 }}
        >
          {hata}
        </T>
      ) : null}
      {metin.trim() ? (
        <View
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.line,
            borderRadius: kartOran(14),
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <T style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>
            Talep sayfasında böyle görünecek
          </T>
          <AciklamaGoster metin={metin} sabit />
        </View>
      ) : null}
    </View>
  );
}
