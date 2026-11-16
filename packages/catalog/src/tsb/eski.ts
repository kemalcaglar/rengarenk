/**
 * 2006–2019 TSB kasko değer listeleri (Karar 33). TSB'nin bugünkü arşivi Nisan 2020'den başlar; daha eski listeler
 * Birlik'in eski sitelerinde (adl.tsrsb.org.tr, tsrsb.org.tr, tsb.org.tr) yayımlanmıştı ve İnternet Arşivi'nde
 * (web.archive.org) duruyor. Her liste kendi döneminin 15 model yılını taşır: 2006 listesi 1993'e kadar iner. Böylece
 * 1993–2005 yıllarında da yalnızca Türkiye'de satılmış tipler (motor, paket, vites) görünür.
 *
 * Dosyalar depoya girmez; hat İnternet Arşivi'nden indirir. `zaman` arşivdeki kayıt anı, `adres` özgün adres.
 * Tip kodları (marka kodu-tip kodu) bugünkü listeyle aynıdır (Kasım 2026 denetimi: 2013 listesinde 10.469 ortak
 * koddan yalnızca adı değişmiş 10 tip; kodu başka araca verilen yalnızca motosiklet).
 */
export interface TsbEskiDosya {
  /** Dönem: "2015-12"; "15 model yılından eski araçlar" listesi "2010-01-oncesi" */
  donem: string;
  zaman: string;
  adres: string;
}

export const TSB_ESKI: readonly TsbEskiDosya[] = [
  { donem: '2006-11', zaman: '20061107085119', adres: 'http://adl.tsrsb.org.tr:80/SMarka.xls' },
  { donem: '2007-01', zaman: '20070121083059', adres: 'http://adl.tsrsb.org.tr:80/SMarka.xls' },
  { donem: '2007-02', zaman: '20070302120825', adres: 'http://adl.tsrsb.org.tr:80/SMarkaSubat2007.xls' },
  { donem: '2007-07', zaman: '20071017083206', adres: 'http://adl.tsrsb.org.tr/SMarkaTemmuz2007.xls' },
  { donem: '2009-04', zaman: '20090509003604', adres: 'http://adl.tsrsb.org.tr:80/SMarkaNisan2009.xls' },
  { donem: '2009-06', zaman: '20090617073145', adres: 'http://adl.tsrsb.org.tr:80/SMarkaHaziran2009.xls' },
  { donem: '2009-09', zaman: '20091013223902', adres: 'http://adl.tsrsb.org.tr:80/SMarkaEylul2009.xls' },
  { donem: '2009-11', zaman: '20091222041252', adres: 'http://adl.tsrsb.org.tr:80/SMarka200911.xls' },
  { donem: '2009-12', zaman: '20100107234050', adres: 'http://adl.tsrsb.org.tr:80/SMarka200912.xls' },
  { donem: '2010-01', zaman: '20100201230659', adres: 'http://adl.tsrsb.org.tr:80/SMarka201001.xls' },
  { donem: '2010-02', zaman: '20100216062537', adres: 'http://adl.tsrsb.org.tr:80/SMarka201002.xls' },
  { donem: '2010-03', zaman: '20100325204445', adres: 'http://adl.tsrsb.org.tr:80/SMarka201003.xls' },
  { donem: '2010-04', zaman: '20100415001146', adres: 'http://adl.tsrsb.org.tr:80/SMarka201004.xls' },
  { donem: '2010-05', zaman: '20100524153353', adres: 'http://adl.tsrsb.org.tr:80/SMarka201005.xls' },
  { donem: '2010-07', zaman: '20100713230542', adres: 'http://adl.tsrsb.org.tr:80/SMarka201007.xls' },
  { donem: '2013-07', zaman: '20130806033220', adres: 'http://www.tsb.org.tr:80/Document/SMarka201307.xls' },
  { donem: '2013-08', zaman: '20130903082401', adres: 'http://www.tsb.org.tr:80/Document/SMarka201308.xls' },
  {
    donem: '2014-01',
    zaman: '20150424151752',
    adres: 'http://www.tsb.org.tr/Document/KaskoDegerFilesHandler/SMarka201401rev1.xls',
  },
  {
    donem: '2014-05',
    zaman: '20140715173844',
    adres: 'http://www.tsb.org.tr/Document/KaskoDegerFilesHandler/SMarka201405.xls',
  },
  {
    donem: '2014-10',
    zaman: '20141005102652',
    adres: 'http://www.tsb.org.tr:80/Document/KaskoDegerFilesHandler/SMarka201410.xls',
  },
  {
    donem: '2015-03',
    zaman: '20150319092322',
    adres: 'http://tsb.org.tr/Document/KaskoDegerFilesHandler/SMarka201503R3.xls',
  },
  {
    donem: '2015-12',
    zaman: '20151216051259',
    adres: 'http://www.tsb.org.tr:80/Document/KaskoDegerFilesHandler/SMarka201512R1.xls',
  },
  {
    donem: '2016-07',
    zaman: '20160717124041',
    adres: 'http://www.tsb.org.tr:80/Document/KaskoDegerFilesHandler/SMarka201607.xls',
  },
  {
    donem: '2016-11',
    zaman: '20161121012004',
    adres: 'http://www.tsb.org.tr:80/Document/KaskoDegerFilesHandler/SMarka201611R1.xls',
  },
  {
    donem: '2017-05',
    zaman: '20170611000736',
    adres: 'http://www.tsb.org.tr:80/Document/KaskoDegerFilesHandler/SMarka201705R1.xls',
  },
  {
    donem: '2018-08',
    zaman: '20190325144216',
    adres: 'https://www.tsb.org.tr/Document/KaskoDegerFilesHandler/SMarka201808.xls',
  },
  {
    donem: '2019-01',
    zaman: '20190207064445',
    adres: 'https://www.tsb.org.tr/Document/KaskoDegerFilesHandler/SMarka201901.xls',
  },
  // "15 model yılından eski araçlar" listeleri (Motorlu Taşıtlar Vergisi için, her Ocak): kod sütunu yoktur, 1950'ye iner
  {
    donem: '2010-01-oncesi',
    zaman: '20131020091840',
    adres: 'http://www.tsb.org.tr/images/Documents/ocak2010-1995veoncesi-gib-rev2.xls',
  },
  {
    donem: '2011-01-oncesi',
    zaman: '20131020085946',
    adres: 'http://www.tsb.org.tr/images/Documents/ocak2011-1996veoncesi-gib-rev1.xls',
  },
  {
    donem: '2012-01-oncesi',
    zaman: '20131020101624',
    adres: 'http://www.tsb.org.tr/images/Documents/ocak2012-1997veoncesi-gib.xls',
  },
  {
    donem: '2013-01-oncesi',
    zaman: '20140401131131',
    adres: 'http://tsb.org.tr/images/Documents/ocak2013-1998veoncesirevize.xls',
  },
  {
    donem: '2014-01-oncesi',
    zaman: '20150319101854',
    adres: 'http://tsb.org.tr/images/Documents/ocak2014-1999veoncesirevize.xls',
  },
  {
    donem: '2015-01-oncesi',
    zaman: '20150319113639',
    adres: 'http://tsb.org.tr/images/Documents/ocak2015-2000veoncesi.xls',
  },
  {
    donem: '2016-01-oncesi',
    zaman: '20160407223243',
    adres: 'http://tsb.org.tr/images/Documents/MTV/ocak2016-2001veoncesi.xls',
  },
];

/** İnternet Arşivi'ndeki özgün dosyanın adresi (arşiv çerçevesi olmadan, "id_") */
export const tsbEskiAdres = (d: TsbEskiDosya) => `https://web.archive.org/web/${d.zaman}id_/${d.adres}`;

/** Hattın içe aktarma kaydında kullandığı dosya adı: "TSB-2015-12.xls", "TSB-2010-01-oncesi.xls" */
export const tsbEskiDosyaAdi = (d: TsbEskiDosya) => `TSB-${d.donem}.xls`;
