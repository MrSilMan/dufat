import Link from "next/link";
import { DufatLogo } from "@/components/brand/DufatLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-night px-6 text-center">
      <DufatLogo className="h-10" />
      <p className="mt-10 font-display text-7xl font-black text-dufat-sky">404</p>
      <h1 className="mt-4 text-2xl font-bold">Esta rua ainda não tem luz</h1>
      <p className="mt-2 max-w-sm text-white/60">
        A página que procura não existe ou foi movida.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-dufat px-7 py-3 font-semibold text-white transition-colors hover:bg-dufat-bright"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
