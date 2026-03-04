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
  static fastSingleton<T>(target: IoCKey, callback: FactoryCallback<T>) {
    this._add(DependencyTypes.SINGLETON, target, callback);
    const result = this.use<T>(target);
    if (result instanceof Promise) return result;
  }

  /**
   * Getting the service by the class.
   *
   * @param target
   * @example
   *
   * // sync callback
   * const db = IoCService.use<Database>(Database);
   *
   * // async callback
   * const db = await IoCService.use<Database>(Database);
   */
  static use<T>(target: IoCKey): T | Promise<T> {
    return IoCService.getByTarget<T>(target);
  }

  private static getByTarget<T>(target: IoCKey): T | Promise<T> {
    const item = IoCService.items.get(target);
    if (!item) {
      throw new Error(
        `Dependency is not found: ${typeof target === "string" ? target : target.name}`,
      );
    }

    if (item.type === DependencyTypes.BIND) {
      return item.callback() as T | Promise<T>;
    }

    if (item.instance) {
      return item.instance as T;
    }

    const result = item.callback();

    if (result instanceof Promise) {
      return result.then((resolved) => {
        item.instance = resolved;
        return resolved as T;
      });
    }

    item.instance = result;
    return item.instance as T;
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
