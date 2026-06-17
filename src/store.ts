import { v4 as uuidv4 } from "uuid";
import {
  Airspace,
  FlightPlan,
  TemporaryControl,
  FlightPlanStatus,
  TimeSlot,
  AltitudeLayer,
} from "./types";

export const ACTIVE_OCCUPANCY_STATUSES: FlightPlanStatus[] = [
  "APPROVED",
  "IN_EXECUTION",
  "PENDING_APPROVAL",
  "RESCHEDULE_PENDING",
];

function isOccupancyActive(status: FlightPlanStatus): boolean {
  return ACTIVE_OCCUPANCY_STATUSES.includes(status);
}

class Store {
  airspaces: Map<string, Airspace> = new Map();
  flightPlans: Map<string, FlightPlan> = new Map();
  temporaryControls: Map<string, TemporaryControl> = new Map();

  reset() {
    this.airspaces.clear();
    this.flightPlans.clear();
    this.temporaryControls.clear();
  }

  addAirspace(
    airspace: Omit<Airspace, "id" | "createdAt" | "updatedAt">,
  ): Airspace {
    const now = new Date().toISOString();
    const record: Airspace = {
      ...airspace,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.airspaces.set(record.id, record);
    return record;
  }

  updateAirspace(id: string, updates: Partial<Airspace>): Airspace | null {
    const existing = this.airspaces.get(id);
    if (!existing) return null;
    const updated: Airspace = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.airspaces.set(id, updated);
    return updated;
  }

  getAirspace(id: string): Airspace | undefined {
    return this.airspaces.get(id);
  }

  listAirspaces(): Airspace[] {
    return Array.from(this.airspaces.values());
  }

  deleteAirspace(id: string): boolean {
    return this.airspaces.delete(id);
  }

  getAltitudeLayer(
    airspaceId: string,
    layerId: string,
  ): AltitudeLayer | undefined {
    const airspace = this.airspaces.get(airspaceId);
    if (!airspace) return undefined;
    return airspace.altitudeLayers.find((l) => l.id === layerId);
  }

  addFlightPlan(
    plan: Omit<
      FlightPlan,
      | "id"
      | "createdAt"
      | "approvedAt"
      | "frozenAt"
      | "frozenReason"
      | "queuePosition"
      | "rejectReason"
      | "statusBeforeFreeze"
      | "rescheduleInfo"
    > & {
      rescheduleInfo?: FlightPlan["rescheduleInfo"];
    },
  ): FlightPlan {
    const now = new Date().toISOString();
    const record: FlightPlan = {
      ...plan,
      id: uuidv4(),
      queuePosition: null,
      rejectReason: null,
      createdAt: now,
      approvedAt: null,
      frozenAt: null,
      frozenReason: null,
      statusBeforeFreeze: null,
      rescheduleInfo: plan.rescheduleInfo || null,
    };
    this.flightPlans.set(record.id, record);
    return record;
  }

  updateFlightPlan(
    id: string,
    updates: Partial<FlightPlan>,
  ): FlightPlan | null {
    const existing = this.flightPlans.get(id);
    if (!existing) return null;
    const updated: FlightPlan = { ...existing, ...updates, id: existing.id };
    this.flightPlans.set(id, updated);
    return updated;
  }

  getFlightPlan(id: string): FlightPlan | undefined {
    return this.flightPlans.get(id);
  }

  listFlightPlans(filters?: {
    airspaceId?: string;
    status?: FlightPlanStatus;
    companyName?: string;
    operationType?: string;
    altitudeLayerId?: string;
  }): FlightPlan[] {
    let plans = Array.from(this.flightPlans.values());
    if (filters) {
      if (filters.airspaceId)
        plans = plans.filter((p) => p.airspaceId === filters.airspaceId);
      if (filters.status)
        plans = plans.filter((p) => p.status === filters.status);
      if (filters.companyName)
        plans = plans.filter((p) => p.companyName === filters.companyName);
      if (filters.operationType)
        plans = plans.filter((p) => p.operationType === filters.operationType);
      if (filters.altitudeLayerId)
        plans = plans.filter(
          (p) => p.altitudeLayerId === filters.altitudeLayerId,
        );
    }
    return plans;
  }

  getPlansInAirspaceDuring(
    airspaceId: string,
    slot: TimeSlot,
    excludeId?: string,
  ): FlightPlan[] {
    return Array.from(this.flightPlans.values()).filter((p) => {
      if (p.airspaceId !== airspaceId) return false;
      if (excludeId && p.id === excludeId) return false;
      if (
        p.status === "REVOKED" ||
        p.status === "COMPLETED" ||
        p.status === "FROZEN"
      )
        return false;
      const pStart = new Date(p.timeSlot.start).getTime();
      const pEnd = new Date(p.timeSlot.end).getTime();
      const sStart = new Date(slot.start).getTime();
      const sEnd = new Date(slot.end).getTime();
      return pStart < sEnd && sStart < pEnd;
    });
  }

  getPlansInLayerDuring(
    airspaceId: string,
    altitudeLayerId: string,
    slot: TimeSlot,
    excludeId?: string,
  ): FlightPlan[] {
    return this.getPlansInAirspaceDuring(airspaceId, slot, excludeId).filter(
      (p) => p.altitudeLayerId === altitudeLayerId,
    );
  }

  getActiveOccupancyInLayerDuring(
    airspaceId: string,
    altitudeLayerId: string,
    slot: TimeSlot,
    excludeId?: string,
  ): number {
    return this.getPlansInLayerDuring(
      airspaceId,
      altitudeLayerId,
      slot,
      excludeId,
    ).filter((p) => isOccupancyActive(p.status)).length;
  }

  addTemporaryControl(
    control: Omit<TemporaryControl, "id" | "createdAt" | "liftedAt">,
  ): TemporaryControl {
    const now = new Date().toISOString();
    const record: TemporaryControl = {
      ...control,
      id: uuidv4(),
      createdAt: now,
      liftedAt: null,
    };
    this.temporaryControls.set(record.id, record);
    return record;
  }

  updateTemporaryControl(
    id: string,
    updates: Partial<TemporaryControl>,
  ): TemporaryControl | null {
    const existing = this.temporaryControls.get(id);
    if (!existing) return null;
    const updated: TemporaryControl = {
      ...existing,
      ...updates,
      id: existing.id,
    };
    this.temporaryControls.set(id, updated);
    return updated;
  }

  listTemporaryControls(airspaceId?: string): TemporaryControl[] {
    let controls = Array.from(this.temporaryControls.values());
    if (airspaceId)
      controls = controls.filter((c) => c.airspaceId === airspaceId);
    return controls;
  }

  getActiveTemporaryControls(airspaceId: string): TemporaryControl[] {
    return Array.from(this.temporaryControls.values()).filter(
      (c) => c.airspaceId === airspaceId && c.liftedAt === null,
    );
  }
}

export const store = new Store();
