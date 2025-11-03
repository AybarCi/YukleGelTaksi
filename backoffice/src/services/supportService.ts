import axios from 'axios';
import { API_CONFIG } from '../config/api';

export interface SupportTicket {
  id: number;
  driver_id: number;
  issue_type: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_response?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  driver_name?: string;
  driver_phone?: string;
  driver_email?: string;
}

export interface CustomerSupportTicket {
  id: number;
  user_id: number;
  issue_type: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_response?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

export interface UpdateTicketRequest {
  status?: string;
  admin_response?: string;
  priority?: string;
}

export interface BulkUpdateRequest {
  ticket_ids: number[];
  action: 'take' | 'resolve' | 'update_priority' | 'update_status';
  data?: {
    status?: string;
    priority?: string;
    admin_response?: string;
  };
}

export interface SupportTicketsResponse {
  success: boolean;
  tickets: SupportTicket[];
  total?: number;
  message?: string;
}

export interface CustomerSupportTicketsResponse {
  success: boolean;
  tickets: CustomerSupportTicket[];
  total?: number;
  message?: string;
}

export interface SingleTicketResponse {
  success: boolean;
  ticket: SupportTicket;
  message?: string;
}

export interface SingleCustomerTicketResponse {
  success: boolean;
  ticket: CustomerSupportTicket;
  message?: string;
}

export interface BulkUpdateResponse {
  success: boolean;
  message: string;
  updated_count: number;
  tickets: SupportTicket[];
}

class SupportService {
  // Authorization is now handled by axios interceptors setup in App.tsx
  private getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  // Get all support tickets
  async getAllTickets(): Promise<SupportTicketsResponse> {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/support-tickets`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Destek talepleri alınamadı');
    }
  }

  // Get specific support ticket by ID
  async getTicketById(ticketId: number): Promise<SingleTicketResponse> {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/support-tickets/${ticketId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Destek talebi alınamadı');
    }
  }

  // Update specific support ticket
  async updateTicket(ticketId: number, updateData: UpdateTicketRequest): Promise<SingleTicketResponse> {
    try {
      console.log('🔥 supportService.updateTicket called with:', { ticketId, updateData });
      console.log('🔥 Full URL:', `${API_CONFIG.BASE_URL}/admin/support-tickets/${ticketId}`);
      console.log('🔥 Headers:', this.getHeaders());
      
      const response = await axios.put(`${API_CONFIG.BASE_URL}/admin/support-tickets/${ticketId}`, updateData, {
        headers: this.getHeaders()
      });
      
      console.log('🔥 API Response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('🔥 API Error:', error);
      console.error('🔥 API Error Response:', error.response?.data);
      console.error('🔥 API Error Status:', error.response?.status);
      throw new Error(error.response?.data?.error || 'Destek talebi güncellenemedi');
    }
  }

  // Take ticket (set status to in_progress)
  async takeTicket(ticketId: number): Promise<SingleTicketResponse> {
    return this.updateTicket(ticketId, { status: 'in_progress' });
  }

  // Resolve ticket with admin response
  async resolveTicket(ticketId: number, adminResponse: string): Promise<SingleTicketResponse> {
    return this.updateTicket(ticketId, { 
      status: 'resolved', 
      admin_response: adminResponse 
    });
  }

  // Update ticket priority
  async updateTicketPriority(ticketId: number, priority: string): Promise<SingleTicketResponse> {
    return this.updateTicket(ticketId, { priority });
  }

  // Bulk operations
  async bulkUpdate(bulkData: BulkUpdateRequest): Promise<BulkUpdateResponse> {
    try {
      const response = await axios.post(`${API_CONFIG.BASE_URL}/admin/support-tickets/bulk`, bulkData, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Toplu işlem başarısız');
    }
  }

  // Bulk take tickets
  async bulkTakeTickets(ticketIds: number[]): Promise<BulkUpdateResponse> {
    return this.bulkUpdate({
      ticket_ids: ticketIds,
      action: 'take'
    });
  }

  // Bulk resolve tickets
  async bulkResolveTickets(ticketIds: number[], adminResponse?: string): Promise<BulkUpdateResponse> {
    return this.bulkUpdate({
      ticket_ids: ticketIds,
      action: 'resolve',
      data: adminResponse ? { admin_response: adminResponse } : undefined
    });
  }

  // Bulk update priority
  async bulkUpdatePriority(ticketIds: number[], priority: string): Promise<BulkUpdateResponse> {
    return this.bulkUpdate({
      ticket_ids: ticketIds,
      action: 'update_priority',
      data: { priority }
    });
  }

  // Bulk update status
  async bulkUpdateStatus(ticketIds: number[], status: string): Promise<BulkUpdateResponse> {
    return this.bulkUpdate({
      ticket_ids: ticketIds,
      action: 'update_status',
      data: { status }
    });
  }

  // Delete ticket (optional)
  async deleteTicket(ticketId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.delete(`${API_CONFIG.BASE_URL}/admin/support-tickets/${ticketId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Destek talebi silinemedi');
    }
  }

  // Customer Support Tickets Methods
  
  // Get all customer support tickets
  async getAllCustomerTickets(): Promise<CustomerSupportTicketsResponse> {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/customer-support-tickets`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Müşteri destek talepleri alınamadı');
    }
  }

  // Get specific customer support ticket by ID
  async getCustomerTicketById(ticketId: number): Promise<SingleCustomerTicketResponse> {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/customer-support-tickets/${ticketId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Müşteri destek talebi alınamadı');
    }
  }

  // Update specific customer support ticket
  async updateCustomerTicket(ticketId: number, updateData: UpdateTicketRequest): Promise<SingleCustomerTicketResponse> {
    try {
      console.log('🔥 supportService.updateCustomerTicket called with:', { ticketId, updateData });
      console.log('🔥 Full URL:', `${API_CONFIG.BASE_URL}/admin/customer-support-tickets/${ticketId}`);
      console.log('🔥 Headers:', this.getHeaders());
      
      const response = await axios.put(`${API_CONFIG.BASE_URL}/admin/customer-support-tickets/${ticketId}`, updateData, {
        headers: this.getHeaders()
      });
      
      console.log('🔥 API Response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('🔥 API Error:', error);
      console.error('🔥 API Error Response:', error.response?.data);
      console.error('🔥 API Error Status:', error.response?.status);
      throw new Error(error.response?.data?.error || 'Müşteri destek talebi güncellenemedi');
    }
  }

  // Delete customer support ticket
  async deleteCustomerTicket(ticketId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.delete(`${API_CONFIG.BASE_URL}/admin/customer-support-tickets/${ticketId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Müşteri destek talebi silinemedi');
    }
  }
}

export default new SupportService();