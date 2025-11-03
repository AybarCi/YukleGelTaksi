import { SupportTicketsState } from '../types';
import {
  SUPPORT_TICKETS_FETCH_REQUEST,
  SUPPORT_TICKETS_FETCH_SUCCESS,
  SUPPORT_TICKETS_FETCH_FAILURE,
  SUPPORT_TICKETS_UPDATE_REQUEST,
  SUPPORT_TICKETS_UPDATE_SUCCESS,
  SUPPORT_TICKETS_UPDATE_FAILURE,
  SUPPORT_TICKETS_UPDATE_PAGINATION,
  SupportTicketsActionTypes,
} from '../actions/supportTicketsTypes';

const initialState: SupportTicketsState = {
  driverTickets: [],
  customerTickets: [],
  totalDriverTickets: 0,
  totalCustomerTickets: 0,
  loading: false,
  error: null,
  page: 0,
  rowsPerPage: 10,
};

export const supportTicketsReducer = (
  state = initialState,
  action: SupportTicketsActionTypes | { type: string; payload?: any }
): SupportTicketsState => {
  switch (action.type) {
    case SUPPORT_TICKETS_FETCH_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    
    case SUPPORT_TICKETS_FETCH_SUCCESS:
      return {
        ...state,
        loading: false,
        driverTickets: action.payload.driverTickets,
        customerTickets: action.payload.customerTickets,
        totalDriverTickets: action.payload.totalDriverTickets,
        totalCustomerTickets: action.payload.totalCustomerTickets,
        error: null,
      };
    
    case SUPPORT_TICKETS_FETCH_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload || 'Bir hata oluştu',
      };
    
    case SUPPORT_TICKETS_UPDATE_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    
    case SUPPORT_TICKETS_UPDATE_SUCCESS:
      return {
        ...state,
        loading: false,
        driverTickets: action.payload.driverTickets || state.driverTickets,
        customerTickets: action.payload.customerTickets || state.customerTickets,
        error: null,
      };
    
    case SUPPORT_TICKETS_UPDATE_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload || 'Bir hata oluştu',
      };
    
    case SUPPORT_TICKETS_UPDATE_PAGINATION:
      return {
        ...state,
        page: action.payload.page,
        rowsPerPage: action.payload.rowsPerPage,
      };
    
    default:
      return state;
  }
};

// Default export for use in combineReducers
export default supportTicketsReducer;