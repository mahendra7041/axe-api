import { Relationships } from "./Enums";
import { IHasManyOptions } from "./Interfaces";
import Model from "./Model";
import { IoCService } from "./Services";

export abstract class Relation {
  public readonly model: Model;
  constructor(
    public readonly type: Relationships,
    public readonly modelName: string,
    public readonly primaryKey?: string,
    public readonly foreignKey?: string,
  ) {
    this.model = IoCService.use<Model>(modelName) as Model;
    if (this.primaryKey === undefined) {
      this.primaryKey = this.model.primaryKey;
    }
    if (this.foreignKey === undefined) {
      this.foreignKey = this.model.foreignKey;
    }
  }
}

export class HasMany extends Relation {
  constructor(
    modelName: string,
    primaryKey?: string,
    foreignKey?: string,
    public readonly options?: Partial<IHasManyOptions>,
  ) {
    super(Relationships.HAS_MANY, modelName, primaryKey, foreignKey);
  }
}

export class HasOne extends Relation {
  constructor(modelName: string, primaryKey?: string, foreignKey?: string) {
    super(Relationships.HAS_ONE, modelName, primaryKey, foreignKey);
  }
}

export class BelongsTo extends Relation {
  constructor(modelName: string, primaryKey?: string, foreignKey?: string) {
    super(Relationships.BELONGS_TO, modelName, primaryKey, foreignKey);
  }
}
