import pluralize from "pluralize";
import { paramCase, camelCase } from "change-case";
import {
  IRelation,
  IRouteData,
  IRouteParentPair,
  IVersion,
  IModelService,
} from "../Interfaces";
import { API_ROUTE_TEMPLATES, HANDLER_METHOD_MAP } from "../constants";
import { HandlerTypes, Relationships } from "../Enums";
import {
  LogService,
  DocumentationService,
  IoCService,
  APIService,
} from "../Services";
import URLService from "../Services/URLService";
import { AxeFunction } from "src/Types";
import App from "../Services/App";
import { VersionEntry, ModelEntry, AppLoader } from "../AppLoader";
import { Relation } from "../Relations";
import Model from "../Model";

class RouterBuilder {
  private versionName: string;
  private versionEntry: VersionEntry;

  constructor(versionName: string, versionEntry: VersionEntry) {
    this.versionName = versionName;
    this.versionEntry = versionEntry;
  }

  async build() {
    const app = await IoCService.use<App>("App");
    const init = this.versionEntry.init;

    if (init?.onBeforeInit) {
      init.onBeforeInit(app);
    }

    await this.createRoutesByModelTree();

    LogService.debug(
      `[${this.versionName}] All endpoints have been created.`,
    );

    if (init?.onAfterInit) {
      init.onAfterInit(app);
    }
  }

  private async createRoutesByModelTree() {
    for (const modelName of this.versionEntry.modelTree) {
      const entry = this.versionEntry.models[modelName];
      if (entry) {
        await this.createRouteByModel(modelName, entry, []);
      }
    }
  }

  private async createRouteByModel(
    modelName: string,
    entry: ModelEntry,
    parentPairs: IRouteParentPair[] = [],
    urlPrefix = "",
    parentModelName: string | null = null,
    parentEntry: ModelEntry | null = null,
    relation: IRelation | null = null,
    allowRecursive = true,
  ) {
    const model: Model = entry.model;

    if (model.ignore) {
      return;
    }

    const resource = this.getResourcePath(modelName, relation);
    // We create and handle routes by not duplicate so many lines.
    for (const handler of Object.keys(API_ROUTE_TEMPLATES)) {
      const handlerType: HandlerTypes = <HandlerTypes>handler;
      if (!model.handlers.includes(handlerType)) {
        continue;
      }

      const urlCreator = API_ROUTE_TEMPLATES[handlerType];
      const url = urlCreator(
        `${await this.getRootPrefix()}/${this.versionName}`,
        urlPrefix,
        resource,
        model.primaryKey,
      );

      // Creating the middleware list for the route. As default, we support some
      // internal middlewares such as `Accept Language Middleware` which parse
      // the "accept-language" header to use in the application general.
      const middlewares: AxeFunction[] = [
        ...model.getMiddlewares(handlerType),
      ];

      // Adding the endpoint
      await this.addRoute(
        handlerType,
        url,
        middlewares,
        modelName,
        entry,
        parentPairs,
        parentModelName,
        parentEntry,
        relation,
      );
    }

    await this.createChildRoutes(
      modelName,
      entry,
      resource,
      urlPrefix,
      parentPairs,
    );
    await this.createNestedRoutes(
      modelName,
      entry,
      allowRecursive,
      urlPrefix,
      resource,
    );
  }

  private async createNestedRoutes(
    modelName: string,
    entry: ModelEntry,
    allowRecursive: boolean,
    urlPrefix: string,
    resource: string,
  ) {
    if (!entry.isRecursive || !allowRecursive) {
      return;
    }

    const model: Model = entry.model;
    const relations = this.getRelationsArray(model);

    // We should different parameter name for child routes
    const relation = relations.find(
      (rel) =>
        rel.model === modelName && rel.type === Relationships.HAS_MANY,
    );

    if (relation) {
      const paramName = camelCase(`${modelName}-${relation.primaryKey}`);
      const parentPair: IRouteParentPair = {
        model: this.toModelService(modelName, entry),
        paramName,
      };
      await this.createRouteByModel(
        modelName,
        entry,
        [parentPair],
        `${urlPrefix}${resource}/:${paramName}/`,
        modelName,
        entry,
        relation,
        false,
      );
    }
  }

  private async createChildRoutes(
    modelName: string,
    entry: ModelEntry,
    resource: string,
    urlPrefix: string,
    parentPairs: IRouteParentPair[],
  ) {
    if (entry.children.length === 0) {
      return;
    }

    const model: Model = entry.model;
    const relations = this.getRelationsArray(model);

    // We should different parameter name for child routes
    const subRelations = relations.filter(
      (item) =>
        item.type === Relationships.HAS_MANY && item.options.autoRouting,
    );
    for (const relation of subRelations) {
      const childName = entry.children.find(
        (name) => name === relation.model,
      );
      // It should be recursive
      if (childName) {
        const childEntry = this.versionEntry.models[childName];
        if (!childEntry) continue;

        const paramName = camelCase(`${modelName}-${relation.primaryKey}`);
        // Setting the new parent pair depth
        const parentPair: IRouteParentPair = {
          model: this.toModelService(modelName, entry),
          paramName,
        };
        await this.createRouteByModel(
          childName,
          childEntry,
          [...parentPairs, parentPair],
          `${urlPrefix}${resource}/:${paramName}/`,
          modelName,
          entry,
          relation,
        );
      }
    }
  }

  private async addRoute(
    handlerType: HandlerTypes,
    url: string,
    middlewares: AxeFunction[],
    modelName: string,
    entry: ModelEntry,
    parentPairs: IRouteParentPair[],
    parentModelName: string | null,
    parentEntry: ModelEntry | null,
    relation: IRelation | null,
  ) {
    const docs = DocumentationService.getInstance();

    const modelService = this.toModelService(modelName, entry);
    const parentModelService = parentModelName && parentEntry
      ? this.toModelService(parentModelName, parentEntry)
      : null;

    const data: IRouteData = {
      version: this.toVersion(),
      handlerType,
      model: modelService,
      parentModel: parentModelService,
      relation,
    };

    // Adding the route
    await URLService.add(
      HANDLER_METHOD_MAP[handlerType],
      url,
      data,
      middlewares,
      parentPairs,
    );

    // Documentation
    docs.push(
      this.toVersion(),
      handlerType,
      HANDLER_METHOD_MAP[handlerType],
      url,
      modelService,
      parentModelService,
    );
  }

  private getResourcePath(modelName: string, relation: IRelation | null) {
    return relation
      ? paramCase(relation.name)
      : paramCase(pluralize.plural(modelName)).toLowerCase();
  }

  private getRootPrefix = async (): Promise<string> => {
    const appLoader = AppLoader.getInstance();
    let prefix = appLoader.map.config.prefix;

    if (prefix.startsWith("/")) {
      prefix = prefix.substring(1);
    }

    if (prefix.endsWith("/")) {
      prefix = prefix.substring(0, prefix.length - 1);
    }

    return prefix;
  };

  /**
   * Convert a Model's getRelations() output into the IRelation[] format
   * expected by downstream consumers.
   */
  private getRelationsArray(model: Model): IRelation[] {
    const relationsMap: Record<string, Relation> = model.getRelations();
    return Object.entries(relationsMap).map(([name, relation]) => ({
      name,
      type: relation.type,
      model: relation.modelName,
      primaryKey: relation.primaryKey ?? model.primaryKey,
      foreignKey: relation.foreignKey ?? model.foreignKey,
      options: (relation as any).options ?? { autoRouting: true },
    }));
  }

  /**
   * Create a minimal IVersion-compatible object for downstream services
   * (TransactionResolver, DocumentationService, etc.) that still expect IVersion.
   */
  private toVersion(): IVersion {
    return {
      name: this.versionName,
      config: this.versionEntry.config,
    } as IVersion;
  }

  /**
   * Create a minimal IModelService-compatible object for downstream services
   * (URLService, DocumentationService, etc.) that still expect IModelService.
   */
  private toModelService(modelName: string, entry: ModelEntry): IModelService {
    const model: Model = entry.model;
    return {
      name: modelName,
      instance: model,
      relations: this.getRelationsArray(model),
      columns: [],
      columnNames: [],
      hooks: {} as IModelService["hooks"],
      events: {} as IModelService["events"],
      isRecursive: entry.isRecursive,
      children: entry.children.map((childName) => {
        const childEntry = this.versionEntry.models[childName];
        if (!childEntry) {
          return { name: childName } as IModelService;
        }
        return this.toModelService(childName, childEntry);
      }),
      queryLimits: [],
      serialize: null,
      setColumns: () => {},
      setExtensions: () => {},
      setQueryLimits: () => {},
      setSerialization: () => {},
      setCacheConfiguration: () => {},
      getCacheConfiguration: () => null,
      setAsRecursive: () => {
        entry.isRecursive = true;
      },
    };
  }
}

export default RouterBuilder;
