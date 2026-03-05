import Model from "./Model";
import { TableSchema } from "./SchemaInspector";
import { ModelValidation } from "./Types";

export class ModelValidator {
  static validate(model: Model, schema: TableSchema) {
    if (!schema) {
      throw new Error(
        `Table "${model.table}" does not exist in database schema`,
      );
    }

    const fillableFields = this.getFillableFields(model);

    this.validatePrimaryKey(model, schema);
    this.validateRequiredFields(model, schema, fillableFields);
    this.validateFillableFields(model, schema, fillableFields);
    this.validateHiddenFields(model, schema);
    this.validateSearchFields(model, schema);
    this.validateTimestampColumns(model, schema);
  }

  /**
   * Get all fillable fields (array or method based)
   */
  static getFillableFields(model: Model): string[] {
    const fillable = model.fillable;

    if (!fillable) return [];

    if (Array.isArray(fillable)) {
      return fillable;
    }

    return [...new Set(Object.values(fillable).flat())];
  }

  /**
   * Fillable fields must exist in DB
   */
  private static validateFillableFields(
    model: Model,
    schema: TableSchema,
    fillable: string[],
  ) {
    for (const field of fillable) {
      if (!schema.columns.includes(field)) {
        throw new Error(
          `Model "${model.constructor.name}" has invalid fillable field "${field}". ` +
            `Column does not exist in table "${schema.schema}.${model.table}".`,
        );
      }
    }
  }

  /**
   * Required DB fields missing in fillable → warning
   */
  private static validateRequiredFields(
    model: Model,
    schema: TableSchema,
    fillable: string[],
  ) {
    for (const field of schema.required) {
      if (!fillable.includes(field)) {
        console.warn(
          `Model "${model.constructor.name}" is missing required field "${field}" in fillable.`,
        );
      }
    }
  }

  /**
   * Hidden fields must exist in DB
   */
  private static validateHiddenFields(model: Model, schema: TableSchema) {
    for (const field of model.hiddens) {
      if (!schema.columns.includes(field)) {
        throw new Error(
          `Hidden field "${field}" does not exist in table "${schema.schema}.${model.table}"`,
        );
      }
    }
  }

  /**
   * Extract validation rule fields
   */
  private static getValidationFields(
    validations: ModelValidation | any,
  ): string[] {
    if (!validations) return [];

    const keys = Object.keys(validations);

    const HTTP_METHODS = new Set(["POST", "PUT", "PATCH"]);

    if (!keys.some((k) => HTTP_METHODS.has(k))) {
      return keys;
    }

    const fields = new Set<string>();

    for (const methodRules of Object.values(validations)) {
      for (const field of Object.keys(methodRules || {})) {
        fields.add(field);
      }
    }

    return [...fields];
  }

  /**
   * Search fields must exist in DB
   */
  private static validateSearchFields(model: Model, schema: TableSchema) {
    if (!model.search) return;

    for (const field of model.search) {
      if (!schema.columns.includes(field)) {
        throw new Error(
          `Search field "${field}" does not exist in table "${schema.schema}.${model.table}"`,
        );
      }
    }
  }

  /**
   * Timestamp columns must exist
   */
  private static validateTimestampColumns(model: Model, schema: TableSchema) {
    const timestamps = [
      model.createdAtColumn,
      model.updatedAtColumn,
      model.deletedAtColumn,
    ];

    for (const column of timestamps) {
      if (!column) continue;

      if (!schema.columns.includes(column)) {
        throw new Error(
          `Timestamp column "${column}" does not exist in table "${schema.schema}.${model.table}"`,
        );
      }
    }
  }

  /**
   * Validate primary key
   */
  private static validatePrimaryKey(model: Model, schema: TableSchema) {
    if (!schema.primaryKey) return;

    if (model.primaryKey !== schema.primaryKey) {
      console.warn(
        `Model "${model.constructor.name}" primaryKey "${model.primaryKey}" does not match database primary key "${schema.primaryKey}"`,
      );
    }
  }
}
