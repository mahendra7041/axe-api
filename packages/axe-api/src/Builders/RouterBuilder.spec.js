import { describe, it, expect, vi, beforeEach } from "vitest";
import RouterBuilder from "./RouterBuilder";
import { HandlerTypes } from "../Enums";
import { API_ROUTE_TEMPLATES } from "../constants";
import { LogService, IoCService, DocumentationService } from "../Services";
import URLService from "../Services/URLService";

vi.mock("../Services", () => ({
  LogService: {
    debug: vi.fn(),
  },
  IoCService: {
    use: vi.fn(),
  },
  DocumentationService: {
    getInstance: vi.fn().mockReturnValue({
      push: vi.fn(),
    }),
  },
  APIService: {
    getInstance: vi.fn().mockReturnValue({
      config: { prefix: "/api/v1/" },
    }),
  },
}));

vi.mock("../Services/URLService", () => ({
  default: {
    add: vi.fn(),
  },
}));

const createModelInstance = ({
  name,
  handlers = [],
  ignore = false,
  relations = {},
}) => ({
  name,
  ignore,
  primaryKey: "id",
  foreignKey: `${name.toLowerCase()}_id`,
  handlers,
  getMiddlewares: () => [],
  getRelations: () => relations,
});

const createModelEntry = (modelInstance, { children = [], isRecursive = false } = {}) => ({
  model: modelInstance,
  serialization: null,
  hooks: {},
  events: {},
  children,
  isRecursive,
});

const createVersionEntry = (modelsMap, modelTree = []) => ({
  config: null,
  init: { onBeforeInit: null, onAfterInit: null },
  models: modelsMap,
  modelTree,
});

describe("RouterBuilder", () => {
  let versionEntry;
  let builder;

  beforeEach(() => {
    URLService.add.mockClear();
    DocumentationService.getInstance().push.mockClear();
    LogService.debug.mockClear();
    IoCService.use.mockResolvedValue({}); // Mock App service
  });

  it("builds routes for models with appropriate handlers", async () => {
    const handlers = Object.keys(API_ROUTE_TEMPLATES);
    const modelInstance = createModelInstance({ name: "Post", handlers });
    const entry = createModelEntry(modelInstance);

    versionEntry = createVersionEntry({ Post: entry }, ["Post"]);
    builder = new RouterBuilder("v1", versionEntry);

    await builder.build();

    expect(LogService.debug).toHaveBeenCalledWith(
      "[v1] All endpoints have been created.",
    );
    expect(URLService.add).toHaveBeenCalledTimes(handlers.length);
  });

  it("skips models marked with ignore", async () => {
    const modelInstance = createModelInstance({
      name: "SecretModel",
      ignore: true,
      handlers: [HandlerTypes.GET],
    });
    const entry = createModelEntry(modelInstance);

    versionEntry = createVersionEntry({ SecretModel: entry }, ["SecretModel"]);
    builder = new RouterBuilder("v1", versionEntry);

    await builder.build();

    expect(URLService.add).not.toHaveBeenCalled();
  });
});
