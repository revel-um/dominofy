import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { TokenManager } from '../utils/auth';

export default function HomePage() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      const token = await TokenManager.getValidAccessToken();
      if (!active) return;
      router.replace(token ? '/dashboard' : '/auth');
      setBooting(false);
    }, 1000); // brief loader preview
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [router]);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.25),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.2),transparent_30%)] blur-3xl opacity-60" />
      
      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border border-white/10 animate-spin"
            style={{ animationDuration: '4s' }}
          />
          <div
            className="absolute inset-3 rounded-full border border-white/10 animate-spin"
            style={{ animationDuration: '8s', animationDirection: 'reverse' }}
          />
          <div className="absolute inset-6 animate-pulse rounded-full bg-white/10 blur" />
          <Image
            src="/dominofy_logo.png"
            alt="Dominofy"
            fill
            priority
            className="object-contain drop-shadow-lg"
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">Loading</p>
          <p className="text-2xl font-semibold">Dominofy Workspace</p>
          <p className="text-xs text-white/60 animate-pulse">{booting ? 'Getting things ready…' : 'Redirecting…'}</p>
        </div>
      </div>
    </div>
  );
}
