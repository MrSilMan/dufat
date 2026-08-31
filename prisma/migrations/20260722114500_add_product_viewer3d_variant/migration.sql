-- AlterTable: which 3D model (TurntableVariant) stages a product; NULL falls
-- back to the category's model. Nullable and additive.
ALTER TABLE "Product" ADD COLUMN "viewer3dVariant" TEXT;
