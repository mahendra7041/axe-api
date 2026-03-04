import Database from "./Database";
import schemaInspector from "knex-schema-inspector";
import { IoCService } from "./Services";
import type { Knex } from "knex";

export default class SchemaInspector {
  static async create(): Promise<SchemaInspector> {
    const database = await IoCService.use<Knex>(Database);
    return schemaInspector(database);
  }
}
