-- SMS'in yerine WhatsApp (sahip kararı 22 Kasım 2026; Karar 48, 49). Kritik bildirimlerin "sms" kanalı "whatsapp"
-- olur; kampanya SMS ya da WhatsApp'tan gitmez. Tablolar değişmez; kanal kısıtları ve veri.

ALTER TABLE "notification_prefs" DROP CONSTRAINT "notification_prefs_check";
-- Teslim kaydı silinmez: eski "sms" kayıtları geçerli kalır, yeni kanal "whatsapp"
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_check";
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_check"
  CHECK ("kanal" IN ('push', 'eposta', 'whatsapp', 'sms') AND "durum" IN ('bekliyor', 'gonderildi', 'atlandi', 'hata')
    AND ("user_id" IS NOT NULL OR "staff_id" IS NOT NULL));

-- 1) Bildirim tercihleri: kampanya dışındaki SMS tercihi WhatsApp tercihine taşınır
INSERT INTO notification_prefs (user_id, konu, kanal, acik, updated_at)
SELECT user_id, konu, 'whatsapp', acik, now()
FROM notification_prefs
WHERE kanal = 'sms' AND konu <> 'kampanya'
ON CONFLICT (user_id, konu, kanal) DO NOTHING;

-- 2) Eski SMS tercihleri silinir (tercih satırı değiştirilebilir bir ayardır; kampanya SMS'i artık yok)
DELETE FROM notification_prefs WHERE kanal = 'sms';
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_check"
  CHECK ("konu" IN ('mesaj', 'arama', 'sure', 'odeme', 'kampanya', 'galeri') AND "kanal" IN ('uygulama', 'eposta', 'whatsapp'));

-- 3) Kampanya SMS onayı olanların İYS kaydı eşitlenir: işçi MESAJ türüne RET yazar (iys.ts, aynı olay)
INSERT INTO outbox (type, payload)
SELECT 'iys.izin_degisti', jsonb_build_object('userId', s.user_id)
FROM (
  SELECT DISTINCT ON (user_id) user_id, status
  FROM iys_records
  WHERE type = 'MESAJ'
  ORDER BY user_id, created_at DESC, id DESC
) s
WHERE s.status = 'ONAY';

-- 4) Gönderilmeyi bekleyen SMS teslimleri atlanır (kayıt silinmez, sonucu yazılır)
UPDATE deliveries
SET durum = 'atlandi', neden = 'SMS kaldırıldı; kritik iletiler WhatsApp ile gider'
WHERE kanal = 'sms' AND durum = 'bekliyor';
