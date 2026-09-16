import type { CommandDef, Feature } from './feature';

export type RegisteredCommand = {
  feature: string;
  def: CommandDef;
};

export class FeatureRegistry {
  private features: Feature[] = [];
  private commands: RegisteredCommand[] = [];

  add(feature: Feature): void {
    if (!feature.name || !/^[a-z0-9-]+$/.test(feature.name)) {
      throw new Error(`invalid feature name "${feature.name}" (want lowercase alphanumerics/dashes)`);
    }
    if (this.features.some((f) => f.name === feature.name)) {
      throw new Error(`duplicate feature name "${feature.name}"`);
    }
    for (const def of feature.commands ?? []) {
      const name = def.data.name;
      if (this.commands.some((c) => c.def.data.name === name)) {
        throw new Error(`duplicate command name "/${name}" (feature "${feature.name}")`);
      }
    }
    this.features.push(feature);
    for (const def of feature.commands ?? []) this.commands.push({ feature: feature.name, def });
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
