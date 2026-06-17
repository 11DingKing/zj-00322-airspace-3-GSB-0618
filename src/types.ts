export type OperationType =
  | "AIRWORTHINESS_TEST"
  | "TRAINING_FLIGHT"
  | "LOGISTICS_DELIVERY";

export type FlightPlanStatus =
  | "PENDING_APPROVAL"
  | "QUEUED"
  | "APPROVED"
  | "IN_EXECUTION"
  | "COMPLETED"
  | "REVOKED"
  | "FROZEN"
  | "RESCHEDULE_PENDING";

export type RescheduleStatus =
  | "NONE"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type AirspaceStatus = "ACTIVE" | "INACTIVE" | "RESTRICTED";

export interface TimeSlot {
  start: string;
  end: string;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface AltitudeLayer {
  id: string;
  name: string;
  minAltitude: number;
  maxAltitude: number;
  capacity: number;
}

export interface Airspace {
  id: string;
  name: string;
  area: Coordinate[];
  altitudeCeiling: number;
  capacity: number;
  altitudeLayers: AltitudeLayer[];
  availableTimeSlots: TimeSlot[];
  status: AirspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RescheduleInfo {
  originalTimeSlot: TimeSlot;
  originalAltitudeLayerId: string;
  rescheduleStatus: RescheduleStatus;
  rescheduleReason: string | null;
  rescheduleRequestedAt: string | null;
  rescheduleProcessedAt: string | null;
}

export interface FlightPlan {
  id: string;
  airspaceId: string;
  companyName: string;
  timeSlot: TimeSlot;
  altitudeLayerId: string;
  aircraftType: string;
  operationType: OperationType;
  status: FlightPlanStatus;
  queuePosition: number | null;
  rejectReason: string | null;
  rescheduleInfo: RescheduleInfo | null;
  createdAt: string;
  approvedAt: string | null;
  frozenAt: string | null;
  frozenReason: string | null;
  statusBeforeFreeze: FlightPlanStatus | null;
}

export interface TemporaryControl {
  id: string;
  airspaceId: string;
  timeRange: TimeSlot;
  reason: string;
  createdAt: string;
  liftedAt: string | null;
}

export interface AltitudeLayerStats {
  altitudeLayerId: string;
  altitudeLayerName: string;
  minAltitude: number;
  maxAltitude: number;
  capacity: number;
  usedSlots: number;
  totalSlots: number;
  usageRate: number;
  totalPlans: number;
  approvedPlans: number;
}

export interface AirspaceStatistics {
  airspaceId: string;
  airspaceName: string;
  operationType: OperationType | "ALL";
  totalSlots: number;
  usedSlots: number;
  usageRate: number;
  totalPlans: number;
  approvedPlans: number;
  approvalRate: number;
  avgApprovalDurationMs: number | null;
  altitudeLayerStats: AltitudeLayerStats[];
}
