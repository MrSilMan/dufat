-- Discounts, on an article and on a whole record.
--
-- A discount is typed into one field — "10%" or "1 500" — and stored as it was
-- given: its kind and its value. The line also stores what its discount took
-- off, and its share of the record's discount, so that `valorCentimos` stays
-- what the line finally came to and every total summed straight from this
-- table already has the discounts taken.
--
-- Every existing row gets no discount and zero shares, which leaves every
-- total exactly as it was saved.

-- CreateEnum
CREATE TYPE "TipoDesconto" AS ENUM ('PERCENTAGEM', 'VALOR');

-- AlterTable
ALTER TABLE "LinhaRelatorio" ADD COLUMN     "descontoCentimos" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "descontoRegistoCentimos" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "descontoTipo" "TipoDesconto",
ADD COLUMN     "descontoValor" BIGINT;

-- AlterTable
ALTER TABLE "RegistoRelatorio" ADD COLUMN     "descontoTipo" "TipoDesconto",
ADD COLUMN     "descontoValor" BIGINT;

-- A discount is a kind and a positive value, or neither; and what a discount
-- took off is never negative. Prisma cannot express these, so they live here.
ALTER TABLE "LinhaRelatorio" ADD CONSTRAINT "LinhaRelatorio_desconto_check" CHECK (
  ("descontoTipo" IS NULL AND "descontoValor" IS NULL)
  OR ("descontoTipo" IS NOT NULL AND "descontoValor" > 0)
);
ALTER TABLE "LinhaRelatorio" ADD CONSTRAINT "LinhaRelatorio_desconto_centimos_check" CHECK (
  "descontoCentimos" >= 0 AND "descontoRegistoCentimos" >= 0
);
ALTER TABLE "RegistoRelatorio" ADD CONSTRAINT "RegistoRelatorio_desconto_check" CHECK (
  ("descontoTipo" IS NULL AND "descontoValor" IS NULL)
  OR ("descontoTipo" IS NOT NULL AND "descontoValor" > 0)
);
