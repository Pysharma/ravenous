import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="label">404</p>
      <h1 className="font-display text-4xl">We couldn&apos;t find that page.</h1>
      <p className="mt-3 text-sm text-ink/60">The link may be old, or the dish might no longer be on the menu.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/menu" className="btn btn-primary">
          Explore Menu
        </Link>
        <Link href="/" className="btn btn-outline">
          Back home
        </Link>
      </div>
    </div>
  );
}
