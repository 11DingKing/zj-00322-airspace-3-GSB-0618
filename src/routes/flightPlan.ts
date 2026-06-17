import { Request, Response } from "express";
import { store } from "../store";
import {
  FlightPlanStatus,
  OperationType,
  RescheduleStatus,
  TimeSlot,
} from "../types";

const CAPACITY_OCCUPYING_STATUSES: FlightPlanStatus[] = [
  "APPROVED",
  "IN_EXECUTION",
  "PENDING_APPROVAL",
  "RESCHEDULE_PENDING",
];

function isOccupyingCapacity(status: FlightPlanStatus): boolean {
  return CAPACITY_OCCUPYING_STATUSES.includes(status);
}

function isWithinAnySlot(slot: TimeSlot, availableSlots: TimeSlot[]): boolean {
  const sStart = new Date(slot.start).getTime();
  const sEnd = new Date(slot.end).getTime();
  return availableSlots.some((avail) => {
    const aStart = new Date(avail.start).getTime();
    const aEnd = new Date(avail.end).getTime();
    return sStart >= aStart && sEnd <= aEnd;
  });
}

function hasTimeOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const aStart = new Date(a.start).getTime();
  const aEnd = new Date(a.end).getTime();
  const bStart = new Date(b.start).getTime();
  const bEnd = new Date(b.end).getTime();
  return aStart < bEnd && bStart < aEnd;
}

function isUnderTemporaryControl(airspaceId: string, slot: TimeSlot): boolean {
  const controls = store.getActiveTemporaryControls(airspaceId);
  return controls.some((c) => hasTimeOverlap(slot, c.timeRange));
}

export function submitFlightPlan(req: Request, res: Response) {
  const {
    airspaceId,
    companyName,
    timeSlot,
    altitudeLayerId,
    aircraftType,
    operationType,
  } = req.body;
  if (
    !airspaceId ||
    !companyName ||
    !timeSlot ||
    !aircraftType ||
    !operationType
  ) {
    return res.status(400).json({
      error:
        "缺少必填字段: airspaceId, companyName, timeSlot, aircraftType, operationType",
    });
  }

  const validOpTypes: OperationType[] = [
    "AIRWORTHINESS_TEST",
    "TRAINING_FLIGHT",
    "LOGISTICS_DELIVERY",
  ];
  if (!validOpTypes.includes(operationType)) {
    return res
      .status(400)
      .json({ error: `作业类型无效，可选: ${validOpTypes.join(", ")}` });
  }

  const airspace = store.getAirspace(airspaceId);
  if (!airspace) return res.status(404).json({ error: "指定空域不存在" });

  if (airspace.status !== "ACTIVE") {
    return res.status(400).json({ error: "指定空域当前不可用" });
  }

  if (!isWithinAnySlot(timeSlot, airspace.availableTimeSlots)) {
    return res.status(400).json({ error: "申请时段不在空域开放时段范围内" });
  }

  if (isUnderTemporaryControl(airspaceId, timeSlot)) {
    return res.status(400).json({ error: "申请时段处于临时管制期，无法提交" });
  }

  let targetLayerId = altitudeLayerId;
  if (!targetLayerId) {
    if (airspace.altitudeLayers.length > 0) {
      targetLayerId = airspace.altitudeLayers[0].id;
    } else {
      return res.status(400).json({ error: "空域未配置高度层" });
    }
  }

  const targetLayer = store.getAltitudeLayer(airspaceId, targetLayerId);
  if (!targetLayer) {
    return res.status(400).json({ error: "指定的高度层不存在" });
  }

  const overlapping = store.getPlansInLayerDuring(
    airspaceId,
    targetLayerId,
    timeSlot,
  );
  const activeOverlapping = overlapping.filter((p) =>
    isOccupyingCapacity(p.status),
  );

  if (activeOverlapping.length >= targetLayer.capacity) {
    const queuedPlans = store
      .listFlightPlans({ airspaceId, altitudeLayerId: targetLayerId })
      .filter((p) => p.status === "QUEUED");
    const queuePosition = queuedPlans.length + 1;

    const plan = store.addFlightPlan({
      airspaceId,
      companyName,
      timeSlot,
      altitudeLayerId: targetLayerId,
      aircraftType,
      operationType,
      status: "QUEUED",
    });
    const saved = store.updateFlightPlan(plan.id, { queuePosition });
    return res.status(202).json({
      ...saved,
      message: `高度层 ${targetLayer.name} 该时段已达容量上限，计划已排队，当前排队位置: ${queuePosition}`,
    });
  }

  const plan = store.addFlightPlan({
    airspaceId,
    companyName,
    timeSlot,
    altitudeLayerId: targetLayerId,
    aircraftType,
    operationType,
    status: "PENDING_APPROVAL",
  });
  res.status(201).json(plan);
}

export function listFlightPlans(req: Request, res: Response) {
  const { airspaceId, status, companyName, operationType, altitudeLayerId } =
    req.query;
  const plans = store.listFlightPlans({
    airspaceId: airspaceId as string | undefined,
    status: status as FlightPlanStatus | undefined,
    companyName: companyName as string | undefined,
    operationType: operationType as string | undefined,
    altitudeLayerId: altitudeLayerId as string | undefined,
  });
  res.json(plans);
}

export function getFlightPlan(req: Request, res: Response) {
  const plan = store.getFlightPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: "飞行计划不存在" });
  res.json(plan);
}

function handleApproveReschedule(
  plan: NonNullable<ReturnType<typeof store.getFlightPlan>>,
  res: Response,
) {
  const info = plan.rescheduleInfo;
  if (!info) {
    return res.status(400).json({ error: "改期信息缺失" });
  }

  const airspace = store.getAirspace(plan.airspaceId);
  if (!airspace) return res.status(400).json({ error: "关联空域不存在" });

  if (!isWithinAnySlot(plan.timeSlot, airspace.availableTimeSlots)) {
    return res.status(400).json({ error: "新时段不在空域开放时段范围内" });
  }

  if (isUnderTemporaryControl(plan.airspaceId, plan.timeSlot)) {
    return res
      .status(400)
      .json({ error: "新时段处于临时管制期，无法批准改期" });
  }

  const targetLayer = store.getAltitudeLayer(
    plan.airspaceId,
    plan.altitudeLayerId,
  );
  if (!targetLayer) {
    return res.status(400).json({ error: "关联的高度层不存在" });
  }

  const overlapping = store.getPlansInLayerDuring(
    plan.airspaceId,
    plan.altitudeLayerId,
    plan.timeSlot,
    plan.id,
  );
  const approvedOverlapping = overlapping.filter((p) =>
    isOccupyingCapacity(p.status),
  );
  if (approvedOverlapping.length >= targetLayer.capacity) {
    return res
      .status(409)
      .json({ error: `高度层 ${targetLayer.name} 新时段已满，无法批准改期` });
  }

  const now = new Date().toISOString();
  const updated = store.updateFlightPlan(plan.id, {
    status: "APPROVED",
    approvedAt: now,
    rescheduleInfo: {
      ...info,
      rescheduleStatus: "APPROVED" as RescheduleStatus,
      rescheduleProcessedAt: now,
    },
  });
  res.json({
    ...updated,
    message: "改期已批准，原时段占用已释放",
  });
}

export function approveFlightPlan(req: Request, res: Response) {
  const plan = store.getFlightPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: "飞行计划不存在" });

  if (plan.status === "RESCHEDULE_PENDING") {
    return handleApproveReschedule(plan, res);
  }

  if (plan.status !== "PENDING_APPROVAL") {
    return res.status(400).json({
      error: `当前状态 ${plan.status} 不可审批，仅 PENDING_APPROVAL 状态可审批`,
    });
  }

  const airspace = store.getAirspace(plan.airspaceId);
  if (!airspace) return res.status(400).json({ error: "关联空域不存在" });

  if (isUnderTemporaryControl(plan.airspaceId, plan.timeSlot)) {
    return res
      .status(400)
      .json({ error: "该计划时段处于临时管制期，无法批准" });
  }

  const targetLayer = store.getAltitudeLayer(
    plan.airspaceId,
    plan.altitudeLayerId,
  );
  if (!targetLayer) {
    return res.status(400).json({ error: "关联的高度层不存在" });
  }

  const overlapping = store.getPlansInLayerDuring(
    plan.airspaceId,
    plan.altitudeLayerId,
    plan.timeSlot,
    plan.id,
  );
  const approvedOverlapping = overlapping.filter((p) =>
    isOccupyingCapacity(p.status),
  );
  if (approvedOverlapping.length >= targetLayer.capacity) {
    return res.status(409).json({
      error: `高度层 ${targetLayer.name} 此时段已满，无法批准，建议排队`,
    });
  }

  const now = new Date().toISOString();
  const updated = store.updateFlightPlan(plan.id, {
    status: "APPROVED",
    approvedAt: now,
  });
  res.json(updated);
}

export function rejectFlightPlan(req: Request, res: Response) {
  const { reason } = req.body;
  const plan = store.getFlightPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: "飞行计划不存在" });

  if (plan.status === "RESCHEDULE_PENDING" && plan.rescheduleInfo) {
    const now = new Date().toISOString();
    const updated = store.updateFlightPlan(plan.id, {
      status: "APPROVED",
      timeSlot: plan.rescheduleInfo.originalTimeSlot,
      altitudeLayerId: plan.rescheduleInfo.originalAltitudeLayerId,
      rescheduleInfo: {
        ...plan.rescheduleInfo,
        rescheduleStatus: "REJECTED" as RescheduleStatus,
        rescheduleReason: reason || "改期未通过",
        rescheduleProcessedAt: now,
      },
    });
    return res.json({
      ...updated,
      message: "改期已拒绝，已恢复原时段",
    });
  }

  if (plan.status !== "PENDING_APPROVAL" && plan.status !== "QUEUED") {
    return res.status(400).json({ error: `当前状态 ${plan.status} 不可退回` });
  }
  const updated = store.updateFlightPlan(plan.id, {
    status: "REVOKED",
    rejectReason: reason || "审批未通过",
  });
  res.json(updated);
}

export function requestReschedule(req: Request, res: Response) {
  const { timeSlot, altitudeLayerId, reason } = req.body;
  const plan = store.getFlightPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: "飞行计划不存在" });

  if (plan.status !== "APPROVED") {
    return res.status(400).json({
      error: `当前状态 ${plan.status} 不可申请改期，仅 APPROVED 状态可申请`,
    });
  }

  if (!timeSlot) {
    return res.status(400).json({ error: "缺少必填字段: timeSlot" });
  }

  const airspace = store.getAirspace(plan.airspaceId);
  if (!airspace) return res.status(400).json({ error: "关联空域不存在" });

  if (!isWithinAnySlot(timeSlot, airspace.availableTimeSlots)) {
    return res.status(400).json({ error: "新时段不在空域开放时段范围内" });
  }

  if (isUnderTemporaryControl(plan.airspaceId, timeSlot)) {
    return res
      .status(400)
      .json({ error: "新时段处于临时管制期，无法申请改期" });
  }

  let targetLayerId = altitudeLayerId || plan.altitudeLayerId;
  const targetLayer = store.getAltitudeLayer(plan.airspaceId, targetLayerId);
  if (!targetLayer) {
    return res.status(400).json({ error: "指定的高度层不存在" });
  }

  const overlapping = store.getPlansInLayerDuring(
    plan.airspaceId,
    targetLayerId,
    timeSlot,
    plan.id,
  );
  const activeOverlapping = overlapping.filter((p) =>
    isOccupyingCapacity(p.status),
  );

  if (activeOverlapping.length >= targetLayer.capacity) {
    return res
      .status(409)
      .json({ error: `高度层 ${targetLayer.name} 新时段已满，无法申请改期` });
  }

  const now = new Date().toISOString();
  const updated = store.updateFlightPlan(plan.id, {
    status: "RESCHEDULE_PENDING",
    timeSlot,
    altitudeLayerId: targetLayerId,
    rescheduleInfo: {
      originalTimeSlot: plan.timeSlot,
      originalAltitudeLayerId: plan.altitudeLayerId,
      rescheduleStatus: "PENDING" as RescheduleStatus,
      rescheduleReason: reason || null,
      rescheduleRequestedAt: now,
      rescheduleProcessedAt: null,
    },
  });
  res.status(201).json({
    ...updated,
    message: "改期申请已提交，等待审批",
  });
}

export function transitionFlightPlan(req: Request, res: Response) {
  const { status } = req.body;
  const validStatuses: FlightPlanStatus[] = [
    "IN_EXECUTION",
    "COMPLETED",
    "REVOKED",
  ];
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ error: `目标状态无效，可选: ${validStatuses.join(", ")}` });
  }

  const plan = store.getFlightPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: "飞行计划不存在" });

  const transitions: Record<FlightPlanStatus, FlightPlanStatus[]> = {
    PENDING_APPROVAL: [],
    QUEUED: ["REVOKED"],
    APPROVED: ["IN_EXECUTION", "REVOKED"],
    IN_EXECUTION: ["COMPLETED", "REVOKED"],
    COMPLETED: [],
    REVOKED: [],
    FROZEN: ["REVOKED"],
    RESCHEDULE_PENDING: [],
  };

  if (!transitions[plan.status].includes(status)) {
    return res
      .status(400)
      .json({ error: `不允许从 ${plan.status} 转换到 ${status}` });
  }

  const updated = store.updateFlightPlan(plan.id, { status });
  res.json(updated);
}

export function promoteQueuedPlans(req: Request, res: Response) {
  const { airspaceId } = req.params;
  const airspace = store.getAirspace(airspaceId);
  if (!airspace) return res.status(404).json({ error: "空域不存在" });

  const promoted: string[] = [];

  for (const layer of airspace.altitudeLayers) {
    const queuedPlans = store
      .listFlightPlans({ airspaceId, altitudeLayerId: layer.id })
      .filter((p) => p.status === "QUEUED")
      .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));

    for (const qp of queuedPlans) {
      const overlapping = store.getPlansInLayerDuring(
        airspaceId,
        layer.id,
        qp.timeSlot,
        qp.id,
      );
      const activeCount = overlapping.filter((p) =>
        isOccupyingCapacity(p.status),
      ).length;
      if (activeCount < layer.capacity) {
        store.updateFlightPlan(qp.id, {
          status: "PENDING_APPROVAL",
          queuePosition: null,
        });
        promoted.push(qp.id);
      } else {
        break;
      }
    }

    let pos = 1;
    const remaining = store
      .listFlightPlans({ airspaceId, altitudeLayerId: layer.id })
      .filter((p) => p.status === "QUEUED")
      .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
    for (const rp of remaining) {
      store.updateFlightPlan(rp.id, { queuePosition: pos++ });
    }
  }

  res.json({ promoted, message: `已提升 ${promoted.length} 个排队计划` });
}
