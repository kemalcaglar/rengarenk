/** Yönetim konsolu girişi: Google Workspace tek oturum + zorunlu 2FA (T10). Sprint 3'te bağlanacak. */
export default function AdminHome() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 20 }}>rengarenk · yönetim</p>
        <p className="muted">Şirket hesabınla giriş yap. İki adımlı doğrulama zorunludur.</p>
        <button className="btn" type="button" disabled style={{ width: '100%' }}>
          Google Workspace ile giriş (Sprint 3)
        </button>
      </div>
    </main>
  );
}
