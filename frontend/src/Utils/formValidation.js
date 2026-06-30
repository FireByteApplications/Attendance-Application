// utils/formValidation.js

export const validateName = (value) => 
  /^[a-zA-Z-'\s]{1,50}$/.test(value);

export const validateSelections = (value) => 
  /^[a-zA-Z\s-\(\)]{1,25}$/.test(value);

export const validateFireZoneNumber = (value) => 
  /^\d{1,9}$/.test(value);

export const validateOtherType = (value) => 
  /^[a-zA-Z0-9\s\.,\-\']{1,50}$/.test(value);

export const sanitizeName = (name) =>
  name.trim();

export const validateDateDMY = (value) =>
  /^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/.test(value);

export const validateIncidentID = (value) =>
  /^\d{2}-\d{1,8}$/.test(value);

export const validateDescription = (value) =>
  /^[A-Za-z0-9\s]+$/.test(value);

export const validateEventNumber = (value) =>
  /^EVT-\d{5}$/.test(value);

const allowedActivities = [
  "Incident-Call",
  "Strike-Team",
  "Deployment",
  "Hazard-Reduction",
  "Pile-Burn",
  "Training",
  "Maintenance",
  "BA-Checks",
  "Chainsaw-Checks",
  "Other-operational",
];

const allowedDeploymentTypes = ["Bushfire", "Flood"];
const allowedDeploymentLocations = ["Local", "Out of area"];
const allowedBATypes = ["Cat 1", "Pumper", "All Vehicles"];
const allowedChainsawTypes = ["Cat 1", "Pumper", "Cat 9", "All Vehicles"];

export function validateOperationalAttendanceData(data) {
  const errors = [];

  const nameRegex = /^[a-zA-Z-'\s]{1,50}$/;
  const otherTypeRegex = /^[a-zA-Z0-9\s\.,\-\']{1,50}$/;
  const eventNumber = String(data.eventNumber ?? "").trim();
  const eventRequiredActivities = [
  "Incident-Call",
  "Pile-Burn",
  "Hazard-Reduction",
  "Deployment",
  "Strike-Team",
  "Training",
  "Community-Engagement"
  ];
  const requiresEvent = eventRequiredActivities.includes(data.activity);

  if (!data || typeof data !== "object") {
    return ["Invalid form data."];
  }

  // name
  if (typeof data.name !== "string" || data.name.trim() === "") {
    errors.push("Name is required.");
  } else if (data.name.trim().length > 100) {
    errors.push("Name must be 100 characters or less.");
  } else if (!nameRegex.test(data.name.trim())) {
    errors.push("Name can only contain letters, spaces, and hyphens.");
  }

  // activity
  if (typeof data.activity !== "string" || data.activity.trim() === "") {
    errors.push("Activity is required.");
  } else if (!allowedActivities.includes(data.activity)) {
    errors.push("Invalid activity selected.");
  }
  if (data.activity === "Incident-Call") {
    if (eventNumber === "") {
      errors.push(
        "Incident calls must have an incident number attached. Please create or select an incident for this attendance."
      );
    } else if (!validateIncidentID(eventNumber)) {
      errors.push("Incident ID must be in format 26-12345678.");
    }
  }
  if (data.activity !== 'Incident-Call' && eventNumber !== "") {
  errors.push(`${data.activity} should not have an event number attached.`);
  } 

  // epochTimestamp
  if (
    typeof data.epochTimestamp !== "number" ||
    !Number.isInteger(data.epochTimestamp)
  ) {
    errors.push("Timestamp must be a valid number.");
  } else {
    const minTimestamp = new Date("2023-01-01T00:00:00").getTime();
    const maxTimestamp = new Date("2100-12-31T23:59:59").getTime();

    if (data.epochTimestamp < minTimestamp || data.epochTimestamp > maxTimestamp) {
      errors.push("Timestamp is outside the valid date range.");
    }
  }

  // Deployment fields
  if (data.activity === "Deployment") {
    if (!allowedDeploymentTypes.includes(data.deploymentType)) {
      errors.push("Deployment type must be Bushfire or Flood.");
    }

    if (!allowedDeploymentLocations.includes(data.deploymentLocation)) {
      errors.push("Deployment location must be Local or Out of area.");
    }
  }

  // BA checks
  if (data.activity === "BA-Checks") {
    if (!allowedBATypes.includes(data.baType)) {
      errors.push("BA type must be Cat 1, Pumper, or All Vehicles.");
    }
  }

  // Chainsaw checks
  if (data.activity === "Chainsaw-Checks") {
    if (!allowedChainsawTypes.includes(data.chainsawType)) {
      errors.push("Chainsaw type must be Cat 1, Pumper, Cat 9, or All Vehicles.");
    }
  }

  // Other operational
  if (data.activity === "Other-operational") {
    if (typeof data.otherType !== "string" || data.otherType.trim() === "") {
      errors.push("Other type is required.");
    } else if (!otherTypeRegex.test(data.otherType.trim())) {
      errors.push("Other type can only contain letters and numbers.");
    }
  }

  return errors;
}
export const validateUserForm = (formData) => {
  const errors = [];

  if (formData.honeypot) {
    errors.push("Bot detection failed.");
  }

  if (!validateName(formData.firstName)) {
    errors.push("First name must contain only letters, spaces, or hyphens.");
  }

  if (!validateName(formData.lastName)) {
    errors.push("Last name must contain only letters, spaces, or hyphens.");
  }

  if (!validateFireZoneNumber(formData.fireZoneNumber)) {
    errors.push("Fire zone number must contain digits 0-9 only.");
  }

  if (
    !validateSelections(formData.Status) ||
    !validateSelections(formData.Classification) ||
    !validateSelections(formData.Type)
  ) {
    errors.push("Dropdowns must contain only letters, spaces, hyphens, or parentheses.");
  }

  return errors;
};
export const validateIncidentCreationForm = (formdata) => {
  console.log(formdata)
  const errors = [];
  if (!validateDateDMY(formdata.Date)) {
    errors.push("Date format invalid. Format required: DD/MM/YYY")
  }
  if (!validateIncidentID(formdata.ActivID)) {
    errors.push("Activ Incident id must be in format 26-12345678")
  }
  if (!validateDescription(formdata.IncidentDescription)) {
    errors.push("Description can only contain letters and numbers")
  }
  return errors;
}
