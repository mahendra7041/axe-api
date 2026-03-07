import dotenv from "dotenv";
import { LogService, IoCService } from "./Services";
import SwaggerHandler from "./Handlers/SwaggerHandler";
import DocsHandler from "./Handlers/DocsHandler";
import RoutesHandler from "./Handlers/RoutesHandler";
import http from "http";
import RequestHandler from "./Handlers/RequestHandler";
import App from "./Services/App";
import RedisAdaptor from "./Middlewares/RateLimit/RedisAdaptor";
import RateLimitMiddleware from "./Middlewares/RateLimit";
import ElasticService from "./Services/ElasticService";
import ValidatorFactory from "./Validators/ValidatorFactory";
import Database from "./Database";
import SchemaInspector from "./SchemaInspector";
import { AppLoader } from "./AppLoader";

class Server {
  /**
   * Start the application with the rootFolder.
   *
   * @param rootFolder
   */
  async start(rootFolder: string) {
    dotenv.config();

    try {
      const appLoader = AppLoader.getInstance();
      await appLoader.resolve(rootFolder + "/app");
      LogService.setInstance(appLoader.map?.config?.pino);
      this.bindDependencies();
      console.dir(appLoader.map, { depth: null });
      this.listen();
    } catch (error: any) {
      if (error.type === "AxeError") {
        LogService.error(error);
      } else {
        throw error;
      }
    }
  }

  private bindDependencies() {
    IoCService.singleton("App", () => new App());
    IoCService.singleton("Database", () => Database.resolve());
    IoCService.singleton("SchemaInspector", () => new SchemaInspector());
    IoCService.singleton("Redis", () => new RedisAdaptor());
    IoCService.singleton("ElasticService", () => new ElasticService());
    IoCService.fastSingleton("ValidatorFactory", () =>
      ValidatorFactory.resolve(),
    );
  }

  // private async analyzeVersions() {
  // const api = APIService.getInstance();
  // await new VersionResolver().resolve();
  // for (const version of api.versions) {
  // await new ModelResolver(version).resolve();
  // await new SchemaValidatorService(version).validate();
  // await new ModelTreeBuilder(version).build();
  // await new IndexBuilder(version).build();
  // await new RouterBuilder(version).build();
  // }
  // }

  private listen() {
    const app = IoCService.use<App>("App");
    const config = AppLoader.getInstance().getConfig();

    if (config.rateLimit?.enabled) {
      LogService.debug("New middleware: rateLimit()");
      app.use(RateLimitMiddleware);
    }

    app.use(RequestHandler);
    app.use(config.errorHandler);

    const server = http.createServer(app.instance);

    server.on("error", function (e) {
      LogService.error(e.message);
    });

    if (config.docs) {
      app.get("/swagger", SwaggerHandler);
      app.get("/docs", DocsHandler);
      app.get("/routes", RoutesHandler);
    }

    const hostname = config.hostname || "localhost";
    server.listen(config.port, hostname);

    LogService.axe(
      `Axe API listens requests on http://${hostname}:${config.port}`,
    );
  }
}

export default Server;
