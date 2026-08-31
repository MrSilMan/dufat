"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { IconImage } from "@/components/admin/icons";

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif,image/svg+xml";
const MAX_BYTES = 8 * 1024 * 1024; // mirrors /api/admin/upload

type Status = { tone: "busy" | "ok" | "error"; text: string };

type Props = {
  name: string;
  label: string;
  initialValue?: string;
  /** Keep the label for screen readers only — for cards whose title already says it. */
  hideLabel?: boolean;
  /** Preview frame ratio — set it to the ratio the site renders this image at. */
  ratioClass?: string;
  /** Caps the whole field, so a favicon doesn't get a full-width drop target. */
  widthClass?: string;
};

/**
 * Image picker for admin forms: drop/click to upload to /api/admin/upload, or
 * paste a path by hand. The preview letterboxes the whole image inside the
 * catalog's frame (`object-contain`) so nothing is cropped out of view.
 */
export function ImageUploadField({
  name,
  label,
  initialValue,
  hideLabel,
  ratioClass = "aspect-[4/3]",
  widthClass = "max-w-sm",
}: Props) {
  const fieldId = useId();
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<Status | null>(null);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setStatus({ tone: "error", text: "Ficheiro demasiado grande (máx. 8 MB)" });
      return;
    }
    setStatus({ tone: "busy", text: "A carregar…" });
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await response.json()) as { ok: boolean; url?: string; message?: string };
      if (data.ok && data.url) {
        setSize(null);
        setValue(data.url);
        setStatus({ tone: "ok", text: "Imagem carregada" });
      } else {
        setStatus({ tone: "error", text: data.message ?? "Falha no upload" });
      }
    } catch {
      setStatus({ tone: "error", text: "Falha no upload" });
    }
  };

  const measure = (el: HTMLImageElement | null) => {
    if (!el?.complete || !el.naturalWidth) return;
    // Bail out when nothing changed: this runs from a ref callback that React
    // re-attaches on every render, so an unconditional setState would loop.
    setSize((previous) =>
      previous && previous.width === el.naturalWidth && previous.height === el.naturalHeight
        ? previous
        : { width: el.naturalWidth, height: el.naturalHeight },
    );
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const clear = () => {
    setValue("");
    setSize(null);
    setStatus(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const statusTone =
    status?.tone === "error" ? "text-rose-500" : status?.tone === "ok" ? "text-emerald-500" : "text-a-muted";

  return (
    <div className={widthClass}>
      <p className={hideLabel ? "sr-only" : "mb-1.5 text-sm font-medium text-a-text"}>{label}</p>

      <label
        htmlFor={`${fieldId}-file`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`admin-dropzone overflow-hidden ${dragging ? "border-a-accent bg-a-hover" : ""}`}
      >
        <span className={`relative flex ${ratioClass} w-full items-center justify-center p-2`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              // `onLoad` never fires for an already-cached image, so measure on
              // mount too — otherwise the size readout stays stuck on "a carregar".
              ref={measure}
              onLoad={(event) => measure(event.currentTarget)}
              onError={() => setSize(null)}
              // `contain` — the admin must see the whole image, not a crop.
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="flex flex-col items-center gap-2 px-4 text-center">
              <IconImage className="h-6 w-6 text-a-faint" />
              <span className="text-xs text-a-muted">
                Arraste uma imagem ou <span className="font-medium text-a-accent">escolha um ficheiro</span>
              </span>
              <span className="text-[0.7rem] text-a-faint">PNG, JPG, WEBP, AVIF ou SVG — até 8 MB</span>
            </span>
          )}
        </span>
        <input
          id={`${fieldId}-file`}
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>

      {value && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
          <span className="text-a-faint">
            {size ? `${size.width} × ${size.height} px` : "A pré-visualizar…"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="font-medium text-a-accent transition-opacity hover:opacity-75"
            >
              Substituir
            </button>
            <button
              type="button"
              onClick={clear}
              className="font-medium text-a-muted transition-colors hover:text-rose-500"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      <input
        id={`${fieldId}-url`}
        name={name}
        value={value}
        onChange={(event) => {
          setSize(null);
          setValue(event.target.value);
        }}
        placeholder="/images/products/… ou /uploads/…"
        aria-label={`${label} — caminho`}
        className="admin-input admin-input-sm mt-2"
      />

      {status && (
        <p role="status" className={`mt-1.5 text-xs ${statusTone}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
