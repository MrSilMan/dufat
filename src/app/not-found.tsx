import Link from "next/link";
import { DufatLogo } from "@/components/brand/DufatLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <DufatLogo variant="dark" className="h-10" />
      <p className="mt-10 font-display text-7xl font-black text-gradient-blue">404</p>
      <h1 className="mt-4 text-2xl font-bold text-ink">Esta rua ainda não tem luz</h1>
      <p className="mt-2 max-w-sm text-ink-soft">
        A página que procura não existe ou foi movida.
      </p>
      <Link
        href="/"
        className="btn-primary mt-8 px-7 py-3"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
