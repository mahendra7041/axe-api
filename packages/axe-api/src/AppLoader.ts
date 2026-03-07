import fs from "fs/promises";
import path from "path";
import { DEFAULT_APP_CONFIG, DEFAULT_VERSION_CONFIG } from "./constants";
import { AxeConfig, AxeVersionConfig } from "./Interfaces";
import Model from "./Model";

type LifecycleMethod = (...args: any[]) => any;

const LIFECYCLE_HOOKS = [
  "onBeforeInsert",
  "onBeforeUpdateQuery",
  "onBeforeUpdate",
  "onBeforePatchQuery",
  "onBeforePatch",
  "onBeforeDeleteQuery",
  "onBeforeDelete",
  "onBeforeForceDeleteQuery",
  "onBeforeForceDelete",
  "onBeforePaginate",
  "onBeforeSearch",
  "onBeforeAll",
  "onBeforeShow",
  "onAfterInsert",
  "onAfterUpdateQuery",
  "onAfterUpdate",
  "onAfterPatchQuery",
  "onAfterPatch",
  "onAfterDeleteQuery",
  "onAfterDelete",
  "onAfterForceDeleteQuery",
  "onAfterForceDelete",
  "onAfterPaginate",
  "onAfterSearch",
  "onAfterAll",
  "onAfterShow",
] as const;

type LifecycleHookName = (typeof LIFECYCLE_HOOKS)[number];
type LifecycleMap = Partial<Record<LifecycleHookName, LifecycleMethod>>;

interface InitModule {
  onBeforeInit?: LifecycleMethod;
  onAfterInit?: LifecycleMethod;
}

export interface ModelEntry {
  model: any;
  serialization: any | null;
  hooks: LifecycleMap;
  events: LifecycleMap;
  children: string[];
  isRecursive: boolean;
}

export interface VersionEntry {
  config: any | null;
  init: InitModule;
  models: Record<string, ModelEntry>;
  modelTree: string[];
}

export interface AppMap {
  rootFolder: string;
  config: any;
  versions: Record<string, VersionEntry>;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFile(dir: string, name: string): Promise<string | null> {
  for (const ext of [".ts", ".js"]) {
    const full = path.join(dir, name + ext);
    if (await exists(full)) return full;
  }
  return null;
}

async function safeImport(filePath: string | null): Promise<any> {
  if (!filePath) return null;
  try {
    return await import(filePath);
  } catch {
    return null;
  }
}

function defaultExport(mod: any): any {
  return mod?.default ?? null;
}

export class AppLoader {
  private static instance: AppLoader | null = null;
  public map: AppMap = {
    rootFolder: "",
    config: { ...DEFAULT_APP_CONFIG },
    versions: {},
  };

  private constructor() {}

  static getInstance(): AppLoader {
    if (!AppLoader.instance) {
      AppLoader.instance = new AppLoader();
    }
    return AppLoader.instance;
  }

  async resolve(rootPath: string): Promise<AppMap> {
    const absRoot = path.resolve(rootPath);
    const entries = await fs.readdir(absRoot, { withFileTypes: true });

    const rootConfigPath = await resolveFile(absRoot, "config");
    const rootConfigMod = await safeImport(rootConfigPath);
    const map: AppMap = {
      rootFolder: absRoot,
      config: { ...DEFAULT_APP_CONFIG, ...defaultExport(rootConfigMod) },
      versions: {},
    };

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const hasConfig = await resolveFile(path.join(absRoot, e.name), "config");
      if (hasConfig)
        map.versions[e.name] = await this.resolveVersion(
          path.join(absRoot, e.name),
        );
    }

    this.map = map;
    return map;
  }

  getModel(version: string, modelName: string): ModelEntry | null {
    return this.map.versions?.[version]?.models?.[modelName] ?? null;
  }

  getHook(
    version: string,
    modelName: string,
    hookName: LifecycleHookName,
  ): LifecycleMethod | undefined {
    return this.map.versions?.[version]?.models?.[modelName]?.hooks?.[hookName];
  }

  getEvent(
    version: string,
    modelName: string,
    eventName: LifecycleHookName,
  ): LifecycleMethod | undefined {
    return this.map.versions?.[version]?.models?.[modelName]?.events?.[
      eventName
    ];
  }

  getInit(version: string): InitModule | undefined {
    return this.map.versions?.[version]?.init;
  }

  getConfig(): AxeConfig {
    return this.map?.config;
  }

  getVersionConfig(version: string): AxeVersionConfig {
    return this.map.versions?.[version]?.config;
  }

  private async resolveVersion(vPath: string): Promise<VersionEntry> {
    const configPath = await resolveFile(vPath, "config");
    const configMod = await safeImport(configPath);

    const initPath = await resolveFile(vPath, "init");
    const initMod = await safeImport(initPath);
    const init: InitModule = {};
    if (typeof initMod?.onBeforeInit === "function")
      init.onBeforeInit = initMod.onBeforeInit;
    if (typeof initMod?.onAfterInit === "function")
      init.onAfterInit = initMod.onAfterInit;

    const modelsDir = path.join(vPath, "Models");
    const models = await this.resolveModels(vPath, modelsDir);

    return {
      config: { ...DEFAULT_VERSION_CONFIG, ...defaultExport(configMod) },
      init,
      models,
      modelTree: [],
    };
  }

  private async resolveModels(
    vPath: string,
    modelsDir: string,
  ): Promise<Record<string, ModelEntry>> {
    const result: Record<string, ModelEntry> = {};

    if (!(await exists(modelsDir))) return result;

    const files = await fs.readdir(modelsDir, { withFileTypes: true });

    for (const f of files) {
      if (!f.isFile()) continue;

      const ext = path.extname(f.name);
      if (ext !== ".ts" && ext !== ".js") continue;
      const modelName = path.basename(f.name, ext);

      if (result[modelName]) continue;

      result[modelName] = await this.resolveModelEntry(
        vPath,
        modelsDir,
        modelName,
      );
    }

    return result;
  }

  private async resolveModelEntry(
    vPath: string,
    modelsDir: string,
    modelName: string,
  ): Promise<ModelEntry> {
    const modelPath = await resolveFile(modelsDir, modelName);
    const modelMod = await safeImport(modelPath);
    const serializationDir = path.join(vPath, "Serialization");
    const serPath = await resolveFile(serializationDir, modelName);
    const serMod = await safeImport(serPath);
    const hooks = await this.resolveLifecycleMap(vPath, "Hooks", modelName);
    const events = await this.resolveLifecycleMap(vPath, "Events", modelName);

    return {
      model: defaultExport(modelMod),
      serialization: defaultExport(serMod),
      hooks,
      events,
      children: [],
      isRecursive: false,
    };
  }

  private async resolveLifecycleMap(
    vPath: string,
    folder: "Hooks" | "Events",
    modelName: string,
  ): Promise<LifecycleMap> {
    const lifecycleMap: LifecycleMap = {};
    const folderPath = path.join(vPath, folder);
    const modelFolderPath = path.join(folderPath, modelName);

    const indexPath = await resolveFile(folderPath, "index");
    const indexMod = await safeImport(indexPath);
    if (indexMod) {
      for (const key of LIFECYCLE_HOOKS) {
        if (typeof indexMod[key] === "function") {
          lifecycleMap[key] = indexMod[key];
        }
      }
    }

    if (await exists(modelFolderPath)) {
      for (const key of LIFECYCLE_HOOKS) {
        const filePath = await resolveFile(modelFolderPath, key);
        if (filePath) {
          const mod = await safeImport(filePath);
          const fn = defaultExport(mod);
          if (typeof fn === "function") {
            lifecycleMap[key] = fn;
          }
        }
      }
    }

    return lifecycleMap;
  }
}
