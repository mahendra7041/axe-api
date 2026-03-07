import path from "path";
import { AxeConfig, IAPI, IVersion } from "../Interfaces";
import { AppLoader } from "../AppLoader";

class APIService {
  private static instance: APIService;

  constructor(rootFolder: string) {
    // This constructor is kept for backward compatibility if anyone calls it,
    // but the singleton should be used.
  }

  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService("");
    }
    return APIService.instance;
  }

  static setInstance(rootFolder: string) {
    if (!APIService.instance) {
      APIService.instance = new APIService(rootFolder);
    }
  }

  get rootFolder() {
    return AppLoader.getInstance().map.config.rootFolder;
  }

  get appFolder() {
    return path.join(this.rootFolder, "app");
  }

  get versions(): IVersion[] {
    const appLoader = AppLoader.getInstance();
    return Object.keys(appLoader.map.versions).map((name) => {
      const versionEntry = appLoader.map.versions[name];
      const root = path.join(this.appFolder, name);
      return {
        name,
        config: versionEntry.config,
        folders: {
          root,
          config: path.join(root, "Config"),
          events: path.join(root, "Events"),
          hooks: path.join(root, "Hooks"),
          middlewares: path.join(root, "Middlewares"),
          models: path.join(root, "Models"),
          serialization: path.join(root, "Serialization"),
        },
        modelTree: [],
        modelList: null,
      } as unknown as IVersion;
    });
  }

  get config(): AxeConfig {
    return AppLoader.getInstance().map.config;
  }

  setConfig(config: AxeConfig) {
    AppLoader.getInstance().map.config = config;
  }

  addVersion(name: string) {
    // This is now handled by AppLoader, but we keep it as a no-op or
    // we could potentially trigger a reload.
  }

  getVersion(name: string): IVersion {
    const version = this.versions.find((i) => i.name === name);
    if (!version) {
      throw new Error(`Undefined version: ${name}`);
    }

    return version;
  }
}

export default APIService;
