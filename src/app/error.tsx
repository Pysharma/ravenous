"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("client error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="container-page py-24 text-center">
      <p className="label">Something went wrong</p>
      <h1 className="font-display text-4xl">Something went wrong. Please try again.</h1>
      <p className="mt-3 text-sm text-ink/60">
        Our team has been notified. If the problem continues, please call the restaurant and we will help you directly.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/menu" className="btn btn-outline">
          Explore Menu
        </Link>
      </div>
    </div>
  );
}
