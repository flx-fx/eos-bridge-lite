export type Config = {
  app?: {
    faderProfileId?: Id;
    theme?: Theme;
    autostart?: boolean;
    autostartUI?: boolean;
  };
  eos: {
    active: boolean;
    address: string;
    port: number;
  };
  midi: {
    active: boolean;
    device?: string;
    channel: number;
  };
};

export const isConfig = (obj: any): obj is Config =>
  typeof obj === "object" &&
  obj !== null &&
  typeof obj.app === "object" &&
  (typeof obj.app.faderProfileId === "string" ||
    typeof obj.app.faderProfileId === "number") &&
  (typeof obj.app.autostart === "boolean" ||
    typeof obj.app.autostart === "undefined") &&
  (typeof obj.app.autostartUI === "boolean" ||
    typeof obj.app.autostartUI === "undefined") &&
  typeof obj.eos === "object" &&
  typeof obj.eos.active === "boolean" &&
  typeof obj.eos.address === "string" &&
  typeof obj.eos.port === "number" &&
  typeof obj.midi === "object" &&
  typeof obj.midi.active === "boolean" &&
  (typeof obj.midi.device === "string" || obj.midi.device === null) &&
  typeof obj.midi.channel === "number";

export type FaderProfile = {
  id: Id;
  name: string;
  currentPage?: number;
  faderGroups: FaderGroup[];
  faders: Fader[];
};

export const isFaderProfile = (obj: any): obj is FaderProfile => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (typeof obj.id === "string" || typeof obj.id === "number") &&
    typeof obj.name === "string" &&
    (typeof obj.currentPage === "number" ||
      typeof obj.currentPage === "undefined") &&
    Array.isArray(obj.faderGroups) &&
    Array.isArray(obj.faders)
  );
};

export type FaderProfileMetadata = {
  id: Id;
  name: string;
  filename: string;
};

export type FaderConfig = {
  midiController: number;
  eosFader: number;
};

export type FaderGroup = {
  id: Id;
  name: string;
  page: number;
};

export type Fader = {
  id: Id;
  groupId: Id;
  eos: number;
  midi: number;
  config: FaderConfig;
};

export type Id = string | number;
export type Theme = "dark" | "light" | "system";

export type LogType = "EOS" | "MIDI";
export type LogLevel = "warn" | "error" | "info";

export type Log = {
  id: Id;
  message: string;
  timestamp: string;
  level?: LogLevel;
  type?: LogType;
};
