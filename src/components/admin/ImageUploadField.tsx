"use client";

import { useState } from "react";
import { adminInputClass } from "@/components/admin/ui";
import { IconImage } from "@/components/admin/icons";

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
      <label htmlFor={`${name}-url`} className="mb-1.5 block text-sm font-medium text-a-text">
        {label}
      </label>
      <div className="flex gap-3">
        <input
          id={`${name}-url`}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="/images/products/… ou /uploads/…"
          className={adminInputClass}
        />
        <label className="btn-admin-ghost shrink-0 cursor-pointer">
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
      <div className="mt-3 flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-16 w-24 rounded-lg border border-a-line object-cover"
          />
        ) : (
          <span className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-a-line-strong text-a-faint">
            <IconImage className="h-5 w-5" />
          </span>
        )}
        {status && <p className="text-xs text-a-muted">{status}</p>}
      </div>
    </div>
  );
}
