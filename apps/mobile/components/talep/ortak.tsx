import { type CategoryField, colors, ILLER, PAINT_PARTS, PAINT_STATES } from '@rengarenk/shared';
import { type ReactNode, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { Ikon } from '../ikon';
import { T, TInput } from '../t';

/** Sihirbazın ortak mobil bileşenleri (SihirbazMobilAkis.dc.html, SihirbazMobil.dc.html) */

export const binlik = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : new Intl.NumberFormat('tr-TR').format(n);
export const sayiOku = (s: string) => {
  const d = s.replace(/\D/g, '');
  return d ? Number(d) : undefined;
};

export const kartStil = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 16,
  padding: 14,
} as const;

export const girdiStil = {
  borderWidth: 1,
  borderColor: '#D5DAE5',
  borderRadius: 12,
  padding: 11,
  fontSize: 15,
  backgroundColor: colors.surface,
} as const;

/** Seçim çipi: seçiliyken 2 px mavi çerçeve ve açık mavi zemin */
export function Cip({
  on,
  children,
  onPress,
  hex,
}: {
  on: boolean;
  children: ReactNode;
  onPress: () => void;
  hex?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: on ? 2 : 1,
        borderColor: on ? colors.blue : '#D5DAE5',
        backgroundColor: on ? '#EEF3FF' : colors.surface,
        borderRadius: 999,
        paddingVertical: on ? 7 : 8,
        paddingHorizontal: on ? 11 : 12,
      }}
    >
      {hex ? (
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: hex,
            borderWidth: 1,
            borderColor: '#AEB5C4',
          }}
        />
      ) : null}
      <T style={{ fontSize: 13.5, fontWeight: '700' }}>{children}</T>
    </Pressable>
  );
}

/** Aç-kapa (Sihirbaz 5. adım) */
export function Anahtar({
  on,
  onPress,
  disabled,
  label,
}: {
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      onPress={disabled ? undefined : onPress}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        backgroundColor: on ? colors.green : '#C9CEDB',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: on ? 25 : 3,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.surface,
        }}
      />
    </Pressable>
  );
}

/** Uzun listeler için arama yapılabilen seçici (il, ilçe, marka, seri, model) */
export function Secici({
  etiket,
  deger,
  secenekler,
  onSec,
  bos = 'Seç',
  disabled,
}: {
  etiket: string;
  deger?: string;
  secenekler: { key: string; ad: string }[];
  onSec: (key: string | undefined) => void;
  bos?: string;
  disabled?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [ara, setAra] = useState('');
  const kucuk = (s: string) => s.toLocaleLowerCase('tr-TR');
  const liste = ara ? secenekler.filter((x) => kucuk(x.ad).includes(kucuk(ara))) : secenekler;
  const secili = secenekler.find((x) => x.key === deger);
  return (
    <View style={{ flex: 1 }}>
      <T style={{ fontSize: 13, fontWeight: '800', marginBottom: 6 }}>{etiket}</T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiket}: ${secili?.ad ?? bos}`}
        disabled={disabled}
        onPress={() => setAcik(true)}
        style={{
          ...girdiStil,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <T style={{ fontSize: 15, color: secili ? colors.ink : '#8A91A3', flex: 1 }} numberOfLines={1}>
          {secili?.ad ?? bos}
        </T>
        <T style={{ color: colors.muted }}>▾</T>
      </Pressable>
      <Modal visible={acik} animationType="slide" onRequestClose={() => setAcik(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              onPress={() => setAcik(false)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ikon d="kapat" />
            </Pressable>
            <TInput
              value={ara}
              onChangeText={setAra}
              placeholder={`${etiket} ara`}
              autoFocus
              style={{ ...girdiStil, flex: 1 }}
            />
          </View>
          <FlatList
            data={[{ key: '', ad: bos }, ...liste]}
            keyExtractor={(x) => x.key || 'bos'}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onSec(item.key || undefined);
                  setAcik(false);
                  setAra('');
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: '#EEF0F5',
                  backgroundColor: item.key === deger ? '#EEF3FF' : colors.surface,
                }}
              >
                <T
                  style={{
                    fontSize: 15,
                    fontWeight: item.key === deger ? '800' : '600',
                    color: item.key ? colors.ink : colors.muted,
                  }}
                >
                  {item.ad}
                </T>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/** İl ve ilçe */
export function Konum({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const v = (value as { il?: string; ilce?: string } | undefined) ?? {};
  const il = ILLER.find((i) => i.ad === v.il);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Secici
        etiket="İl"
        deger={v.il}
        secenekler={ILLER.map((i) => ({ key: i.ad, ad: i.ad }))}
        onSec={(k) => onChange(k ? { il: k } : undefined)}
      />
      <Secici
        etiket="İlçe"
        deger={v.ilce}
        bos={il ? 'Tüm ilçeler' : 'Önce il seç'}
        disabled={!il}
        secenekler={(il?.ilceler ?? []).map((x) => ({ key: x, ad: x }))}
        onSec={(k) => onChange({ il: v.il, ...(k ? { ilce: k } : {}) })}
      />
    </View>
  );
}

/** Şemadaki bir alan (seçim, aralık, sayı, evet/hayır, metin, tarih aralığı, konum) */
export function Alan({
  f,
  value,
  onChange,
  hata,
}: {
  f: CategoryField;
  value: unknown;
  onChange: (v: unknown) => void;
  hata?: string;
}) {
  const baslik = (
    <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
      {f.key === 'km' ? 'En fazla kilometre' : f.label}
      {f.unit && f.type === 'range' ? ` (${f.unit})` : ''}
    </T>
  );
  const alt = hata ? (
    <T
      accessibilityRole="alert"
      style={{ fontSize: 12.5, color: '#A3271F', fontWeight: '700', marginTop: 6 }}
    >
      {hata}
    </T>
  ) : f.help ? (
    <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 6 }}>{f.help}</T>
  ) : null;
  let govde: ReactNode = null;
  if (f.type === 'multiselect' || f.type === 'select') {
    const coklu = f.type === 'multiselect';
    const secili = coklu ? ((value as string[] | undefined) ?? []) : value ? [value as string] : [];
    govde = (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(f.options ?? []).map((o) => (
          <Cip
            key={o.value}
            on={secili.includes(o.value)}
            hex={o.hex}
            onPress={() => {
              if (!coklu) return onChange(secili[0] === o.value ? undefined : o.value);
              const next = secili.includes(o.value)
                ? secili.filter((x) => x !== o.value)
                : [...secili, o.value];
              onChange(next.length ? next : undefined);
            }}
          >
            {o.label}
          </Cip>
        ))}
      </View>
    );
  } else if (f.type === 'boolean') {
    const v = value as boolean | undefined;
    govde = (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Cip on={v === true} onPress={() => onChange(v === true ? undefined : true)}>
          Evet
        </Cip>
        <Cip on={v === false} onPress={() => onChange(v === false ? undefined : false)}>
          Hayır
        </Cip>
        <Cip on={v === undefined} onPress={() => onChange(undefined)}>
          Fark etmez
        </Cip>
      </View>
    );
  } else if (f.type === 'range') {
    const v = (value as { min?: number; max?: number } | undefined) ?? {};
    const para = f.unit === 'TL' || (f.max ?? 0) > 10_000;
    const set = (k: 'min' | 'max', s: string) => {
      const next = { ...v, [k]: sayiOku(s) };
      if (next.min === undefined) delete next.min;
      if (next.max === undefined) delete next.max;
      onChange(next.min === undefined && next.max === undefined ? undefined : next);
    };
    govde = (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['min', 'max'] as const).map((k) => (
          <View key={k} style={{ flex: 1 }}>
            <T style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>
              {k === 'min'
                ? f.key === 'yil'
                  ? 'En eski'
                  : 'En az'
                : f.key === 'yil'
                  ? 'En yeni'
                  : 'En fazla'}
            </T>
            <TInput
              accessibilityLabel={`${f.label} ${k === 'min' ? 'en az' : 'en çok'}`}
              keyboardType="number-pad"
              value={para ? binlik(v[k]) : v[k] === undefined ? '' : String(v[k])}
              onChangeText={(s) => set(k, s)}
              style={{ ...girdiStil, marginTop: 4 }}
            />
          </View>
        ))}
      </View>
    );
  } else if (f.type === 'number') {
    const v = value as number | undefined;
    govde = (
      <TInput
        accessibilityLabel={f.label}
        keyboardType="number-pad"
        value={(f.max ?? 0) >= 10_000 ? binlik(v) : v === undefined ? '' : String(v)}
        onChangeText={(s) => onChange(sayiOku(s))}
        style={girdiStil}
      />
    );
  } else if (f.type === 'text') {
    govde = (
      <TInput
        accessibilityLabel={f.label}
        multiline
        numberOfLines={4}
        maxLength={2000}
        value={(value as string | undefined) ?? ''}
        onChangeText={(s) => onChange(s || undefined)}
        style={{ ...girdiStil, minHeight: 96, textAlignVertical: 'top' }}
      />
    );
  } else if (f.type === 'location') {
    return (
      <View>
        {f.key !== 'konum' ? baslik : null}
        <Konum value={value} onChange={onChange} />
        {alt}
      </View>
    );
  } else if (f.type === 'daterange') {
    const v = (value as { from?: string; to?: string } | undefined) ?? {};
    // "GG.AA.YYYY SS:DD" yazılır, İstanbul saatiyle ISO'ya çevrilir
    const oku = (s: string) => {
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s.trim());
      if (!m) return undefined;
      const d = new Date(
        `${m[3]}-${m[2]?.padStart(2, '0')}-${m[1]?.padStart(2, '0')}T${(m[4] ?? '10').padStart(2, '0')}:${m[5] ?? '00'}:00+03:00`,
      );
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    };
    const yaz = (iso?: string) =>
      iso
        ? new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
            .format(new Date(iso))
            .replace(',', '')
        : '';
    govde = (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['from', 'to'] as const).map((k) => (
          <View key={k} style={{ flex: 1 }}>
            <T style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>
              {k === 'from' ? 'Alış' : 'İade'}
            </T>
            <TInput
              accessibilityLabel={k === 'from' ? 'Alış tarihi' : 'İade tarihi'}
              placeholder="GG.AA.YYYY SS:DD"
              defaultValue={yaz(v[k])}
              onEndEditing={(e) => {
                const iso = oku(e.nativeEvent.text);
                const next = { ...v, [k]: iso };
                onChange(next.from || next.to ? next : undefined);
              }}
              style={{ ...girdiStil, marginTop: 4 }}
            />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      {baslik}
      {govde}
      {alt}
    </View>
  );
}

const renk = (parts: Record<string, string | undefined>, k: string) =>
  PAINT_STATES.find((s) => s.key === (parts[k] ?? 'orijinal'))?.renk ?? '#EEF0F5';

/** Üstten araç şeması (Sihirbaz ve talep sayfası) */
export function AracSemasi({
  parts,
  width = 190,
}: {
  parts: Record<string, string | undefined>;
  width?: number;
}) {
  const P = (d: string, k: string) => <Path d={d} fill={renk(parts, k)} stroke="#AEB5C4" strokeWidth={1.5} />;
  return (
    <Svg
      width={width}
      height={width * 2}
      viewBox="0 0 260 520"
      accessibilityLabel="Seçimlerine göre renklenen üstten araç şeması"
    >
      <SvgText x="130" y="11" textAnchor="middle" fontSize="12" fontWeight="700" fill="#5A6073">
        ÖN
      </SvgText>
      <Rect x="24" y="90" width="14" height="54" rx="6" fill="#4A5064" />
      <Rect x="222" y="90" width="14" height="54" rx="6" fill="#4A5064" />
      <Rect x="24" y="378" width="14" height="54" rx="6" fill="#4A5064" />
      <Rect x="222" y="378" width="14" height="54" rx="6" fill="#4A5064" />
      <Path d="M36 178L22 184V196L36 198Z" fill="#DDE2EC" stroke="#AEB5C4" strokeWidth={1.2} />
      <Path d="M224 178L238 184V196L224 198Z" fill="#DDE2EC" stroke="#AEB5C4" strokeWidth={1.2} />
      {P(
        'M58 46C70 26 100 18 130 18C160 18 190 26 202 46L196 58C176 50 154 46 130 46C106 46 84 50 64 58Z',
        'onTampon',
      )}
      {P(
        'M64 62C86 54 108 50 130 50C152 50 174 54 196 62L190 160C172 154 152 152 130 152C108 152 88 154 70 160Z',
        'motorKaputu',
      )}
      <Path
        d="M72 166C92 160 110 158 130 158C150 158 168 160 188 166L176 208C162 204 146 202 130 202C114 202 98 204 84 208Z"
        fill="#DCE6F5"
        stroke="#AEB5C4"
        strokeWidth={1}
      />
      {P(
        'M86 214C100 210 114 208 130 208C146 208 160 210 174 214V318C160 322 146 324 130 324C114 324 100 322 86 318Z',
        'tavan',
      )}
      <Path
        d="M86 324C100 328 114 330 130 330C146 330 160 328 174 324L186 362C168 368 150 370 130 370C110 370 92 368 74 362Z"
        fill="#DCE6F5"
        stroke="#AEB5C4"
        strokeWidth={1}
      />
      {P(
        'M72 368C92 374 110 376 130 376C150 376 168 374 188 368L194 440C176 446 154 448 130 448C106 448 84 446 66 440Z',
        'arkaKaput',
      )}
      {P(
        'M64 454C84 460 106 462 130 462C154 462 176 460 196 454L202 468C190 490 162 500 130 500C98 500 70 490 58 468Z',
        'arkaTampon',
      )}
      {P('M58 50L64 64L70 164H36V100C36 80 44 62 58 50Z', 'solOnCamurluk')}
      {P('M36 170H76L86 212V268H36Z', 'solOnKapi')}
      {P('M36 274H86V318L76 360H36Z', 'solArkaKapi')}
      {P('M36 366H74L68 446L60 462C46 452 36 432 36 412Z', 'solArkaCamurluk')}
      {P('M202 50L196 64L190 164H224V100C224 80 216 62 202 50Z', 'sagOnCamurluk')}
      {P('M224 170H184L174 212V268H224Z', 'sagOnKapi')}
      {P('M224 274H174V318L184 360H224Z', 'sagArkaKapi')}
      {P('M224 366H186L192 446L200 462C214 452 224 432 224 412Z', 'sagArkaCamurluk')}
      <SvgText x="130" y="516" textAnchor="middle" fontSize="12" fontWeight="700" fill="#5A6073">
        ARKA
      </SvgText>
    </Svg>
  );
}

/** Parça parça boya ve değişen seçimi (SihirbazMobil.dc.html) */
export function ParcaSecimi({
  value,
  onChange,
}: {
  value?: { limit: number; parts: Record<string, string> };
  onChange: (v: { limit: number; parts: Record<string, string> }) => void;
}) {
  const v = value ?? { limit: 0, parts: {} };
  const hepsi = (k: string) =>
    onChange({ ...v, parts: Object.fromEntries(PAINT_PARTS.map((p) => [p.key, k])) });
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[
          ['orijinal', 'Tümü orijinal olsun'],
          ['lokal', 'Tümünde lokal boya kabul'],
          ['boya', 'Tümünde boya kabul'],
        ].map(([k, ad]) => (
          <Cip key={k} on={false} onPress={() => hepsi(k as string)}>
            {ad}
          </Cip>
        ))}
      </View>
      <View style={{ ...kartStil, marginTop: 14, alignItems: 'center', gap: 10 }}>
        <AracSemasi parts={v.parts} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {PAINT_STATES.map((s) => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: s.renk,
                  borderWidth: 1,
                  borderColor: '#AEB5C4',
                }}
              />
              <T style={{ fontSize: 12.5, color: '#3A4052' }}>{s.ad}</T>
            </View>
          ))}
        </View>
      </View>
      <View style={{ ...kartStil, marginTop: 12, padding: 0 }}>
        {PAINT_PARTS.map((p, i) => (
          <View key={p.key} style={{ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#EEF0F5' }}>
            <T style={{ fontSize: 14, fontWeight: '600', marginBottom: 6 }}>{p.ad}</T>
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {PAINT_STATES.map((s) => {
                const on = (v.parts[p.key] ?? 'orijinal') === s.key;
                return (
                  <Pressable
                    key={s.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${p.ad}: ${s.ad}`}
                    onPress={() => onChange({ ...v, parts: { ...v.parts, [p.key]: s.key } })}
                    style={{
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? '#4A5064' : '#D5DAE5',
                      backgroundColor: on ? s.renk : colors.surface,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 9,
                    }}
                  >
                    <T
                      style={{
                        fontSize: 12.5,
                        fontWeight: on ? '800' : '600',
                        color: on ? colors.ink : colors.muted,
                      }}
                    >
                      {s.ad}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 12,
          backgroundColor: '#F3F5FA',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <T style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>
          Toplamda en fazla kaç parça işlem görmüş olabilir?
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {(['−', '+'] as const).map((x) => (
            <Pressable
              key={x}
              accessibilityRole="button"
              accessibilityLabel={x === '+' ? 'Artır' : 'Azalt'}
              onPress={() =>
                onChange({
                  ...v,
                  limit: Math.max(0, Math.min(PAINT_PARTS.length, v.limit + (x === '+' ? 1 : -1))),
                })
              }
              style={{
                width: 36,
                height: 36,
                borderWidth: 1,
                borderColor: '#D5DAE5',
                backgroundColor: colors.surface,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T style={{ fontSize: 18, fontWeight: '700' }}>{x}</T>
            </Pressable>
          ))}
        </View>
      </View>
      <T style={{ textAlign: 'right', fontSize: 15, fontWeight: '800', marginTop: 6 }}>{v.limit} parça</T>
    </View>
  );
}
