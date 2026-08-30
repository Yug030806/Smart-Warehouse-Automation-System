export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export interface ActionPermissions {
  canCreateTask: boolean;
  canAssignTask: boolean;
  canCancelTask: boolean;
  canManageBoxes: boolean;
  canManageVehicles: boolean;
  canManageWarehouses: boolean;
  canManageUsers: boolean;
  canEditSettings: boolean;
  canScanQR: boolean;
  canResolveAlerts: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, ActionPermissions> = {
  ADMIN: {
    canCreateTask: true,
    canAssignTask: true,
    canCancelTask: true,
    canManageBoxes: true,
    canManageVehicles: true,
    canManageWarehouses: true,
    canManageUsers: true,
    canEditSettings: true,
    canScanQR: true,
    canResolveAlerts: true,
  },
  MANAGER: {
    canCreateTask: true,
    canAssignTask: true,
    canCancelTask: true,
    canManageBoxes: true,
    canManageVehicles: true,
    canManageWarehouses: true,
    canManageUsers: true,
    canEditSettings: false, // Read-only access to settings
    canScanQR: true,
    canResolveAlerts: true,
  },
  OPERATOR: {
    canCreateTask: false,
    canAssignTask: false,
    canCancelTask: false,
    canManageBoxes: true, // View and update box status
    canManageVehicles: true, // View and update vehicle status
    canManageWarehouses: false,
    canManageUsers: false,
    canEditSettings: false,
    canScanQR: true,
    canResolveAlerts: true,
  },
  
};

export const ROUTE_ALLOWED_ROLES: Record<string, UserRole[]> = {
  '/dashboard': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/warehouses': ['ADMIN', 'MANAGER'],
  '/boxes': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/vehicles': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/tasks': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/tracking': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/scanner': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/analytics': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/alerts': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/audit-log': ['ADMIN', 'MANAGER', 'OPERATOR'],
  '/users': ['ADMIN', 'MANAGER'],
  '/settings': ['ADMIN', 'MANAGER'],
};

export function getPermissions(role?: string): ActionPermissions {
  const normalizedRole = (role?.toUpperCase() || 'OPERATOR') as UserRole;
  return ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS.OPERATOR;
}

export function isRouteAllowed(pathname: string, role?: string): boolean {
  const normalizedRole = (role?.toUpperCase() || 'OPERATOR') as UserRole;
  const matchedRoute = Object.keys(ROUTE_ALLOWED_ROLES).find((r) =>
    pathname.startsWith(r)
  );
  if (!matchedRoute) return true;
  return ROUTE_ALLOWED_ROLES[matchedRoute].includes(normalizedRole);
}
