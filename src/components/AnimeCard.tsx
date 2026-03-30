import Link from "next/link";
import Image from "next/image";

interface AnimeCardProps {
  href: string;
  title: string;
  image?: string | null;
  badgeTopLeft?: React.ReactNode;
  overlayText?: React.ReactNode;
  subTitle?: React.ReactNode;
  className?: string;
}

export default function AnimeCard({
  href,
  title,
  image,
  badgeTopLeft,
  overlayText,
  subTitle,
  className = "",
}: AnimeCardProps) {
  const hasImage = Boolean(image);

  return (
    <Link
      prefetch={true}
      href={href}
      className={`block shrink-0 snap-start group ${className}`}
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-zinc-800 group-hover:border-pink-500 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(255,0,127,0.2)] bg-[radial-gradient(circle_at_30%_20%,rgba(255,0,127,0.15),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(0,255,255,0.12),transparent_35%),#0f0f10]">
        {hasImage ? (
          <Image
            src={
              image ||
              "https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"
            }
            alt={title}
            fill
            sizes="(max-width: 768px) 160px, 200px"
            className="object-cover group-hover:scale-110 transition duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-pink-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
              <path d="M12 5.5c-3.038 0-5.5 2.462-5.5 5.5s2.462 5.5 5.5 5.5 5.5-2.462 5.5-5.5-2.462-5.5-5.5-5.5zm0-2c4.142 0 7.5 3.358 7.5 7.5S16.142 18.5 12 18.5 4.5 15.142 4.5 11 7.858 3.5 12 3.5z"/>
              <path d="M10 9l5 2-5 2z"/>
            </svg>
          </div>
        )}
        
        {badgeTopLeft && (
          <div className="absolute top-2 left-2 z-10">
            {badgeTopLeft}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-3 pointer-events-none">
          <div className="w-full">
            <p className="text-white font-bold text-xs truncate drop-shadow-md">
              {title}
            </p>
            {overlayText && <div className="mt-1">{overlayText}</div>}
          </div>
        </div>
      </div>
      
      {subTitle && (
        <div className="text-xs text-zinc-500 group-hover:text-pink-300 transition mt-2 truncate w-full px-1">
          {subTitle}
        </div>
      )}
    </Link>
  );
}
