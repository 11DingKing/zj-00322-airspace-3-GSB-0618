import express from "express";
import {
  createAirspace,
  listAirspaces,
  getAirspace,
  updateAirspace,
  deleteAirspace,
} from "./routes/airspace";
import {
  submitFlightPlan,
  listFlightPlans,
  getFlightPlan,
  approveFlightPlan,
  rejectFlightPlan,
  transitionFlightPlan,
  promoteQueuedPlans,
  requestReschedule,
} from "./routes/flightPlan";
import {
  createTemporaryControl,
  liftTemporaryControl,
  listTemporaryControls,
} from "./routes/temporaryControl";
import { getStatistics } from "./routes/statistics";
import { seed } from "./seed";

const app = express();
app.use(express.json());

app.post("/api/airspaces", createAirspace);
app.get("/api/airspaces", listAirspaces);
app.get("/api/airspaces/:id", getAirspace);
app.put("/api/airspaces/:id", updateAirspace);
app.delete("/api/airspaces/:id", deleteAirspace);

app.post("/api/flight-plans", submitFlightPlan);
app.get("/api/flight-plans", listFlightPlans);
app.get("/api/flight-plans/:id", getFlightPlan);
app.post("/api/flight-plans/:id/approve", approveFlightPlan);
app.post("/api/flight-plans/:id/reject", rejectFlightPlan);
app.put("/api/flight-plans/:id/status", transitionFlightPlan);
app.post("/api/airspaces/:airspaceId/promote-queue", promoteQueuedPlans);
app.post("/api/flight-plans/:id/reschedule", requestReschedule);

app.post("/api/temporary-controls", createTemporaryControl);
app.post("/api/temporary-controls/:id/lift", liftTemporaryControl);
app.get("/api/temporary-controls", listTemporaryControls);

app.get("/api/statistics", getStatistics);

seed();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 低空空域管理系统已启动: http://localhost:${PORT}`);
});
