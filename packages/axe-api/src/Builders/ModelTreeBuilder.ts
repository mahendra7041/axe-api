import { Relationships } from "../Enums";
import { LogService } from "../Services";
import { VersionEntry, ModelEntry } from "../AppLoader";
import { Relation } from "../Relations";
import Model from "../Model";

class ModelTreeBuilder {
  private versionName: string;
  private versionEntry: VersionEntry;

  constructor(versionName: string, versionEntry: VersionEntry) {
    this.versionName = versionName;
    this.versionEntry = versionEntry;
  }

  build() {
    const rootNames = this.getRootLevelOfTree();
    this.createRecursiveTree(rootNames);
    this.addNestedRoutes(rootNames);
    this.versionEntry.modelTree = rootNames;
    LogService.debug(`[${this.versionName}] Model tree has been created.`);
  }

  private getRelationsArray(
    modelInstance: Model,
  ): { name: string; type: Relationships; modelName: string; options: any }[] {
    const relationsMap: Record<string, Relation> =
      modelInstance.getRelations();
    return Object.entries(relationsMap).map(([name, relation]) => ({
      name,
      type: relation.type,
      modelName: relation.modelName,
      options: (relation as any).options ?? { autoRouting: true },
    }));
  }

  private getRootLevelOfTree(): string[] {
    const childModelNames = new Set<string>();
    const models = this.versionEntry.models;

    for (const modelName in models) {
      const entry = models[modelName];
      const model: Model = entry.model;
      const relations = this.getRelationsArray(model);

      for (const relation of relations) {
        if (relation.type === Relationships.HAS_MANY) {
          childModelNames.add(relation.modelName);
        }
      }
    }

    return Object.keys(models).filter(
      (name) => !childModelNames.has(name),
    );
  }

  private createRecursiveTree(rootNames: string[]) {
    for (const name of rootNames) {
      this.setChildren(name);
    }
  }

  private setChildren(modelName: string) {
    const entry = this.versionEntry.models[modelName];
    if (!entry) return;

    const childNames = this.getChildModelNames(entry);
    entry.children = childNames;

    for (const childName of childNames) {
      this.setChildren(childName);
    }
  }

  private getChildModelNames(entry: ModelEntry): string[] {
    const model: Model = entry.model;
    const relations = this.getRelationsArray(model);

    return relations
      .filter(
        (item) =>
          item.type === Relationships.HAS_MANY && item.options?.autoRouting,
      )
      .map((item) => item.modelName);
  }

  private addNestedRoutes(tree: string[]) {
    const models = this.versionEntry.models;

    for (const modelName in models) {
      const entry = models[modelName];
      const model: Model = entry.model;
      const relations = this.getRelationsArray(model);

      const recursiveRelations = relations.filter(
        (relation) => relation.modelName === modelName,
      );

      const hasManyCount = recursiveRelations.filter(
        (item) => item.type === Relationships.HAS_MANY,
      ).length;

      const hasOneCount = recursiveRelations.filter(
        (item) => item.type === Relationships.HAS_ONE,
      ).length;

      if (
        recursiveRelations.length === 2 &&
        hasManyCount === 1 &&
        hasOneCount === 1
      ) {
        entry.isRecursive = true;
        tree.push(modelName);
      }
    }
  }
}

export default ModelTreeBuilder;
