import knex from "knex";
import { AppLoader } from "./AppLoader";
import { LogService } from "./Services";
import { attachPaginate } from "knex-paginate";

export default class Database {
  static resolve(): knex.Knex {
    const appLoader = AppLoader.getInstance();
    const database = knex(appLoader.map.config.database);
    attachPaginate();

    const client = appLoader.map.config.database.client;
    const connection = appLoader.map.config.database.connection as {
      db?: string;
      filename?: string;
    };
    const { db, filename } = connection;

    LogService.debug(
      `Created a knex connection instance: [${client}:${db || filename}]`,
    );

    return database;
  }
}
