-- A line's IVA rate, in hundredths of a percent (1400 = 14%).
--
-- Lines filled in from an INVGEST document hold the document's taxable price
-- and its rate, so the record totals to the same cêntimo as the document.
-- Everything written before this — and every line typed by hand — keeps 0,
-- where the price stored is already the price paid and the totals are
-- unchanged.
ALTER TABLE "LinhaRelatorio"
  ADD COLUMN "taxaIvaCentesimos" INTEGER NOT NULL DEFAULT 0;
