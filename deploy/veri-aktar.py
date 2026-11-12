"""Yereldeki katalog ve ayar tablolarını tek işlemlik bir SQL dosyasına yazar (deploy/README.md › Veri aktarımı).

Kullanıcı verisi taşımaz. Tetikleyiciler açık kalır: dosya yalnızca göçleri yeni uygulanmış boş bir veritabanına,
API ve işçi açılmadan önce yüklenir. Göçlerin kendisi doldurduğu tablolar (UPSERT) "varsa güncelle" ile yazılır.

    python deploy/veri-aktar.py aktarim.sql            # yerel rengarenk veritabanından
    psql -U rengarenk -d rengarenk -q < aktarim.sql      # sunucuda, boş ve göçleri uygulanmış veritabanına
"""

import subprocess
import sys

OUT = sys.argv[1]
DB = sys.argv[2] if len(sys.argv) > 2 else 'rengarenk'
KAPSAYICI = 'rengarenk-postgres-1'

UPSERT = ['catalog_sources', 'ai_settings', 'banned_words', 'feature_flags']
DUZ = [
    'catalog_imports', 'catalog_makes', 'catalog_series', 'catalog_models', 'catalog_trims',
    'catalog_generations', 'catalog_variants', 'catalog_aliases', 'catalog_images',
    'categories', 'category_schema_versions', 'help_articles', 'consent_texts', 'content_settings',
    'coupons', 'design_versions', 'home_layout_versions', 'landing_pages', 'landing_page_versions',
    'segments',
]
# Galeri kökenli temsilî fotoğraflar (Karar 34) kullanıcı portföyüne bağlıdır; portföy taşınmaz
FILTRE = {'catalog_images': "origin <> 'galeri'"}


def psql(sql: str) -> bytes:
    return subprocess.run(
        ['docker', 'exec', '-i', KAPSAYICI, 'psql', '-U', 'rengarenk', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-At',
         '-c', sql],
        check=True, capture_output=True,
    ).stdout


def kolonlar(t: str) -> list[str]:
    out = psql(
        "select column_name from information_schema.columns where table_schema='public' and "
        f"table_name='{t}' and is_generated='NEVER' and coalesce(identity_generation,'')<>'ALWAYS' "
        "order by ordinal_position"
    ).decode().split()
    assert out, t
    return out


def anahtar(t: str) -> list[str]:
    return psql(
        "select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and "
        f"a.attnum=any(i.indkey) where i.indrelid='{t}'::regclass and i.indisprimary"
    ).decode().split()


def veri(t: str, cols: list[str]) -> bytes:
    q = 'select ' + ', '.join(f'"{c}"' for c in cols) + f' from {t}'
    if t in FILTRE:
        q += f' where {FILTRE[t]}'
    return psql(f'COPY ({q}) TO STDOUT')


with open(OUT, 'wb') as f:
    def w(s: str) -> None:
        f.write(s.encode())

    w('\\set ON_ERROR_STOP 1\nBEGIN;\n')
    for t in UPSERT:
        cols = kolonlar(t)
        pk = anahtar(t)
        cl = ', '.join(f'"{c}"' for c in cols)
        w(f'CREATE TEMP TABLE s_{t} (LIKE {t}) ON COMMIT DROP;\nCOPY s_{t} ({cl}) FROM stdin;\n')
        f.write(veri(t, cols))
        w('\\.\n')
        upd = ', '.join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in pk)
        w(f'INSERT INTO {t} ({cl}) SELECT {cl} FROM s_{t} ON CONFLICT ({", ".join(pk)}) DO UPDATE SET {upd};\n')
    for t in DUZ:
        cols = kolonlar(t)
        cl = ', '.join(f'"{c}"' for c in cols)
        w(f'COPY {t} ({cl}) FROM stdin;\n')
        f.write(veri(t, cols))
        w('\\.\n')
    w('COMMIT;\n')
print('yazıldı:', OUT)
