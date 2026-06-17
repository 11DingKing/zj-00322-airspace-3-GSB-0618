import { Request, Response } from "express";
import { store } from "../store";
import {
  AirspaceStatistics,
  AltitudeLayerStats,
  OperationType,
} from "../types";

function calcSlotMinutes(slot: { start: string; end: string }): number {
  return (
    (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000
  );
}

export function getStatistics(_req: Request, res: Response) {
  const airspaces = store.listAirspaces();
  const allPlans = store.listFlightPlans();

  const results: AirspaceStatistics[] = [];

  for (const airspace of airspaces) {
    const airspacePlans = allPlans.filter((p) => p.airspaceId === airspace.id);

    const operationTypes: (OperationType | "ALL")[] = [
      "ALL",
      "AIRWORTHINESS_TEST",
      "TRAINING_FLIGHT",
      "LOGISTICS_DELIVERY",
    ];

    for (const opType of operationTypes) {
      const plans =
        opType === "ALL"
          ? airspacePlans
          : airspacePlans.filter((p) => p.operationType === opType);

      if (plans.length === 0 && opType !== "ALL") continue;

      const approvedPlans = plans.filter(
        (p) =>
          p.status === "APPROVED" ||
          p.status === "IN_EXECUTION" ||
          p.status === "COMPLETED",
      );
      const completedPlans = plans.filter((p) => p.status === "COMPLETED");

      let totalSlotMinutes = 0;
      for (const slot of airspace.availableTimeSlots) {
        totalSlotMinutes += calcSlotMinutes(slot);
      }

      let usedSlotMinutes = 0;
      for (const plan of completedPlans) {
        usedSlotMinutes += calcSlotMinutes(plan.timeSlot);
      }
      const inProgressPlans = plans.filter((p) => p.status === "IN_EXECUTION");
      for (const plan of inProgressPlans) {
        const elapsed = Math.min(
          new Date().getTime() - new Date(plan.timeSlot.start).getTime(),
          new Date(plan.timeSlot.end).getTime() -
            new Date(plan.timeSlot.start).getTime(),
        );
        usedSlotMinutes += Math.max(0, elapsed) / 60000;
      }

      const usageRate =
        totalSlotMinutes > 0 ? usedSlotMinutes / totalSlotMinutes : 0;

      const approvalRate =
        plans.length > 0 ? approvedPlans.length / plans.length : 0;

      const approvalDurations = approvedPlans
        .filter((p) => p.approvedAt)
        .map(
          (p) =>
            new Date(p.approvedAt!).getTime() - new Date(p.createdAt).getTime(),
        );

      const avgApprovalDurationMs =
        approvalDurations.length > 0
          ? approvalDurations.reduce((sum, d) => sum + d, 0) /
            approvalDurations.length
          : null;

      const altitudeLayerStats: AltitudeLayerStats[] = [];
      for (const layer of airspace.altitudeLayers) {
        const layerPlans = plans.filter(
          (p) => p.altitudeLayerId === layer.id,
        );
        const layerApproved = layerPlans.filter(
          (p) =>
            p.status === "APPROVED" ||
            p.status === "IN_EXECUTION" ||
            p.status === "COMPLETED",
        );
        const layerCompleted = layerPlans.filter(
          (p) => p.status === "COMPLETED",
        );
        const layerInProgress = layerPlans.filter(
          (p) => p.status === "IN_EXECUTION",
        );

        let layerTotal = 0;
        for (const slot of airspace.availableTimeSlots) {
          layerTotal += calcSlotMinutes(slot) * layer.capacity;
        }

        let layerUsed = 0;
        for (const plan of layerCompleted) {
          layerUsed += calcSlotMinutes(plan.timeSlot);
        }
        for (const plan of layerInProgress) {
          const elapsed = Math.min(
            new Date().getTime() - new Date(plan.timeSlot.start).getTime(),
            new Date(plan.timeSlot.end).getTime() -
              new Date(plan.timeSlot.start).getTime(),
          );
          layerUsed += Math.max(0, elapsed) / 60000;
        }

        altitudeLayerStats.push({
          altitudeLayerId: layer.id,
          altitudeLayerName: layer.name,
          minAltitude: layer.minAltitude,
          maxAltitude: layer.maxAltitude,
          capacity: layer.capacity,
          totalSlots: Math.round(layerTotal),
          usedSlots: Math.round(layerUsed),
          usageRate: layerTotal > 0 ? Math.round((layerUsed / layerTotal) * 10000) / 10000 : 0,
          totalPlans: layerPlans.length,
          approvedPlans: layerApproved.length,
        });
      }

      results.push({
        airspaceId: airspace.id,
        airspaceName: airspace.name,
        operationType: opType,
        totalSlots: Math.round(totalSlotMinutes),
        usedSlots: Math.round(usedSlotMinutes),
        usageRate: Math.round(usageRate * 10000) / 10000,
        totalPlans: plans.length,
        approvedPlans: approvedPlans.length,
        approvalRate: Math.round(approvalRate * 10000) / 10000,
        avgApprovalDurationMs,
        altitudeLayerStats,
      });
    }
  }

  res.json(results);
}
