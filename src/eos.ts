import { EosConsole } from "eos-console";
import { configManager } from "./config.js";
import { log } from "../utils.js";
import type { Id, LogLevel } from "./types/types.js";
import { faderProfileManager } from "./fader-profiles.js";

interface FaderLevelEvent {
  fader: number;
  percent: number;
}

class EosService {
  private static readonly DEFAULT_BANK = 1;
  private static readonly BASE_FADER_PATH = "/eos/user/0/fader";

  private connection: EosConsole | null = null;

  constructor() {
    this.initialize = this.initialize.bind(this);
  }

  initialize() {
    const config = configManager.getConfig();
    if (config.eos.active && this.connection === null) {
      this.openConnection();
    } else {
      this.closeConnection();
    }
  }

  private async openConnection(): Promise<void> {
    try {
      const config = configManager.getConfig();
      this.connection = new EosConsole({
        host: config.eos.address,
        port: config.eos.port,
        logging: (level, message) => this.handleLogging(level, message),
      });

      configManager.setEosActive(true);

      this.connection.on("fader-level", this.handleFaderLevel);

      await this.connection.connect();
      await this.connection.faderBanks.create(EosService.DEFAULT_BANK, {
        faderCount: faderProfileManager.getMaxEosFader(),
      });

      log(
        `Connected to EOS console at ${config.eos.address}:${config.eos.port}`
      );
    } catch (error) {
      log(`Error: ${error}`, "error", "EOS");
      const config = configManager.getConfig();
      configManager.setConfig({
        eos: { ...config.eos, active: false },
      });
    }
  }

  private closeConnection(): void {
    this.connection?.disconnect();
    this.connection = null;
  }

  private handleLogging(level: string, message: string): void {
    const logLevel = ["warn", "error", "info"].includes(level)
      ? (level as LogLevel)
      : undefined;
    log(message, logLevel, "EOS");
  }

  private handleFaderLevel({
    fader: eosFader,
    percent,
  }: FaderLevelEvent): void {
    const fader = faderProfileManager.getFaderByEos(eosFader);
    if (!fader) return;

    faderProfileManager.setFader(fader.id, { ...fader, eos: percent });
  }

  private constructFaderPath(faderBank: number, eosFader: number): string {
    return `${EosService.BASE_FADER_PATH}/${faderBank}/${eosFader}`;
  }

  sendFaderLevel(
    faderId: Id,
    level: number,
    faderBank: number = EosService.DEFAULT_BANK
  ): void {
    const fader = faderProfileManager.getFader(faderId);
    if (!fader) return;

    if (level < 0 || level > 1 || isNaN(level)) {
      log(`Invalid fader level for fader ${faderId}: ${level}`, "error", "EOS");
      return;
    }

    this.connection?.sendMessage(
      this.constructFaderPath(faderBank, fader.config.eosFader),
      [level]
    );
  }

  sendBumpOn(faderId: Id, faderBank: number = EosService.DEFAULT_BANK): void {
    const fader = faderProfileManager.getFader(faderId);
    if (!fader) return;

    this.connection?.sendMessage(
      this.constructFaderPath(faderBank, fader.config.eosFader),
      [1.0]
    );
  }

  sendBumpOff(faderId: Id, faderBank: number = EosService.DEFAULT_BANK): void {
    const fader = faderProfileManager.getFader(faderId);
    if (!fader) return;

    this.connection?.sendMessage(
      this.constructFaderPath(faderBank, fader.config.eosFader),
      [fader.eos]
    );
  }
}

const eos = new EosService();
export { eos };
