/*
  Warnings:

  - You are about to drop the column `age` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `customerAge` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "OrderEnquiry" DROP CONSTRAINT "OrderEnquiry_vendorId_fkey";

-- AlterTable
ALTER TABLE "OrderEnquiry" ALTER COLUMN "vendorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "age",
DROP COLUMN "customerAge";

-- AddForeignKey
ALTER TABLE "OrderEnquiry" ADD CONSTRAINT "OrderEnquiry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
