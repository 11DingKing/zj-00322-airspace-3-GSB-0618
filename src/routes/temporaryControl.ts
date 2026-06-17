import { Request, Response } from "express";
import { store } from "../store";
import { TimeSlot } from "../types";

export function hasTimeOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const aStart = new Date(a.start).getTime();
  const aEnd = new Date(a.end).getTime();
  const bStart = new Date(b.start).getTime();
  const bEnd = new Date(b.end).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function createTemporaryControl(req: Request, res: Response) {
  const { airspaceId, timeRange, reason } = req.body;
  if (!airspaceId || !timeRange || !reason) {
    return res
      .status(400)
      .json({ error: "缺少必填字段: airspaceId, timeRange, reason" });
  }

  const airspace = store.getAirspace(airspaceId);
  if (!airspace) return res.status(404).json({ error: "指定空域不存在" });

  const control = store.addTemporaryControl({ airspaceId, timeRange, reason });

  const allPlans = store.listFlightPlans({ airspaceId });
  const frozenIds: string[] = [];
  for (const plan of allPlans) {
    if (
      plan.status === "APPROVED" ||
      plan.status === "PENDING_APPROVAL" ||
      plan.status === "IN_EXECUTION"
    ) {
      if (hasTimeOverlap(plan.timeSlot, timeRange)) {
        store.updateFlightPlan(plan.id, {
          status: "FROZEN",
          statusBeforeFreeze: plan.status,
          frozenAt: new Date().toISOString(),
          frozenReason: `临时管制: ${reason}`,
        });
        frozenIds.push(plan.id);
      }
    }
  }

  res.status(201).json({
    control,
    frozenPlans: frozenIds,
    message: `临时管制已生效，${frozenIds.length} 个飞行计划被冻结`,
  });
}

export function liftTemporaryControl(req: Request, res: Response) {
  const control = store.temporaryControls.get(req.params.id);
  if (!control) return res.status(404).json({ error: "临时管制记录不存在" });
  if (control.liftedAt) return res.status(400).json({ error: "该管制已解除" });

  store.updateTemporaryControl(control.id, {
    liftedAt: new Date().toISOString(),
  });

  const frozenPlans = store
    .listFlightPlans({ airspaceId: control.airspaceId })
    .filter(
      (p) =>
        p.status === "FROZEN" && hasTimeOverlap(p.timeSlot, control.timeRange),
    );

  const unfrozenIds: string[] = [];
  for (const fp of frozenPlans) {
    const restoreStatus = fp.statusBeforeFreeze || "PENDING_APPROVAL";
    store.updateFlightPlan(fp.id, {
      status: restoreStatus,
      statusBeforeFreeze: null,
      frozenAt: null,
      frozenReason: null,
    });
    unfrozenIds.push(fp.id);
  }

  res.json({
    control: store.temporaryControls.get(control.id),
    unfrozenPlans: unfrozenIds,
    message: `管制已解除，${unfrozenIds.length} 个计划已恢复原状态`,
  });
}

export function listTemporaryControls(req: Request, res: Response) {
  const { airspaceId } = req.query;
  const controls = store.listTemporaryControls(
    airspaceId as string | undefined,
  );
  res.json(controls);
}
