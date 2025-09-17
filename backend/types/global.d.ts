// Global type definitions for the backend

interface SocketServer {
  eventMonitor: any;
  getConnectedDriversCount(): number;
  getConnectedCustomersCount(): number;
}

declare global {
  var socketServer: SocketServer | undefined;
}

export {};