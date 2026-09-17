"use client";

export function PrintButton({ label = "Download / Print PDF invoice" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
