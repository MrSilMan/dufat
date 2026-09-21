-- The admin can move a report to another day, and the report's own history
-- says so, next to the edits and the reopenings. Nothing existing changes.

-- AlterEnum
ALTER TYPE "AcaoHistoricoRelatorio" ADD VALUE 'DATA_ALTERADA';
