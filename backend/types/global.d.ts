// Global type definitions for the backend

interface SocketServer {
  eventMonitor: any;
  getConnectedDriversCount(): number;
  getConnectedCustomersCount(): number;
  getConnectionDetails(): {
    customers: Array<{
      id: string;
      userType: string;
      socketId: string;
      hasLocation: boolean;
      connectedAt: string;
    }>;
    drivers: Array<{
      id: string;
      userType: string;
      socketId: string;
      hasLocation: boolean;
      isAvailable: boolean;
      connectedAt: string;
    }>;
    supervisors: Array<{
      id: string;
      userType: string;
      socketId: string;
      connectedAt: string;
    }>;
  };
}

declare global {
  var socketServer: SocketServer | undefined;
}

export {};