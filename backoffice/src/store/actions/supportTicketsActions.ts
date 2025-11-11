import { API_CONFIG } from '../../config/api';
import axios from 'axios';
import {
  SUPPORT_TICKETS_FETCH_REQUEST,
  SUPPORT_TICKETS_FETCH_SUCCESS,
  SUPPORT_TICKETS_FETCH_FAILURE,
  SUPPORT_TICKETS_UPDATE_REQUEST,
  SUPPORT_TICKETS_UPDATE_SUCCESS,
  SUPPORT_TICKETS_UPDATE_FAILURE,
  SUPPORT_TICKETS_UPDATE_PAGINATION,
  SupportTicketsFetchRequestAction,
  SupportTicketsFetchSuccessAction,
  SupportTicketsFetchFailureAction,
  SupportTicketsUpdateRequestAction,
  SupportTicketsUpdateSuccessAction,
  SupportTicketsUpdateFailureAction,
  SupportTicketsUpdatePaginationAction,
  SupportTicketData,
  CustomerSupportTicketData,
} from './supportTicketsTypes';

// Action Creators
const supportTicketsFetchRequest = (): SupportTicketsFetchRequestAction => ({
  type: SUPPORT_TICKETS_FETCH_REQUEST,
});

const supportTicketsFetchSuccess = (
  driverTickets: SupportTicketData[],
  customerTickets: CustomerSupportTicketData[],
  totalDriverTickets: number,
  totalCustomerTickets: number
): SupportTicketsFetchSuccessAction => ({
  type: SUPPORT_TICKETS_FETCH_SUCCESS,
  payload: {
    driverTickets,
    customerTickets,
    totalDriverTickets,
    totalCustomerTickets,
  },
});

const supportTicketsFetchFailure = (error: string): SupportTicketsFetchFailureAction => ({
  type: SUPPORT_TICKETS_FETCH_FAILURE,
  payload: error,
});

const supportTicketsUpdateRequest = (): SupportTicketsUpdateRequestAction => ({
  type: SUPPORT_TICKETS_UPDATE_REQUEST,
});

const supportTicketsUpdateSuccess = (
  driverTickets?: SupportTicketData[],
  customerTickets?: CustomerSupportTicketData[]
): SupportTicketsUpdateSuccessAction => ({
  type: SUPPORT_TICKETS_UPDATE_SUCCESS,
  payload: {
    driverTickets,
    customerTickets,
  },
});

const supportTicketsUpdateFailure = (error: string): SupportTicketsUpdateFailureAction => ({
  type: SUPPORT_TICKETS_UPDATE_FAILURE,
  payload: error,
});

// Async Action Creators (Thunks)
export const fetchSupportTickets = (ticketType?: 'driver' | 'customer' | 'all') => {
  return async (dispatch: any) => {
    dispatch(supportTicketsFetchRequest());

    try {
      // Authorization is handled by axios interceptors, no need for manual token handling
      // Eğer belirli bir ticket tipi isteniyorsa, sadece onu getir
      if (ticketType === 'driver') {
        const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/support-tickets`);
        const driverData = response.data;

        dispatch(supportTicketsFetchSuccess(
          driverData.tickets || [],
          [],
          driverData.tickets?.length || 0,
          0
        ));
      } else if (ticketType === 'customer') {
        const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/customer-support-tickets`);
        const customerData = response.data;

        dispatch(supportTicketsFetchSuccess(
          [],
          customerData.tickets || [],
          0,
          customerData.tickets?.length || 0
        ));
      } else {
        // Hepsi isteniyorsa (varsayılan)
        const [driverResponse, customerResponse] = await Promise.all([
          axios.get(`${API_CONFIG.BASE_URL}/admin/support-tickets`),
          axios.get(`${API_CONFIG.BASE_URL}/admin/customer-support-tickets`),
        ]);

        const driverData = driverResponse.data;
        const customerData = customerResponse.data;

        dispatch(supportTicketsFetchSuccess(
          driverData.tickets || [],
          customerData.tickets || [],
          driverData.tickets?.length || 0,
          customerData.tickets?.length || 0
        ));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Destek talepleri alınırken bir hata oluştu';
      dispatch(supportTicketsFetchFailure(errorMessage));
    }
  };
};

export const updateSupportTicket = (ticketId: number, updateData: any, ticketType: 'driver' | 'customer') => {
  return async (dispatch: any) => {
    dispatch(supportTicketsUpdateRequest());

    try {
      // Authorization is handled by axios interceptors, no need for manual token handling
      const endpoint = ticketType === 'driver' 
        ? `/admin/support-tickets/${ticketId}`
        : `/admin/customer-support-tickets/${ticketId}`;

      const response = await axios.put(`${API_CONFIG.BASE_URL}${endpoint}`, updateData);
      const result = response.data;
      
      // Refresh tickets after update
      dispatch(fetchSupportTickets());
      
      dispatch(supportTicketsUpdateSuccess());

      return result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Destek talebi güncellenirken bir hata oluştu';
      dispatch(supportTicketsUpdateFailure(errorMessage));
      throw error;
    }
  };
};

export const updatePagination = (page: number, rowsPerPage: number): SupportTicketsUpdatePaginationAction => ({
  type: SUPPORT_TICKETS_UPDATE_PAGINATION,
  payload: { page, rowsPerPage },
});