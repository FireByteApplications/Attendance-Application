import { describe, expect, it, vi } from "vitest";
import { createEventService } from "./eventManagement";

function fixtures() {
  const eventsCollection = {
    findOne: vi.fn().mockResolvedValue(null),
    insertOne: vi.fn().mockResolvedValue({ insertedId: "event-id" }),
  };
  const countersCollection = {
    findOneAndUpdate: vi.fn().mockResolvedValue({ seq: 42 }),
  };
  return {
    eventsCollection,
    countersCollection,
    service: createEventService({ eventsCollection, countersCollection } as any),
  };
}

describe("event management", () => {
  it("allocates a padded event number with an atomic counter update", async () => {
    const { service, countersCollection } = fixtures();
    await expect(service.getNextEventNumber()).resolves.toBe("EVT-00042");
    expect(countersCollection.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "eventNumber" }, { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  });

  it("reuses a matching non-incident event", async () => {
    const { service, eventsCollection, countersCollection } = fixtures();
    const existing = { eventNumber: "EVT-00003", eventType: "Training", eventDate: "2026-11-05" };
    eventsCollection.findOne.mockResolvedValueOnce(existing);
    await expect(service.resolveEventForAttendance("Training", "2026-11-05"))
      .resolves.toEqual({ event: existing, eventCreated: false });
    expect(eventsCollection.insertOne).not.toHaveBeenCalled();
    expect(countersCollection.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("creates a dated non-incident event when none exists", async () => {
    const { service, eventsCollection } = fixtures();
    const result = await service.resolveEventForAttendance("Training", "2026-11-05");
    expect(result.eventCreated).toBe(true);
    expect(result.event.eventNumber).toBe("EVT-00042");
    expect(eventsCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "Training", eventDate: "2026-11-05", eventNumber: "EVT-00042",
    }));
  });

  it("requires an existing incident for incident attendance", async () => {
    const { service, eventsCollection } = fixtures();
    await expect(service.resolveEventForAttendance("Incident-Call", "2026-11-05"))
      .rejects.toThrow("Please select an incident event.");
    await expect(service.resolveEventForAttendance("Incident-Call", "2026-11-05", "26-42"))
      .rejects.toThrow("could not be found");
    const incident = { eventNumber: "26-42", eventType: "Incident-Call" };
    eventsCollection.findOne.mockResolvedValueOnce(incident);
    await expect(service.resolveEventForAttendance("Incident-Call", "2026-11-05", "26-42"))
      .resolves.toEqual({ event: incident, eventCreated: false });
  });
});
