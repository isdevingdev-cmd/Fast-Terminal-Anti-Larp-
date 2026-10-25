"use client";
import { useEffect, useMemo, useState } from "react";
import { imageCandidates } from "@/lib/pump/ipfs";

/** Token logo with IPFS gateway fallback chain and a neutral placeholder. */
export function TokenImage({ src, size = 36, radius = 9, className = "" }: { src?: string; size?: number; radius?: number; className?: string }) {
  const candidates = useMemo(() => imageCandidates(src), [src]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [src]);
  const url = candidates[idx];
  return (
    <div className={`relative flex-none overflow-hidden bg-gradient-to-br from-line2 to-panel2 ${className}`} style={{ width: size, height: size, borderRadius: radius }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      )}
    </div>
  );
}
