import multer from 'multer';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

// Use memory storage to stream files directly from RAM to Cloudinary
const storage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  // Only allow JPEG, PNG, WEBP
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
    cb(null, true);
  } else {
    cb(new AppError(StatusCodes.BAD_REQUEST, 'Not an image! Please upload only JPEG, PNG or WEBP files.', true), false);
  }
};

export const uploadMedia = multer({
  storage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
