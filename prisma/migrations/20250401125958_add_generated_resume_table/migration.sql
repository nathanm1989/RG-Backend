-- CreateTable
CREATE TABLE "GeneratedResume" (
    "id" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "jobDescriptionUrl" TEXT,

    CONSTRAINT "GeneratedResume_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GeneratedResume" ADD CONSTRAINT "GeneratedResume_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
