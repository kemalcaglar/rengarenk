import stil from './logo.module.css'; /** Rengarenk logosu ve "Yönetim" etiketi (tasarım: YonetimEkip başlığı). */
export function Logo() {
  return (
    <span className="k-logo">
      <span className="k-bars" aria-hidden="true">
        <i className={stil.metin1} />
        <i className={stil.metin2} />
        <i className={stil.metin3} />
        <i className={stil.metin4} />
      </span>
      <span className="k-word">rengarenk</span>
      <span className="k-tag">Yönetim</span>
    </span>
  );
}
