import { DependencyTypes } from "../Enums";
import { IDependency } from "../Interfaces";

type ClassConstructor = new (...args: any[]) => any;
type IoCKey = ClassConstructor | string;
type FactoryCallback<T = any> = () => T | Promise<T>;

class IoCService {
  private static items: Map<IoCKey, IDependency> = new Map();

  /**
   * Adding a dependency creator function.
   *
   * @param target
   * @param callback
   * @example
   *
   * IoCService.bind(MailService, () => new MyMailService())
   */
  static bind<T>(target: IoCKey, callback: FactoryCallback<T>) {
    this._add(DependencyTypes.BIND, target, callback);
  }

  /**
   * Adding a singleton dependency creator function.
   *
   * @param target
   * @param callback
   * @example
   *
   * IoCService.singleton(MySingleton, () => new MySingleton())
   */
  static singleton<T>(target: IoCKey, callback: FactoryCallback<T>) {
    this._add(DependencyTypes.SINGLETON, target, callback);
  }

  /**
   * Adding a singleton dependency and create the first instance immediately.
   *
   * @param target
   * @param callback
   * @example
   *
   * IoCService.fastSingleton(MySingleton, () => new MySingleton())
   */
  static async fastSingleton<T>(target: IoCKey, callback: FactoryCallback<T>) {
    this._add(DependencyTypes.SINGLETON, target, callback);
    await this.use(target);
  }

  /**
   * Getting the service by the class.
   *
   * @param target
   * @example
   *
   * await IoCService.use<MySingleton>(MySingleton)
   */
  static async use<T>(target: IoCKey): Promise<T> {
    const result = await IoCService.getByTarget(target);
    return result as T;
  }

  private static async getByTarget(target: IoCKey): Promise<any> {
    const item = IoCService.items.get(target);
    if (!item) {
      throw new Error(
        `Dependency is not found: ${typeof target === "string" ? target : target.name}`,
      );
    }

    if (item.type === DependencyTypes.BIND) {
      return await item.callback();
    }

    if (item.instance) {
      return item.instance;
    }

    item.instance = await item.callback();
    return item.instance;
  }

  private static _add(
    type: DependencyTypes,
    target: IoCKey,
    callback: FactoryCallback,
  ) {
    IoCService.items.set(target, {
      type,
      callback,
      instance: undefined,
    });
  }
}

export default IoCService;
