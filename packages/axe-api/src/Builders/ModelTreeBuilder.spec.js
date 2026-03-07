import { describe, it, expect, vi, beforeEach } from "vitest";
import ModelTreeBuilder from "./ModelTreeBuilder";
import { Relationships } from "../Enums";
import { LogService } from "../Services";

vi.mock("../Services", () => ({
  LogService: {
    debug: vi.fn(),
  },
}));

const createModelInstance = ({ name, relations = {} }) => ({
  name,
  getRelations: () => relations,
});

const createRelation = (type, modelName, autoRouting = true) => ({
  type,
  modelName,
  options: { autoRouting },
});

const createVersionEntry = (modelsMap) => ({
  config: null,
  init: {},
  models: modelsMap,
  modelTree: [],
});

const createModelEntry = (modelInstance) => ({
  model: modelInstance,
  serialization: null,
  hooks: {},
  events: {},
  children: [],
  isRecursive: false,
});

describe("ModelTreeBuilder", () => {
  let versionEntry;
  let builder;

  beforeEach(() => {
    versionEntry = createVersionEntry({});
    builder = new ModelTreeBuilder("v1", versionEntry);
  });

  it("should build a model tree with correct root nodes and structure", () => {
    const parentInstance = createModelInstance({
      name: "Parent",
      relations: {
        childOfParent: createRelation(Relationships.HAS_MANY, "ChildOfParent"),
      },
    });
    const childInstance = createModelInstance({
      name: "Child",
      relations: {
        selfHasOne: createRelation(Relationships.HAS_ONE, "Child"),
        selfHasMany: createRelation(Relationships.HAS_MANY, "Child"),
      },
    });
    const childOfParentInstance = createModelInstance({
      name: "ChildOfParent",
      relations: {
        grandChild: createRelation(Relationships.HAS_MANY, "GrandChild", true),
      },
    });
    const grandChildInstance = createModelInstance({
      name: "GrandChild",
      relations: {},
    });

    versionEntry = createVersionEntry({
      Parent: createModelEntry(parentInstance),
      Child: createModelEntry(childInstance),
      ChildOfParent: createModelEntry(childOfParentInstance),
      GrandChild: createModelEntry(grandChildInstance),
    });

    builder = new ModelTreeBuilder("v1", versionEntry);
    builder.build();

    // Root nodes should be "Parent" (and "Child" added as recursive)
    expect(versionEntry.modelTree).toContain("Parent");

    // Should attach children recursively
    expect(versionEntry.models["Parent"].children).toContain("ChildOfParent");
    expect(versionEntry.models["ChildOfParent"].children).toContain(
      "GrandChild",
    );

    // Recursive model handling
    expect(versionEntry.models["Child"].isRecursive).toBe(true);
    expect(versionEntry.modelTree).toContain("Child");

    // Logging
    expect(LogService.debug).toHaveBeenCalledWith(
      "[v1] Model tree has been created.",
    );
  });

  it("should handle case with no models", () => {
    versionEntry = createVersionEntry({});
    builder = new ModelTreeBuilder("v1", versionEntry);

    builder.build();

    expect(versionEntry.modelTree).toEqual([]);
    expect(LogService.debug).toHaveBeenCalledWith(
      "[v1] Model tree has been created.",
    );
  });

  it("should not mark non-recursive models as recursive", () => {
    const modelInstance = createModelInstance({
      name: "Test",
      relations: {
        other: createRelation(Relationships.HAS_MANY, "Other"),
        another: createRelation(Relationships.HAS_MANY, "Another"),
      },
    });

    versionEntry = createVersionEntry({
      Test: createModelEntry(modelInstance),
    });
    builder = new ModelTreeBuilder("v1", versionEntry);

    builder.build();

    expect(versionEntry.models["Test"].isRecursive).toBe(false);
  });
});
