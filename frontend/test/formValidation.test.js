import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeName,
  validateDescription,
  validateFireZoneNumber,
  validateName,
  validateOtherType,
} from "../src/Utils/formValidation.js";

test("member field validation accepts expected values", () => {
  assert.equal(validateName("Anne-Marie O'Neil"), true);
  assert.equal(validateFireZoneNumber("123456789"), true);
  assert.equal(sanitizeName("  Anne  "), "Anne");
});

test("member field validation rejects malformed values", () => {
  assert.equal(validateName("<script>alert(1)</script>"), false);
  assert.equal(validateFireZoneNumber("1234567890"), false);
  assert.equal(validateFireZoneNumber("12A"), false);
});

test("free-text validation enforces its allowlist and length", () => {
  assert.equal(validateOtherType("Crew 1, local-area."), true);
  assert.equal(validateOtherType("<img src=x onerror=alert(1)>"), false);
  assert.equal(validateDescription("Shed-2, north side"), true);
  assert.equal(validateDescription("Unexpected <markup>"), false);
});
