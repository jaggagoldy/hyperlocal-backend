import prisma from '../config/prisma.js';
import { z } from 'zod';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

export const getVendorLeads = async (vendorId) => {
  if (!vendorId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Vendor ID is required', true);
  }

  const leads = await prisma.lead.findMany({
    where: { vendorId },
    include: {
      catalogItem: {
        select: {
          title: true,
          price: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return leads;
};

export const updateLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED']),
});

export const updateLeadStatus = async (leadId, vendorId, data) => {
  const parsed = updateLeadStatusSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  // Ensure the lead exists and belongs to the vendor
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Lead not found', true);
  }

  if (lead.vendorId !== vendorId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not have permission to update this lead', true);
  }

  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: { status: parsed.data.status },
    include: {
      catalogItem: {
        select: {
          title: true,
          price: true,
        }
      }
    }
  });

  return updatedLead;
};
