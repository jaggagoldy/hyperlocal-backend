import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const verifyBusinessOwnership = async (req, res, next) => {
  try {
    const businessId = req.headers['x-business-id'] || req.query?.businessId || req.body?.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required. Please provide x-business-id header.'
      });
    }

    // Verify the requested business belongs to the authenticated user
    const business = await prisma.businessProfile.findFirst({
      where: {
        id: businessId,
        userId: req.user.id
      }
    });

    if (!business) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own this business or it does not exist.'
      });
    }

    // Attach business context to request
    req.business = business;
    next();
  } catch (error) {
    console.error('Error verifying business ownership:', error);
    res.status(500).json({ success: false, message: 'Server error verifying business ownership.' });
  }
};

export default verifyBusinessOwnership;
