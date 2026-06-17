import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { store } from "../store";
import { AirspaceStatus, AltitudeLayer } from "../types";

function validateAltitudeLayers(layers: AltitudeLayer[]): string | null {
  if (!Array.isArray(layers) || layers.length === 0) {
    return "高度层不能为空";
  }
  const seen = new Set<string>();
  for (const layer of layers) {
    if (!layer.id || !layer.name) return "每个高度层必须包含 id 和 name";
    if (typeof layer.minAltitude !== "number" || typeof layer.maxAltitude !== "number") {
      return "高度层 minAltitude 和 maxAltitude 必须为数字";
    }
    if (layer.minAltitude >= layer.maxAltitude) {
      return `高度层 ${layer.name} 的 minAltitude 必须小于 maxAltitude`;
    }
    if (typeof layer.capacity !== "number" || layer.capacity < 0) {
      return `高度层 ${layer.name} 的 capacity 必须为非负数字`;
    }
    if (seen.has(layer.id)) return `高度层 id 重复: ${layer.id}`;
    seen.add(layer.id);
  }
  layers.sort((a, b) => a.minAltitude - b.minAltitude);
  for (let i = 1; i < layers.length; i++) {
    if (layers[i].minAltitude < layers[i - 1].maxAltitude) {
      return `高度层 ${layers[i - 1].name} 与 ${layers[i].name} 存在重叠`;
    }
  }
  return null;
}

export function createAirspace(req: Request, res: Response) {
  const {
    name,
    area,
    altitudeCeiling,
    capacity,
    altitudeLayers,
    availableTimeSlots,
    status,
  } = req.body;
  if (
    !name ||
    !area ||
    !altitudeCeiling ||
    capacity === undefined ||
    !availableTimeSlots
  ) {
    return res
      .status(400)
      .json({
        error:
          "缺少必填字段: name, area, altitudeCeiling, capacity, availableTimeSlots",
      });
  }

  let layers: AltitudeLayer[] = [];
  if (altitudeLayers && altitudeLayers.length > 0) {
    const validateError = validateAltitudeLayers(altitudeLayers);
    if (validateError) {
      return res.status(400).json({ error: validateError });
    }
    layers = altitudeLayers;
  } else {
    layers = [
      {
        id: uuidv4(),
        name: "默认层",
        minAltitude: 0,
        maxAltitude: altitudeCeiling,
        capacity: capacity,
      },
    ];
  }

  const airspace = store.addAirspace({
    name,
    area,
    altitudeCeiling,
    capacity,
    altitudeLayers: layers,
    availableTimeSlots,
    status: status || "ACTIVE",
  });
  res.status(201).json(airspace);
}

export function listAirspaces(_req: Request, res: Response) {
  const airspaces = store.listAirspaces();
  res.json(airspaces);
}

export function getAirspace(req: Request, res: Response) {
  const airspace = store.getAirspace(req.params.id);
  if (!airspace) return res.status(404).json({ error: "空域不存在" });
  res.json(airspace);
}

export function updateAirspace(req: Request, res: Response) {
  const {
    name,
    area,
    altitudeCeiling,
    capacity,
    altitudeLayers,
    availableTimeSlots,
    status,
  } = req.body;

  if (altitudeLayers !== undefined) {
    const validateError = validateAltitudeLayers(altitudeLayers);
    if (validateError) {
      return res.status(400).json({ error: validateError });
    }
  }

  const updated = store.updateAirspace(req.params.id, {
    ...(name !== undefined && { name }),
    ...(area !== undefined && { area }),
    ...(altitudeCeiling !== undefined && { altitudeCeiling }),
    ...(capacity !== undefined && { capacity }),
    ...(altitudeLayers !== undefined && { altitudeLayers }),
    ...(availableTimeSlots !== undefined && { availableTimeSlots }),
    ...(status !== undefined && { status: status as AirspaceStatus }),
  });
  if (!updated) return res.status(404).json({ error: "空域不存在" });
  res.json(updated);
}

export function deleteAirspace(req: Request, res: Response) {
  const deleted = store.deleteAirspace(req.params.id);
  if (!deleted) return res.status(404).json({ error: "空域不存在" });
  res.json({ message: "空域已删除" });
}
