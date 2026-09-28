import { CustomError } from "./errorHandler.js";

// ===== Helper Functions =====

// Convert Mongoose schema type to expected JS type
const getJsType = (mongooseType) => {
  switch (mongooseType) {
    case "String":
      return "string";
    case "Number":
      return "number";
    case "Boolean":
      return "boolean";
    case "ObjectID":
      return "string";
    case "Array":
      return "object"; // typeof [] === 'object'
    default:
      return "string";
  }
};

// Coerce string input to match Mongoose type
const coerceType = (expectedType, value) => {
  if (expectedType === "Boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  if (expectedType === "Number") {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }

  if (expectedType === "Array") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      // keep original value
    }
  }

  return value;
};

// ===== Main Validators =====

export const validateCreateBody = (Model, data) => {
  const schemaPaths = Model.schema.paths;

  for (let key in schemaPaths) {
    if (["_id", "__v"].includes(key)) continue;

    const path = schemaPaths[key];
    const isRequired = path.options.required;
    const expectedType = path.instance;

    if (isRequired && (data[key] === undefined || data[key] === null || data[key] === "")) {
      throw new CustomError(`Missing required field: ${key}`, 400);
    }

    if (data[key] !== undefined) {
      data[key] = coerceType(expectedType, data[key]);
      const actualType = typeof data[key];
      const expectedJsType = getJsType(expectedType);

      if (expectedJsType === "object" && Array.isArray(data[key])) continue;

      if (actualType !== expectedJsType) {
        throw new CustomError(
          `Invalid type for field ${key}. Expected ${expectedJsType}, got ${actualType}`,
          400
        );
      }
    }
  }
};

export const validateUpdateBody = (Model, data) => {
  const schemaPaths = Model.schema.paths;

  for (let key in data) {
    // if (!schemaPaths[key]) {
    //   throw new CustomError(`Invalid field: ${key}`, 400);
    // }

    const expectedType = schemaPaths[key].instance;
    data[key] = coerceType(expectedType, data[key]);
    const actualType = typeof data[key];
    const expectedJsType = getJsType(expectedType);

    if (expectedJsType === "object" && Array.isArray(data[key])) continue;

    if (actualType !== expectedJsType) {
      throw new CustomError(
        `Invalid type for field ${key}. Expected ${expectedJsType}, got ${actualType}`,
        400
      );
    }
  }
};
