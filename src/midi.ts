import { configManager } from "./config.js";
import { type ControlChange, getInputs, Input, type Note } from "easymidi";
import { isDevelopment, log } from "../utils.js";
import { faderProfileManager } from "./fader-profiles.js";
import { eos } from "./eos.js";

interface MidiConfig {
  readonly NOTE_OFFSET: number;
  readonly ATTACH_TOLERANCE: number;
}

class MidiController {
  private static readonly CONFIG: MidiConfig = {
    NOTE_OFFSET: 1,
    ATTACH_TOLERANCE: 0.01,
  };

  private midiInput: Input | null = null;

  public initialize(): void {
    const config = configManager.getConfig();
    if (config.midi.active && !this.midiInput) {
      this.openMidiInput(config.midi.device);
    } else {
      this.closeMidiInput();
    }
  }

  public changeDevice(device: string): void {
    this.closeMidiInput();
    this.openMidiInput(device);
  }

  public getAvailableDevices(): string[] {
    return getInputs();
  }

  private openMidiInput(device?: string): void {
    if (!device) return;

    try {
      this.midiInput = new Input(device);
      configManager.setMidiDevice(device);
      configManager.setMidiActive(true);
      this.setupEventListeners();
      log(`MIDI input opened with device "${device}"`, "info", "MIDI");
    } catch (error) {
      this.handleMidiError(error as Error, device);
    }
  }

  private closeMidiInput(): void {
    if (!this.midiInput) return;
    this.midiInput.removeAllListeners();
    this.midiInput.close();
    this.midiInput = null;
    configManager.setMidiActive(false);
  }

  private setupEventListeners(): void {
    if (!this.midiInput) return;

    if (isDevelopment()) {
      this.setupDebugListener();
    }

    this.midiInput.on("cc", this.handleControlChange);
    this.midiInput.on("noteon", this.handleNoteOn);
    this.midiInput.on("noteoff", this.handleNoteOff);
  }

  private setupDebugListener(): void {
    this.midiInput?.on("message", (msg: any) => {
      const messageInfo = Object.keys(msg)
        .map((key) => `${key}: ${msg[key]}`)
        .join(", ");
      log(`Received message: ${messageInfo}`, "info", "MIDI");
    });
  }

  private handleMidiError(error: Error, device: string): void {
    log(
      `Failed to open MIDI input with device "${device}": ${error}`,
      "error",
      "MIDI"
    );

    configManager.setMidiDevice("");
    configManager.setMidiActive(false);
  }

  private handleControlChange = (param: ControlChange): void => {
    const fader = faderProfileManager.getFaderByMidi(param.controller);
    if (!fader) return;

    const midiValNorm = param.value / 127;
    const eosVal = fader.eos;
    const lastMidiValNorm = fader.midi / 127;

    if (
      eosVal === lastMidiValNorm ||
      midiValNorm === eosVal ||
      (eosVal < lastMidiValNorm + MidiController.CONFIG.ATTACH_TOLERANCE &&
        midiValNorm < eosVal) ||
      (eosVal > lastMidiValNorm - MidiController.CONFIG.ATTACH_TOLERANCE &&
        midiValNorm > eosVal)
    ) {
      eos.sendFaderLevel(fader.id, midiValNorm);
      faderProfileManager.setFader(fader.id, {
        ...fader,
        eos: midiValNorm,
        midi: param.value,
      });
    }
  };

  private handleNoteOn = (param: Note): void => {
    const fader = faderProfileManager.getFaderByMidi(
      param.note + MidiController.CONFIG.NOTE_OFFSET
    );
    if (!fader) return;
    eos.sendBumpOn(fader.id);
  };

  private handleNoteOff = (param: Note): void => {
    const fader = faderProfileManager.getFaderByMidi(
      param.note + MidiController.CONFIG.NOTE_OFFSET
    );
    if (!fader) return;
    eos.sendBumpOff(fader.id);
  };
}

const midi = new MidiController();
export { midi };
