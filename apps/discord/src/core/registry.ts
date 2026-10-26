import type { CommandDef, Feature } from "./feature";

export interface RegisteredCommand {
  feature: string;
  def: CommandDef;
}

export class FeatureRegistry {
  private readonly features: Feature[] = [];
  private readonly commands: RegisteredCommand[] = [];

  add(feature: Feature): void {
    if (!(feature.name && /^[a-z0-9-]+$/u.test(feature.name))) {
      throw new Error(
        `invalid feature name "${feature.name}" (want lowercase alphanumerics/dashes)`
      );
    }
    if (this.features.some((f) => f.name === feature.name)) {
      throw new Error(`duplicate feature name "${feature.name}"`);
    }
    for (const def of feature.commands ?? []) {
      const { name } = def.data;
      if (this.commands.some((c) => c.def.data.name === name)) {
        throw new Error(
          `duplicate command name "/${name}" (feature "${feature.name}")`
        );
      }
    }
    this.features.push(feature);
    for (const def of feature.commands ?? []) {
      this.commands.push({ def, feature: feature.name });
    }
  }

  names(): string[] {
    return this.features.map((f) => f.name);
  }

  all(): Feature[] {
    return this.features;
  }

  commandsFlat(): RegisteredCommand[] {
    return this.commands;
  }

  findCommand(name: string): RegisteredCommand | undefined {
    return this.commands.find((c) => c.def.data.name === name);
  }
}
