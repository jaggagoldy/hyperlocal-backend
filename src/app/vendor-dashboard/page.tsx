'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import LeadCard, { Lead } from '@/components/vendor/LeadCard';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';

export default function VendorDashboardPage() {
  const { token, vendorId } = useAuthStore((state) => ({ 
    token: state.token,
    vendorId: state.user?.vendorId 
  }));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const response = await axios.get('/api/v1/leads', {
          headers: {
            Authorization: `Bearer ${token}`
          },
          // We pass vendorId if our backend requires it, but the token usually carries it.
          // Fallback to query param just in case as our Express backend allows it.
          params: { vendorId }
        });
        
        if (response.data.status === 'success') {
          setLeads(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch leads', error);
        toast.error('Failed to load leads.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchLeads();
    }
  }, [token, vendorId]);

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    // Optimistic UI Update
    const previousLeads = [...leads];
    setLeads((currentLeads) => 
      currentLeads.map((lead) => 
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      )
    );

    try {
      await axios.patch(`/api/v1/leads/${leadId}/status`, {
        status: newStatus,
        vendorId // Provide vendorId in body as expected by the existing backend controller
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      toast.success('Lead status updated!');
    } catch (error) {
      // Revert on failure
      setLeads(previousLeads);
      console.error('Failed to update status', error);
      toast.error('Failed to update lead status. Please check your connection.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CRM Lead Manager</h2>
          <p className="text-gray-500 text-sm mt-1">Manage inquiries and connect with customers.</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 border-dashed p-12 text-center">
          <div className="bg-gray-100 p-4 rounded-full mb-4">
            <Inbox size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Inbox Zero!</h3>
          <p className="text-gray-500 mt-2 max-w-sm">
            You don't have any leads yet. Keep your profile active and catalog updated to attract customers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead) => (
            <LeadCard 
              key={lead.id} 
              lead={lead} 
              onStatusChange={handleStatusChange} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
