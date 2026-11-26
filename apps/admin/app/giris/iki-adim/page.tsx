import { Logo } from '../../logo';
import { IkiAdim } from './iki-adim';
import stil from './page.module.css';

export default async function IkiAdimSayfa({
  searchParams,
}: {
  searchParams: Promise<{ kurulum?: string }>;
}) {
  const { kurulum } = await searchParams;
  return (
    <main className={stil.kutu1}>
      <div className={`card ${stil.kutu2}`}>
        <Logo />
        <IkiAdim setup={kurulum === '1'} />
      </div>
    </main>
  );
}
