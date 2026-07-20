-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "heroEyebrow" TEXT,
    "heroHeadline" TEXT,
    "heroHighlight" TEXT,
    "heroSubtitle" TEXT,
    "heroScrollHint" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "themeColor" TEXT,
    "footerTagline" TEXT,
    "footerNif" TEXT,
    "footerAddress" TEXT,
    "footerPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "footerEmail" TEXT,
    "footerCopyright" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "whatsappUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
