import { DependencyTypes } from "../Enums";
import { IDependency } from "../Interfaces";

type ClassConstructor<T = any> = new (...args: any[]) => T;
type IoCKey = ClassConstructor | string;

type SyncFactory<T> = () => T;
type AsyncFactory<T> = () => Promise<T>;
type Factory<T> = SyncFactory<T> | AsyncFactory<T>;

class IoCService {
  private static items: Map<IoCKey, IDependency> = new Map();

  /**
   * Register a transient dependency
   */
  static bind<T>(target: IoCKey, factory: Factory<T>) {
    this.add(DependencyTypes.BIND, target, factory);
  }

  /**
   * Register a singleton dependency
   */
  static singleton<T>(target: IoCKey, factory: Factory<T>) {
    this.add(DependencyTypes.SINGLETON, target, factory);
  }

  /**
   * Register and immediately create singleton
   */
  static async fastSingleton<T>(target: IoCKey, factory: Factory<T>) {
    this.add(DependencyTypes.SINGLETON, target, factory);
    await this.useAsync<T>(target);
  }

  /**
   * Resolve synchronous dependency
   */
  static use<T>(target: IoCKey): T {
    const result = this.resolve(target);

    if (result instanceof Promise) {
      throw new Error(
        `Dependency "${this.getName(target)}" is async. Use IoCService.useAsync().`,
      );
    }

    return result as T;
  }

  /**
   * Resolve async dependency
   */
  static async useAsync<T>(target: IoCKey): Promise<T> {
    const result = this.resolve(target);
    return await result;
  }

  /**
   * Core resolver
   */
  private static resolve<T>(target: IoCKey): T | Promise<T> {
    const dependency = this.items.get(target);

    if (!dependency) {
      throw new Error(`Dependency not found: ${this.getName(target)}`);
    }

    // Transient dependency
    if (dependency.type === DependencyTypes.BIND) {
      return dependency.factory();
    }

    // Return cached singleton
    if (dependency.instance !== undefined) {
      return dependency.instance;
    }

    const result = dependency.factory();

    // Handle async singleton
    if (result instanceof Promise) {
      return result.then((resolved) => {
        dependency.instance = resolved;
        return resolved;
      });
    }

    dependency.instance = result;
    return result;
  }

  /**
   * Add dependency
   */
  private static add<T>(
    type: DependencyTypes,
    target: IoCKey,
    factory: Factory<T>,
  ) {
    this.items.set(target, {
      type,
      factory,
      instance: undefined,
    });
  }

  /**
   * Get readable name
   */
  private static getName(target: IoCKey) {
    return typeof target === "string" ? target : target.name;
  }
}

export default IoCService;
