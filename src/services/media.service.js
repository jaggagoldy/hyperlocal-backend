import { v2 as cloudinary } from 'cloudinary';
import { StatusCodes } from 'http-status-codes';
import env from '../config/env.js';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import logger from '../config/logger.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const uploadVendorMedia = async (vendorId, type, fileBuffer) => {
  // Check if vendor exists
  const vendor = await prisma.businessProfile.findUnique({
    where: { id: vendorId },
  });

  if (!vendor || vendor.deletedAt !== null) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Vendor not found or suspended', true);
  }

  const validTypes = ['profile_image', 'gallery', 'verification_doc', 'cover'];
  if (!validTypes.includes(type)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid media type', true);
  }

  // Cloudinary upload options
  const folder = `hyperlocal/vendors/${vendorId}/${type}`;
  const options = {
    folder,
    format: 'webp',
    transformation:
      type === 'cover'
        ? [
            // Cover banners are smart-cropped to a wide 3:1 storefront aspect.
            { width: 1600, height: 533, crop: 'fill', gravity: 'auto' },
            { quality: 'auto', fetch_format: 'auto' },
          ]
        : [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
  };

  // Secure verification docs
  if (type === 'verification_doc') {
    options.access_mode = 'authenticated';
    options.type = 'authenticated';
  }

  // Stream buffer to Cloudinary
  const uploadResult = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        logger.error({ error, vendorId }, 'Cloudinary upload failed');
        return reject(new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to upload media to cloud', true));
      }
      resolve(result);
    });

    // Write buffer directly to stream
    uploadStream.end(fileBuffer);
  });

  // A business has a single cover banner: retire any previous cover before
  // recording the new one (upload already succeeded, so no coverless window).
  if (type === 'cover') {
    const existingCovers = await prisma.businessMedia.findMany({
      where: { businessProfileId: vendorId, type: 'cover' },
    });
    for (const old of existingCovers) {
      try {
        await cloudinary.uploader.destroy(old.publicId);
      } catch (error) {
        logger.error({ error, publicId: old.publicId }, 'Failed to remove previous cover from Cloudinary');
      }
      await prisma.businessMedia.delete({ where: { id: old.id } });
    }
  }

  // Save tracking data to Prisma DB
  const media = await prisma.businessMedia.create({
    data: {
      businessProfileId: vendorId,
      type,
      secureUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    },
  });

  return media;
};

export const deleteVendorMedia = async (mediaId, vendorId) => {
  // Find media ensuring ownership
  const media = await prisma.businessMedia.findFirst({
    where: { id: mediaId, businessProfileId: vendorId },
  });

  if (!media) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Media not found', true);
  }

  // Define destruction options
  const destroyOptions = {};
  if (media.type === 'verification_doc') {
    destroyOptions.type = 'authenticated';
  }

  // Securely wipe from Cloudinary servers
  try {
    await cloudinary.uploader.destroy(media.publicId, destroyOptions);
  } catch (error) {
    logger.error({ error, publicId: media.publicId }, 'Failed to delete media from Cloudinary');
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Cloud deletion failed', true);
  }

  // Delete from local DB
  await prisma.businessMedia.delete({
    where: { id: mediaId },
  });

  return { message: 'Media successfully deleted' };
};
