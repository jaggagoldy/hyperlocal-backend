'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Clock, FileText, User } from 'lucide-react';

export interface Lead {
  id: string;
  catalogItemId: string;
  vendorId: string;
  customerName: string;
  customerPhone: string;
  customerRequirement?: string;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'REJECTED';
  createdAt: string;
  catalogItem?: {
    title: string;
    price: string | null;
  };
}

interface LeadCardProps {
  lead: Lead;
  onStatusChange: (leadId: string, newStatus: Lead['status']) => Promise<void>;
}

const statusColors = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  CONVERTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-800',
};

export default function LeadCard({ lead, onStatusChange }: LeadCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusUpdate = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as Lead['status'];
    setIsUpdating(true);
    await onStatusChange(lead.id, newStatus);
    setIsUpdating(false);
  };

  const timeAgo = formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true });
  
  // Format WhatsApp message
  const itemName = lead.catalogItem?.title || 'your inquiry';
  const whatsappText = encodeURIComponent(`Hi ${lead.customerName}, I saw your inquiry for ${itemName}...`);
  const whatsappUrl = `https://wa.me/91${lead.customerPhone}?text=${whatsappText}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 flex flex-col gap-4">
      
      {/* Header: Name and Time */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-2 rounded-full">
            <User size={18} className="text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{lead.customerName}</h3>
            <div className="flex items-center text-xs text-gray-500 gap-1">
              <Clock size={12} />
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>
        
        {/* Kanban Status Dropdown */}
        <select 
          value={lead.status}
          onChange={handleStatusUpdate}
          disabled={isUpdating}
          className={`text-xs font-semibold px-2 py-1 rounded-md border-0 outline-none appearance-none cursor-pointer ${statusColors[lead.status]} ${isUpdating ? 'opacity-50' : ''}`}
        >
          <option value="NEW">NEW</option>
          <option value="CONTACTED">CONTACTED</option>
          <option value="CONVERTED">CONVERTED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      {/* Catalog Item Context */}
      {lead.catalogItem && (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-800">Inquiry: {lead.catalogItem.title}</p>
          {lead.catalogItem.price && (
            <p className="text-xs text-gray-500">Listed Price: ₹{lead.catalogItem.price}</p>
          )}
        </div>
      )}

      {/* Customer Requirement Notes */}
      {lead.customerRequirement && (
        <div className="flex items-start gap-2 text-sm text-gray-600 bg-orange-50 p-3 rounded-lg border border-orange-100">
          <FileText size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="italic">"{lead.customerRequirement}"</p>
        </div>
      )}

      {/* WhatsApp Action Button */}
      <a 
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors"
      >
        <MessageCircle size={20} />
        WhatsApp Customer
      </a>
    </div>
  );
}
