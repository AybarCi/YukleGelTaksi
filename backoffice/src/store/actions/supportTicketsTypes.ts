// Support Tickets Action Types
import { SupportTicketData as MainSupportTicketData, CustomerSupportTicketData as MainCustomerSupportTicketData } from '../types';

export const SUPPORT_TICKETS_FETCH_REQUEST = 'SUPPORT_TICKETS_FETCH_REQUEST';
export const SUPPORT_TICKETS_FETCH_SUCCESS = 'SUPPORT_TICKETS_FETCH_SUCCESS';
export const SUPPORT_TICKETS_FETCH_FAILURE = 'SUPPORT_TICKETS_FETCH_FAILURE';

export const SUPPORT_TICKETS_UPDATE_REQUEST = 'SUPPORT_TICKETS_UPDATE_REQUEST';
export const SUPPORT_TICKETS_UPDATE_SUCCESS = 'SUPPORT_TICKETS_UPDATE_SUCCESS';
export const SUPPORT_TICKETS_UPDATE_FAILURE = 'SUPPORT_TICKETS_UPDATE_FAILURE';

export const SUPPORT_TICKETS_UPDATE_PAGINATION = 'SUPPORT_TICKETS_UPDATE_PAGINATION';

// Action Interfaces
export interface SupportTicketsFetchRequestAction {
  type: typeof SUPPORT_TICKETS_FETCH_REQUEST;
}

export interface SupportTicketsFetchSuccessAction {
  type: typeof SUPPORT_TICKETS_FETCH_SUCCESS;
  payload: {
    driverTickets: SupportTicketData[];
    customerTickets: CustomerSupportTicketData[];
    totalDriverTickets: number;
    totalCustomerTickets: number;
  };
}

export interface SupportTicketsFetchFailureAction {
  type: typeof SUPPORT_TICKETS_FETCH_FAILURE;
  payload: string;
}

export interface SupportTicketsUpdateRequestAction {
  type: typeof SUPPORT_TICKETS_UPDATE_REQUEST;
}

export interface SupportTicketsUpdateSuccessAction {
  type: typeof SUPPORT_TICKETS_UPDATE_SUCCESS;
  payload: {
    driverTickets?: SupportTicketData[];
    customerTickets?: CustomerSupportTicketData[];
  };
}

export interface SupportTicketsUpdateFailureAction {
  type: typeof SUPPORT_TICKETS_UPDATE_FAILURE;
  payload: string;
}

export interface SupportTicketsUpdatePaginationAction {
  type: typeof SUPPORT_TICKETS_UPDATE_PAGINATION;
  payload: {
    page: number;
    rowsPerPage: number;
  };
}

export type SupportTicketsActionTypes =
  | SupportTicketsFetchRequestAction
  | SupportTicketsFetchSuccessAction
  | SupportTicketsFetchFailureAction
  | SupportTicketsUpdateRequestAction
  | SupportTicketsUpdateSuccessAction
  | SupportTicketsUpdateFailureAction
  | SupportTicketsUpdatePaginationAction;

// Data Types - Import from main types to ensure consistency
export interface SupportTicketData extends MainSupportTicketData {}
export interface CustomerSupportTicketData extends MainCustomerSupportTicketData {}