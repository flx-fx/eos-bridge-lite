import path from "path";
import os from "os";
import fs from "fs";
import { isConfig, type Config } from "./types/types.js";

class ConfigManager {
  private static readonly PATHS = {
    appData: path.join(
      os.homedir(),
      process.platform === "win32"
        ? "AppData\\Roaming\\eos-bridge"
        : ".eos-bridge"
    ),
    get configFile() {
      return path.join(this.appData, "config.json");
    },
  };

  private static readonly DEFAULT_CONFIG: Config = {
    eos: {
      active: true,
      address: "127.0.0.1",
      port: 3032,
    },
    midi: {
      active: true,
      device: "",
      channel: 0,
    },
  };

  private config: Config = { ...ConfigManager.DEFAULT_CONFIG };

  public initialize(): void {
    this.ensureAppDataDirectory();
    this.loadConfig();
  }

  private ensureAppDataDirectory(): void {
    fs.mkdirSync(ConfigManager.PATHS.appData, { recursive: true });
  }

  private loadConfig(): void {
    if (!fs.existsSync(ConfigManager.PATHS.configFile)) {
      console.error("Config directory missing. Using default configuration.");
      return;
    }

    try {
      const fileData = JSON.parse(
        fs.readFileSync(ConfigManager.PATHS.configFile, "utf8")
      );
      if (isConfig(fileData)) {
        this.config = fileData;
      } else {
        console.error("Invalid configuration file format.");
      }
    } catch (error) {
      console.error("Failed to load config file: ", error);
    }
  }

  public saveConfig(): void {
    try {
      fs.writeFileSync(
        ConfigManager.PATHS.configFile,
        JSON.stringify(this.config, null, 2),
        "utf8"
      );
      console.info("Config file written successfully.");
    } catch (error) {
      console.error("Failed to write config file: ", error);
    }
  }

  public getConfig(): Config {
    return this.config;
  }

  public setConfig(newConfig: Partial<Config>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  public setMidiDevice(device: string): void {
    this.config.midi.device = device;
    this.saveConfig();
  }

  setMidiActive(acitve: boolean) {
    this.config.midi.active = acitve;
    this.saveConfig();
  }

  setEosActive(active: boolean) {
    this.config.eos.active = active;
    this.saveConfig();
  }
}

const configManager = new ConfigManager();

export { configManager };
