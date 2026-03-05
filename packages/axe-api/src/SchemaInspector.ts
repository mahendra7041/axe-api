import Database from "./Database";
import schemaInspector from "knex-schema-inspector";
import { IoCService } from "./Services";
import type { Knex } from "knex";

interface ForeignKey {
  column: string;
  references: {
    schema: string;
    table: string;
    column: string;
  };
}

export interface TableSchema {
  schema: string;
  primaryKey: string | null;
  columns: string[];
  required: string[];
  columnTypes: Record<string, string>;
  foreignKeys: ForeignKey[];
}

type DatabaseSchema = Record<string, TableSchema>;

export default class SchemaInspector {
  private inspector: ReturnType<typeof schemaInspector>;
  private schema: Record<string, TableSchema> = {};

  constructor() {
    const database = IoCService.use<Knex>(Database);
    this.inspector = schemaInspector(database);
    this.load().catch(console.error);
  }

  /**
   * Load database schema
   */
  async load(): Promise<DatabaseSchema> {
    if (this.schema) return this.schema;

    const columns = await this.inspector.columnInfo();
    this.schema = this.buildSchema(columns);

    return this.schema;
  }

  public hasTable(tableName: string): boolean {
    return tableName in this.schema;
  }

  public getTable(tableName: string): TableSchema | undefined {
    return this.schema[tableName];
  }

  /**
   * Build grouped schema
   */
  private buildSchema(columns: any[]): DatabaseSchema {
    const tables: DatabaseSchema = {};

    for (const column of columns) {
      const tableName = column.table;

      if (!tables[tableName]) {
        tables[tableName] = {
          schema: column.schema,
          primaryKey: null,
          columns: [],
          required: [],
          columnTypes: {},
          foreignKeys: [],
        };
      }

      const table = tables[tableName];

      table.columns.push(column.name);

      if (column.is_primary_key) {
        table.primaryKey = column.name;
      }

      if (
        !column.is_nullable &&
        !column.has_auto_increment &&
        !column.default_value
      ) {
        table.required.push(column.name);
      }

      table.columnTypes[column.name] = this.mapType(column.data_type);

      if (column.foreign_key_table) {
        table.foreignKeys.push({
          column: column.name,
          references: {
            schema: column.foreign_key_schema,
            table: column.foreign_key_table,
            column: column.foreign_key_column,
          },
        });
      }
    }

    return tables;
  }

  /**
   * Map DB types → JS types
   */
  private mapType(type: string): string {
    switch (type) {
      case "integer":
      case "double precision":
        return "number";

      case "character varying":
      case "text":
        return "string";

      case "timestamp with time zone":
        return "Date";

      default:
        return "any";
    }
  }
}
