"use client";

import { useState } from "react";
import { inputClass } from "@/components/forms/Field";

type Props = {
  name: string;
  label: string;
  initialValue?: string;
};

/** URL input + direct upload to /api/admin/upload (stored under /public/uploads). */
export function ImageUploadField({ name, label, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<string | null>(null);

  const upload = async (file: File) => {
    setStatus("A carregar…");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await response.json()) as { ok: boolean; url?: string; message?: string };
      if (data.ok && data.url) {
        setValue(data.url);
        setStatus("Carregado ✓");
      } else {
        setStatus(data.message ?? "Falha no upload");
      }
    } catch {
      setStatus("Falha no upload");
    }
  };

  return (
    <div>
      <label htmlFor={`${name}-url`} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </label>
      <div className="flex gap-3">
        <input
          id={`${name}-url`}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="/images/products/… ou /uploads/…"
          className={inputClass}
        />
        <label className="flex shrink-0 cursor-pointer items-center rounded-xl border border-night-line px-4 text-sm text-white/70 hover:border-dufat-sky/50">
          Upload
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-20 rounded-lg border border-night-line object-cover" />
        )}
        {status && <p className="text-xs text-white/50">{status}</p>}
      </div>
    </div>
  );
}
