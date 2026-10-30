import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: {
            client_id: string;
            callback(response: { credential?: string }): void;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              theme: 'outline';
              size: 'large';
              text: 'signin_with';
              shape: 'rectangular';
              width: number;
              locale: 'vi';
            },
          ): void;
        };
      };
    };
  }
}

const googleScriptId = 'unihub-google-identity-services';

export function GoogleIdentityButton({
  onCredential,
  disabled = false,
}: {
  onCredential(credential: string): void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let active = true;
    const draw = () => {
      if (!active || !containerRef.current || !window.google?.accounts.id) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (active && credential) onCredential(credential);
          else if (active) setError('Google không trả về thông tin đăng nhập.');
        },
      });
      containerRef.current.replaceChildren();
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320,
        locale: 'vi',
      });
    };

    const existingScript = document.getElementById(
      googleScriptId,
    ) as HTMLScriptElement | null;
    const showLoadError = () =>
      active && setError('Không tải được dịch vụ Google Identity.');
    if (window.google?.accounts.id) {
      draw();
    } else if (existingScript) {
      existingScript.addEventListener('load', draw, { once: true });
      existingScript.addEventListener('error', showLoadError, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = googleScriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = draw;
      script.onerror = showLoadError;
      document.head.append(script);
    }

    return () => {
      active = false;
      existingScript?.removeEventListener('load', draw);
      existingScript?.removeEventListener('error', showLoadError);
    };
  }, [clientId, onCredential]);

  if (!clientId) {
    return (
      <p role="status" className="type-label text-danger">
        Chưa cấu hình VITE_GOOGLE_CLIENT_ID cho frontend.
      </p>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        aria-label="Đăng nhập với Google"
        aria-disabled={disabled}
        inert={disabled}
        className={disabled ? 'pointer-events-none opacity-60' : undefined}
      />
      {error ? (
        <p role="alert" className="mt-3 type-label text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
