import moment from 'moment-timezone';

export function createEventService({
  eventsCollection,
  countersCollection
}: EventServiceCollections) {
  
  async function getNextEventNumber() {
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "eventNumber" },
      { $inc: { seq: 1 } },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    if (!counter) {
      throw new Error("Failed to generate event number");
    }

    return `EVT-${String(counter.seq).padStart(5, "0")}`;
  }

  async function findOrCreateNonIncidentEvent(activity: string, eventDate: string) {

    function formatEventDateDescription(eventDate: string) {
    return moment
        .tz(eventDate, "YYYY-MM-DD", "Australia/Sydney")
        .format("dddd [the] Do [of] MMMM YYYY");
    }

    const existingEvent = await eventsCollection.findOne({
      eventType: activity,
      eventDate
    });

    if (existingEvent) {
      return {
        event: existingEvent,
        eventCreated: false
      };
    }

    const eventNumber = await getNextEventNumber();

    const newEvent = {
      eventNumber,
      eventDate,
      description: activity + " - " + formatEventDateDescription(eventDate),
      eventType: activity,
      createdAtEpoch: Date.now()
    };

    const result = await eventsCollection.insertOne(newEvent);

    return {
      event: {
        _id: result.insertedId,
        ...newEvent
      },
      eventCreated: true
    };
  }

  async function resolveEventForAttendance(
    activity: string,
    eventDate: string,
    eventNumber?: string
  ) {
    if (activity === "Incident-Call") {
      if (!eventNumber) {
        throw new Error("Please select an incident event.");
      }

      const incidentEvent = await eventsCollection.findOne({
        eventType: "Incident-Call",
        eventNumber
      });

      if (!incidentEvent) {
        throw new Error("Selected incident event could not be found.");
      }

      return {
        event: incidentEvent,
        eventCreated: false
      };
    }

    return findOrCreateNonIncidentEvent(activity, eventDate);
  }

  return {
    getNextEventNumber,
    findOrCreateNonIncidentEvent,
    resolveEventForAttendance
  };
}