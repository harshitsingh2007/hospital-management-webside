/**
 * Shared Emergency Helper Utilities
 * Re-exports unified desk & emergency scoping logic from deskScope.jsx
 */
export {
  isEmergencyTicket,
  formatTimeSinceArrival,
  resolveAssignedDesk,
  getDeskScope,
  scopeTicketsForDesk,
  useAssignedDesk,
  DeskDepartmentBadge,
  EmergencyDeskBanner,
  NoDeskNotice,
  EmergencyBadge,
} from "./deskScope.jsx";
