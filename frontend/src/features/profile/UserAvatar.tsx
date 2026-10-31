import { useState } from 'react';

export function UserAvatar({
  name,
  url,
  className = 'h-9 w-9',
}: {
  name: string;
  url: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part.slice(0, 1))
      .join('')
      .toLocaleUpperCase('vi-VN') || 'U';
  return (
    <span
      aria-label={`Ảnh đại diện của ${name}`}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan font-bold text-navy ${className}`}
    >
      {url && url !== failedUrl ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}
