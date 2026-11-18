import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { BrandLogo } from './ui';

export const AppSplashScreen: React.FC = () => {
  const { settings } = useStore();
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem('hfc_splash_shown') !== '1';
    } catch {
      return false;
    }
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let reduced = false;
    try {
      reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    } catch {
      reduced = false;
    }

    const fadeDelay = reduced ? 80 : 380;
    const removeDelay = reduced ? 140 : 580;

    const t1 = window.setTimeout(() => setFading(true), fadeDelay);
    const t2 = window.setTimeout(() => {
      setVisible(false);
      try {
        window.sessionStorage.setItem('hfc_splash_shown', '1');
      } catch {
        // Ignore storage errors
      }
    }, removeDelay);

    // Failsafe timer guarantees splash overlay can never stay stuck
    const failsafe = window.setTimeout(() => setVisible(false), 950);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(failsafe);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Home Food Corner splash screen"
      onClick={() => setVisible(false)}
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#450A0A_0%,#0B0B0B_72%)] px-6 text-center transition-opacity duration-200 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-3xl border border-gold/30 bg-background/50 p-4 shadow-2xl">
          <BrandLogo size={96} customUrl={settings.logoUrl} />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {settings.brandName || 'Home Food Corner'}
          </p>
          <p className="font-urdu text-base text-gold">
            {settings.taglineUr || 'گھر جیسا ذائقہ، تازہ اور اسپائسی'}
          </p>
        </div>
        <div className="mt-2 flex h-1.5 w-36 overflow-hidden rounded-full bg-surface">
          <span className="w-1/3 bg-primary" />
          <span className="w-1/3 bg-gold" />
          <span className="w-1/3 bg-spicy" />
        </div>
      </div>
    </div>
  );
};
