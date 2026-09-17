"use client";

import { useRef, useState } from "react";

type Props = {
  label?: string;
  id: string;
  value: string;
  onChange: (url: string) => void;
  help?: string;
};

/**
 * Accepts BOTH a pasted URL and a file upload. Uploaded files are stored in
 * /public/uploads via the admin upload API and the resulting URL is set as the value.
 */
export function ImageField({ label, id, value, onChange, help }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await response.json()) as { media?: { url: string }; error?: string };
      if (!response.ok || !data.media) throw new Error(data.error ?? "Upload failed.");
      onChange(data.media.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          id={id}
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste an image URL, e.g. /images/hero-dish.jpg"
          aria-label={label ? `${label} URL` : "Image URL"}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          aria-label={label ? `${label} upload` : "Upload image"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          className="btn btn-outline whitespace-nowrap px-3 py-2 text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "⬆ Upload"}
        </button>
      </div>
      {value ? (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={`${label ?? "Image"} preview`}
            className="h-14 w-20 rounded-lg border border-ink/10 bg-cream-dark object-cover"
            onError={(event) => {
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          <button type="button" className="text-xs text-[#a12622] underline" onClick={() => onChange("")}>
            Clear image
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-[#a12622]">{error}</p> : null}
      {help ? <p className="mt-1 text-xs text-ink/45">{help}</p> : null}
    </div>
  );
}
