"use client";

import Image from "next/image";
import { useState } from "react";

const DEFAULT_FALLBACK = "/images/hero-dish.jpg";

type SafeImageProps = {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  className?: string;
  fallback?: string;
};

/**
 * next/image wrapper for admin-managed URLs. If the URL is empty or fails to
 * load (hotlink blocked, removed asset, network error), a bundled fallback
 * image is shown so the customer site never renders a broken image box.
 */
export function SafeImage({
  src,
  alt,
  fill,
  sizes,
  priority,
  loading,
  className = "",
  fallback = DEFAULT_FALLBACK,
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const clean = (src ?? "").trim();
  const resolved = failed ? fallback : clean || fallback;

  return (
    <Image
      src={resolved}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      loading={loading}
      className={className}
      onError={() => {
        if (resolved !== fallback) setFailed(true);
      }}
    />
  );
}
