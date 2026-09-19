-- Whether a line's unit price already contains the IVA.
--
-- Until now a rate on a line meant one thing: the price is taxable and the tax
-- is added on top, which is how an INVGEST document states its lines. A person
-- typing at the till means the opposite — the price is what was paid, and the
-- tax is inside it — so the two cases need telling apart before a typed line
-- can carry a rate at all.
--
-- false for every existing row, which leaves every total untouched: lines with
-- a rate came from a document and are taxable, and lines without a rate have
-- no tax to place either way.
ALTER TABLE "LinhaRelatorio"
  ADD COLUMN "precoIncluiIva" BOOLEAN NOT NULL DEFAULT false;
