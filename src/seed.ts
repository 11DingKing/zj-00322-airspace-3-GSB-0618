import { v4 as uuidv4 } from "uuid";
import { store } from "./store";

export function seed() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const layerLowId = uuidv4();
  const layerMidId = uuidv4();
  const layerHighId = uuidv4();

  const airspace1 = store.addAirspace({
    name: "滨江新区试飞空域",
    area: [
      { lat: 30.25, lng: 120.21 },
      { lat: 30.25, lng: 120.25 },
      { lat: 30.22, lng: 120.25 },
      { lat: 30.22, lng: 120.21 },
    ],
    altitudeCeiling: 120,
    capacity: 3,
    altitudeLayers: [
      {
        id: layerLowId,
        name: "低空层(0-40米)",
        minAltitude: 0,
        maxAltitude: 40,
        capacity: 2,
      },
      {
        id: layerMidId,
        name: "中空层(40-80米)",
        minAltitude: 40,
        maxAltitude: 80,
        capacity: 2,
      },
      {
        id: layerHighId,
        name: "高空层(80-120米)",
        minAltitude: 80,
        maxAltitude: 120,
        capacity: 1,
      },
    ],
    availableTimeSlots: [
      { start: `${today}T06:00:00+08:00`, end: `${today}T12:00:00+08:00` },
      { start: `${today}T14:00:00+08:00`, end: `${today}T20:00:00+08:00` },
    ],
    status: "ACTIVE",
  });

  const layerLogisticsLow = uuidv4();
  const layerLogisticsHigh = uuidv4();

  const airspace2 = store.addAirspace({
    name: "临空经济物流空域",
    area: [
      { lat: 30.28, lng: 120.15 },
      { lat: 30.28, lng: 120.2 },
      { lat: 30.24, lng: 120.2 },
      { lat: 30.24, lng: 120.15 },
    ],
    altitudeCeiling: 200,
    capacity: 5,
    altitudeLayers: [
      {
        id: layerLogisticsLow,
        name: "物流低层(0-100米)",
        minAltitude: 0,
        maxAltitude: 100,
        capacity: 3,
      },
      {
        id: layerLogisticsHigh,
        name: "物流高层(100-200米)",
        minAltitude: 100,
        maxAltitude: 200,
        capacity: 2,
      },
    ],
    availableTimeSlots: [
      { start: `${today}T08:00:00+08:00`, end: `${today}T18:00:00+08:00` },
    ],
    status: "ACTIVE",
  });

  const layerTrainLow = uuidv4();
  const layerTrainHigh = uuidv4();

  const airspace3 = store.addAirspace({
    name: "科技园培训空域",
    area: [
      { lat: 30.3, lng: 120.22 },
      { lat: 30.3, lng: 120.26 },
      { lat: 30.27, lng: 120.26 },
      { lat: 30.27, lng: 120.22 },
    ],
    altitudeCeiling: 80,
    capacity: 2,
    altitudeLayers: [
      {
        id: layerTrainLow,
        name: "培训低层(0-40米)",
        minAltitude: 0,
        maxAltitude: 40,
        capacity: 1,
      },
      {
        id: layerTrainHigh,
        name: "培训高层(40-80米)",
        minAltitude: 40,
        maxAltitude: 80,
        capacity: 1,
      },
    ],
    availableTimeSlots: [
      { start: `${today}T07:00:00+08:00`, end: `${today}T11:00:00+08:00` },
      { start: `${today}T15:00:00+08:00`, end: `${today}T19:00:00+08:00` },
    ],
    status: "ACTIVE",
  });

  const plan1 = store.addFlightPlan({
    airspaceId: airspace1.id,
    companyName: "天翼无人机科技",
    timeSlot: {
      start: `${today}T06:00:00+08:00`,
      end: `${today}T08:00:00+08:00`,
    },
    altitudeLayerId: layerLowId,
    aircraftType: "DJI Matrice 350 RTK",
    operationType: "AIRWORTHINESS_TEST",
    status: "APPROVED",
  });
  store.updateFlightPlan(plan1.id, {
    createdAt: new Date(now.getTime() - 86400000).toISOString(),
    approvedAt: new Date(now.getTime() - 86400000 + 1800000).toISOString(),
  });

  const plan2 = store.addFlightPlan({
    airspaceId: airspace1.id,
    companyName: "迅飞航空物流",
    timeSlot: {
      start: `${today}T08:00:00+08:00`,
      end: `${today}T10:00:00+08:00`,
    },
    altitudeLayerId: layerMidId,
    aircraftType: "亿航 EH216-S",
    operationType: "LOGISTICS_DELIVERY",
    status: "PENDING_APPROVAL",
  });

  const plan3 = store.addFlightPlan({
    airspaceId: airspace1.id,
    companyName: "蓝天飞行学院",
    timeSlot: {
      start: `${today}T06:30:00+08:00`,
      end: `${today}T09:00:00+08:00`,
    },
    altitudeLayerId: layerMidId,
    aircraftType: "纵横 CW-25",
    operationType: "TRAINING_FLIGHT",
    status: "APPROVED",
  });
  store.updateFlightPlan(plan3.id, {
    createdAt: new Date(now.getTime() - 7200000).toISOString(),
    approvedAt: new Date(now.getTime() - 7200000 + 900000).toISOString(),
  });

  const plan4 = store.addFlightPlan({
    airspaceId: airspace2.id,
    companyName: "迅飞航空物流",
    timeSlot: {
      start: `${today}T09:00:00+08:00`,
      end: `${today}T11:00:00+08:00`,
    },
    altitudeLayerId: layerLogisticsLow,
    aircraftType: "亿航 EH216-S",
    operationType: "LOGISTICS_DELIVERY",
    status: "IN_EXECUTION",
  });
  store.updateFlightPlan(plan4.id, {
    createdAt: new Date(now.getTime() - 10800000).toISOString(),
    approvedAt: new Date(now.getTime() - 10800000 + 1200000).toISOString(),
  });

  const plan5 = store.addFlightPlan({
    airspaceId: airspace2.id,
    companyName: "天翼无人机科技",
    timeSlot: {
      start: `${today}T10:00:00+08:00`,
      end: `${today}T12:00:00+08:00`,
    },
    altitudeLayerId: layerLogisticsHigh,
    aircraftType: "DJI Matrice 350 RTK",
    operationType: "AIRWORTHINESS_TEST",
    status: "APPROVED",
  });
  store.updateFlightPlan(plan5.id, {
    createdAt: new Date(now.getTime() - 5400000).toISOString(),
    approvedAt: new Date(now.getTime() - 5400000 + 600000).toISOString(),
  });

  const plan6 = store.addFlightPlan({
    airspaceId: airspace3.id,
    companyName: "蓝天飞行学院",
    timeSlot: {
      start: `${today}T07:00:00+08:00`,
      end: `${today}T09:00:00+08:00`,
    },
    altitudeLayerId: layerTrainLow,
    aircraftType: "纵横 CW-25",
    operationType: "TRAINING_FLIGHT",
    status: "COMPLETED",
  });
  store.updateFlightPlan(plan6.id, {
    createdAt: new Date(now.getTime() - 14400000).toISOString(),
    approvedAt: new Date(now.getTime() - 14400000 + 2400000).toISOString(),
  });

  const plan7 = store.addFlightPlan({
    airspaceId: airspace3.id,
    companyName: "蓝天飞行学院",
    timeSlot: {
      start: `${today}T08:30:00+08:00`,
      end: `${today}T10:30:00+08:00`,
    },
    altitudeLayerId: layerTrainHigh,
    aircraftType: "纵横 CW-15",
    operationType: "TRAINING_FLIGHT",
    status: "PENDING_APPROVAL",
  });

  const plan8 = store.addFlightPlan({
    airspaceId: airspace1.id,
    companyName: "中通无人机",
    timeSlot: {
      start: `${today}T06:00:00+08:00`,
      end: `${today}T09:00:00+08:00`,
    },
    altitudeLayerId: layerLowId,
    aircraftType: "丰翼方舟150",
    operationType: "LOGISTICS_DELIVERY",
    status: "QUEUED",
  });
  store.updateFlightPlan(plan8.id, { queuePosition: 1 });

  console.log(
    `✅ 种子数据已加载: ${store.airspaces.size} 个空域, ${store.flightPlans.size} 个飞行计划`,
  );
}
