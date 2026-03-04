import { Relationships } from "./Enums";
import { IHasManyOptions } from "./Interfaces";
import Model from "./Model";

abstract class Relation {
  constructor(
    public readonly type: Relationships,
    public readonly model: Model,
    public readonly primaryKey: string,
    public readonly foreignKey: string,
  ) {}
}

export class HasMany extends Relation {
  constructor(
    model: Model,
    primaryKey: string,
    foreignKey: string,
    public readonly options?: Partial<IHasManyOptions>,
  ) {
    super(Relationships.HAS_MANY, model, primaryKey, foreignKey);
  }
}

export class HasOne extends Relation {
  constructor(model: Model, primaryKey: string, foreignKey: string) {
    super(Relationships.HAS_ONE, model, primaryKey, foreignKey);
  }
}

export class BelongsTo extends Relation {
  constructor(model: Model, primaryKey: string, foreignKey: string) {
    super(Relationships.BELONGS_TO, model, primaryKey, foreignKey);
  }
}
