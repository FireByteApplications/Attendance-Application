// utils/formValidation.js

export const validateName = (value) => /^[a-zA-Z\s-]+$/.test(value);
export const validateSelections = (value) => /^[a-zA-Z\s-()]+$/.test(value);
export const validateFireZoneNumber = (value) => /^[1-9]+$/.test(value);

export const sanitizeName = (name) => name.trim();

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
