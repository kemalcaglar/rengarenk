import { Logo } from '../../logo';
import { IkiAdim } from './iki-adim';

export default async function IkiAdimSayfa({
  searchParams,
}: {
  searchParams: Promise<{ kurulum?: string }>;
}) {
  const { kurulum } = await searchParams;
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', display: 'grid', gap: 16 }}>
        <Logo />
        <IkiAdim setup={kurulum === '1'} />
      </div>
    </main>
  );
}
