/** Rengarenk logosu ve "Yönetim" etiketi (tasarım: YonetimEkip başlığı). */
export function Logo() {
  return (
    <span className="k-logo">
      <span className="k-bars" aria-hidden="true">
        <i style={{ background: '#5B8CFF' }} />
        <i style={{ background: '#FF6FB5' }} />
        <i style={{ background: '#FFC84A' }} />
        <i style={{ background: '#3DD68C' }} />
      </span>
      <span className="k-word">rengarenk</span>
      <span className="k-tag">Yönetim</span>
    </span>
  );
}
