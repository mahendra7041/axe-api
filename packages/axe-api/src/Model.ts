import pluralize from "pluralize";
import { snakeCase } from "snake-case";
import {
  IRelation,
  IMethodBaseConfig,
  IQueryLimitConfig,
  IHandlerBasedTransactionConfig,
  ICacheConfiguration,
  IHandlerBasedCacheConfig,
  IElasticSearchParameters,
  IHasManyOptions,
} from "./Interfaces";
import { Relationships, HandlerTypes, HttpMethods } from "./Enums";
import { DEFAULT_HANDLERS, RESERVED_MODEL_MEMBERS } from "./constants";
import { ModelMiddleware, AxeFunction, ModelValidation } from "./Types";
import { getParentIndexQuery } from "./Handlers/Helpers";
import { BelongsTo, HasMany, HasOne } from "./Relations";
import { IoCService } from "./Services";
class Model {
  private _table?: string;
  private _foreignKey?: string;
  private _relations?: Record<string, IRelation>;
  /**
   * The primary key of the model. By default, it is `id`. But you can choose
   * another name like `uuid`.
   *
   * @example
   *  get primaryKey() {
   *    return "id"
   *  }
   * @type {string}
   * @tutorial https://axe-api.com/reference/model-primary-key.html
   */
  get primaryKey(): string {
    return "id";
  }

  get foreignKey(): string {
    if (!this._foreignKey) {
      this._foreignKey = `${snakeCase(pluralize.singular(this.table))}_id`;
    }
    return this._foreignKey;
  }

  /**
   * The database table name of the model. By default, Axe API uses the plural
   * version of the model(`User.ts` => `users`) name. You can specify a custom
   * name like `my_users`.
   *
   * @example
   *  get table() {
   *    return "my_users_table"
   *  }
   * @type {string}
   * @tutorial https://axe-api.com/reference/model-table.html
   */

  get table(): string {
    if (!this._table) {
      this._table = pluralize(snakeCase(this.constructor.name));
    }
    return this._table;
  }

  /**
   * By this method, you can define which fields can be filled by the HTTP client.
   * If you do not define, the HTTP client can not fill any field.
   *
   * @example
   *  get fillable() {
   *    return ["name", "email", "password"]
   *  }
   * @type {(string[] | IMethodBaseConfig)}
   * @tutorial https://axe-api.com/reference/model-fillable.html
   */
  get fillable(): string[] | IMethodBaseConfig<string[]> {
    return [];
  }

  /**
   * You can define the validation rules of the model. Method-based validations
   * are also acceptable.
   *
   * @example
   *  get validations() {
   *    return {
   *      "name": "required|min:1|max:100",
   *      "email": "required|email",
   *    }
   *  }
   * @type {(ModelValidation | IMethodBaseConfig<ModelValidation>)}
   * @tutorial https://axe-api.com/reference/model-validations.html
   */
  get validations(): ModelValidation | IMethodBaseConfig<ModelValidation> {
    return {};
  }

  /**
   * You can define acceptable handlers here.
   *
   * The default value is `DEFAULT_HANDLERS`
   *
   * @example
   *  get handlers() {
   *    return [HandlerTypes.PAGINATE]
   *  }
   * @type {HandlerTypes[]}
   * @tutorial https://axe-api.com/reference/model-handlers.html
   */
  get handlers(): HandlerTypes[] {
    return [...DEFAULT_HANDLERS];
  }

  /**
   * You can define a special handler for the model here. `MiddlewareFunction`,
   * `HandlerFunction`, and `PhaseFunction` are acceptable middlewares.
   *
   * Also, you can define handler-based middlewares.
   *
   * @example
   *  get middlewares() {
   *    return [
   *      {
   *        handler: [HandlerTypes.DELETE],
   *        middleware: isAdminMiddleware,
   *      }
   *    ]
   *  }
   * @type {ModelMiddleware}
   * @tutorial https://axe-api.com/reference/model-middlewares.html
   */
  get middlewares(): ModelMiddleware {
    return [];
  }

  /**
   * You can define which fields will be hiding in HTTP responses. The selected
   * fields will not be listed in any response.
   *
   * You should mark as hidden sensitive data fields such as `password`, `token`, etc.
   *
   * @example
   *  get hiddens() {
   *    return ["password_salt", "password_hash", "github_token"]
   *  }
   * @type {string[]}
   * @tutorial https://axe-api.com/reference/model-hiddens.html
   */
  get hiddens(): string[] {
    return [];
  }

  /**
   * The `created_at` column name is in the database table. The default value is
   * `created_at`. You can specify with a custom field name.
   *
   * It should be null if the table doesn't have a `created_at` column.
   *
   * @example
   *  get createdAtColumn() {
   *    return "created_at"
   *  }
   * @type {(string | null)}
   * @tutorial https://axe-api.com/reference/model-created-at-column.html
   */
  get createdAtColumn(): string | null {
    return "created_at";
  }

  /**
   * The `updated_at` column name is in the database table. The default value is
   * `updated_at`. You can specify with a custom field name.
   *
   * It should be null if the table doesn't have a `updated_at` column.
   *
   * @example
   *  get updatedAtColumn() {
   *    return "updated_at"
   *  }
   * @type {(string | null)}
   * @tutorial https://axe-api.com/reference/model-updated-at-column.html
   */
  get updatedAtColumn(): string | null {
    return "updated_at";
  }

  /**
   * The `deleted_at` column name is in the database table. The default value is
   * `null`. You can specify with a custom field name.
   *
   * If you provide a name, that means your model supports the soft delete feature.
   *
   * @example
   *  get deletedAtColumn() {
   *    return "deleted_at"
   *  }
   * @type {(string | null)}
   * @tutorial https://axe-api.com/reference/model-deleted-at-column.html
   */
  get deletedAtColumn(): string | null {
    return null;
  }

  /**
   * The transaction configuration on the model. The database transaction can
   * be started for all endpoints on the model as well as handler-based.
   *
   * Creating, rollbacking, and committing a transaction is managed by Axe API.
   *
   * @example
   *  get transaction() {
   *    return [
   *      {
   *        handlers: [HandlerTypes.INSERT],
   *        transaction: true
   *      }
   *    ]
   *  }
   * @type {(boolean | IHandlerBasedTransactionConfig[])}
   * @tutorial https://axe-api.com/learn/database-transactions.html#model-based-transactions
   */
  get transaction(): boolean | IHandlerBasedTransactionConfig[] {
    return false;
  }

  /**
   * You can completely ignore the model. Axe API doesn't create the routes
   * automatically.
   *
   * @example
   *  get ignore() {
   *    return true
   *  }
   * @type {boolean}
   * @tutorial https://axe-api.com/reference/model-ignore.html
   */
  get ignore(): boolean {
    return false;
  }

  /**
   * You can limit query features such as `select.*` or `LIKE`, etc.
   *
   * @example
   *  get limits() {
   *    return [
   *      allow(QueryFeature.WhereLike),
   *      deny(QueryFeature.FieldsAll)
   *    ];
   * }
   * @type {Array<IQueryLimitConfig[]>}
   * @tutorial https://axe-api.com/reference/model-limits.html
   */
  get limits(): Array<IQueryLimitConfig[]> {
    return [];
  }

  /**
   * You can set the caching configuration for a specific model or handler.
   * `NULL` means that there is not a special configuration. In that case, the
   * inherited configuration will be used.
   *
   * @example
   *  get cache() {
   *    return {
   *      enable: false,
   *      ttl: 300,
   *      invalidation: CacheStrategies.TimeBased,
   *    };
   * }
   * @type {ICacheConfiguration | IHandlerBasedCacheConfig[] | null>}
   * @tutorial https://axe-api.com/reference/model-cache.html
   */
  get cache(): ICacheConfiguration | IHandlerBasedCacheConfig[] | null {
    return null;
  }

  /**
   * You can set which fields should be set to the ElasticSearch for the
   * full-text search feature.
   *
   * @example
   *  get search() {
   *    return ["name", "surname", "email"]
   * }
   * @type {string[] | null>}
   * @tutorial https://axe-api.com/reference/model-search.html
   */
  get search(): string[] | null {
    return null;
  }

  /**
   * Model relationship definition. Axe API creates `hasMany` routes automatically.
   *
   * @example
   *  get relationName() {
   *    return this.hasMany("Post", "id", "user_id")
   * }
   * @type {HasMany}
   * @tutorial https://axe-api.com/learn/routing.html#model-relations
   */
  hasMany(
    relatedModel: string,
    primaryKey?: string,
    foreignKey?: string,
    options?: Partial<IHasManyOptions>,
  ): HasMany {
    const model = IoCService.use<Model>(relatedModel) as Model;
    return new HasMany(
      model,
      primaryKey ?? this.primaryKey,
      model.foreignKey ?? foreignKey,
      options,
    );
  }

  /**
   * Model relationship definition.
   *
   * @example
   *  get relationName() {
   *    return this.hasOne("User", "id", "user_id")
   * }
   * @type {HasOne}
   * @tutorial https://axe-api.com/learn/routing.html#model-relations
   */
  hasOne(
    relatedModel: string,
    primaryKey: string,
    foreignKey?: string,
  ): HasOne {
    const model = IoCService.use<Model>(relatedModel) as Model;
    return new HasOne(
      model,
      primaryKey ?? this.primaryKey,
      model.foreignKey ?? foreignKey,
    );
  }

  /**
   * Model relationship definition.
   *
   * @example
   *  get relationName() {
   *    return this.belongsTo("User", "user_id", "id")
   * }
   * @type {BelongsTo}
   * @tutorial https://axe-api.com/learn/routing.html#model-relations
   */
  belongsTo(
    relatedModel: string,
    primaryKey: string,
    foreignKey: string,
  ): BelongsTo {
    const model = IoCService.use<Model>(relatedModel) as Model;
    return new BelongsTo(
      model,
      primaryKey ?? this.primaryKey,
      foreignKey ?? model.foreignKey,
    );
  }

  getFillableFields(methodType: HttpMethods): string[] {
    if (!this.fillable) return [];

    if (Array.isArray(this.fillable)) {
      return this.fillable;
    }

    if (
      methodType === HttpMethods.POST ||
      methodType === HttpMethods.PUT ||
      methodType === HttpMethods.PATCH
    ) {
      return this.fillable[methodType] ?? [];
    }

    return [];
  }

  getValidationRules(methodType: HttpMethods): ModelValidation | null {
    const validations = this.validations;

    if (this.isSimpleValidation()) {
      return validations as ModelValidation;
    }

    if (
      methodType === HttpMethods.POST ||
      methodType === HttpMethods.PUT ||
      methodType === HttpMethods.PATCH
    ) {
      return (
        (validations as IMethodBaseConfig<ModelValidation>)[methodType] ?? null
      );
    }

    return null;
  }

  getMiddlewares(handlerType: HandlerTypes): AxeFunction[] {
    const middlewares = Array.isArray(this.middlewares)
      ? this.middlewares
      : [this.middlewares];

    return middlewares.filter(Boolean).flatMap((item: any) => {
      if (item.handler) {
        return item.handler.includes(handlerType) ? [item.middleware] : [];
      }
      return [item];
    });
  }

  getRelations(): Record<string, IRelation> {
    if (this._relations) {
      return this._relations;
    }

    const relations: Record<string, IRelation> = {};

    const proto = Object.getPrototypeOf(this);
    const propertyNames = Object.getOwnPropertyNames(proto);

    for (const name of propertyNames) {
      if (RESERVED_MODEL_MEMBERS.has(name)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (!descriptor?.get) continue;

      const value = (this as any)[name];

      if (
        value &&
        typeof value === "object" &&
        "type" in value &&
        Object.values(Relationships).includes(value.type)
      ) {
        relations[name] = value;
      }
    }

    this._relations = relations;

    return relations;
  }

  /**
   * In this function, you can use your custom Elastic Search query for the
   * full-text search feature.
   *
   * By default, Axe API uses a simple full-text search.
   *
   * @example
   *  getSearchQuery(params: IElasticSearchParameters) {
   *    return {
   *      // your query
   *    }
   * }
   * @tutorial https://axe-api.com/reference/model-get-search-query.html
   */
  getSearchQuery(params: IElasticSearchParameters): any {
    const { req, model, relation, parentModel, text } = params;
    // Creating the basic search query
    const query: any = {
      bool: {
        must: [
          {
            query_string: {
              query: `*${text}*`,
              analyze_wildcard: true,
            },
          },
        ],
      },
    };

    // If there is any parent query, we should be able to that parent conditions
    // to the ElasticSearch query.
    const parentIndexQuery = getParentIndexQuery(req, relation, parentModel);
    if (Object.keys(parentIndexQuery).length > 0) {
      query.bool.must.push({
        term: parentIndexQuery,
      });
    }

    // If there is a deletedAtColumn, it means that this table support soft-delete
    if (model.instance.deletedAtColumn) {
      query.bool.must_not = {
        exists: {
          field: model.instance.deletedAtColumn,
        },
      };
    }

    return {
      query,
      sort: [
        {
          _score: {
            order: "desc",
          },
        },
      ],
    };
  }

  /**
   * Determines whether `validations` is a flat ModelValidation object
   * (as opposed to a method-based IMethodBaseConfig<ModelValidation>).
   *
   * A flat validation object has string or object rule values directly on its
   * keys, whereas a method-based config uses HTTP method names (POST, PUT, PATCH)
   * as its top-level keys.
   */
  private isSimpleValidation(): boolean {
    const HTTP_METHOD_KEYS = new Set(["POST", "PUT", "PATCH"]);
    const keys = Object.keys(this.validations);

    if (keys.length === 0) return true;

    return !keys.some((key) => HTTP_METHOD_KEYS.has(key));
  }
}

export default Model;
