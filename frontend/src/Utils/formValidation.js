// utils/formValidation.js

export const validateName = (value) => 
  /^[a-zA-Z\s-]+$/.test(value);

export const validateSelections = (value) => 
  /^[a-zA-Z\s-()]+$/.test(value);

export const validateFireZoneNumber = (value) => 
  /^[1-9]+$/.test(value);

export const validateOtherType = (value) => 
  /^[a-zA-Z\s.,']+$/.test(value);

export const sanitizeName = (name) =>
  name.trim();

export const validateDateDMY = (value) =>
  /^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/.test(value);

export const validateIncidentID = (value) =>
  /^\d{2}-\d{1,8}$/.test(value);

export const validateDescription = (value) =>
  /^[A-Za-z0-9]+$/.test(value);

// Validate full form before submission
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
    errors.push("Fire zone number must contain digits 1-9 only.");
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