import {
  isFaderProfile,
  type Fader,
  type FaderConfig,
  type FaderGroup,
  type FaderProfile,
  type FaderProfileMetadata,
  type Id,
} from "./types/types.js";
import path from "path";
import os from "os";
import fs from "fs";
import { configManager } from "./config.js";
import { log, getId } from "../utils.js";

const appDataPath = path.join(
  os.homedir(),
  process.platform === "win32" ? "AppData\\Roaming\\eos-bridge" : ".eos-bridge"
);
const profilesDir = path.join(appDataPath, "faderProfiles");

class FaderProfileManager {
  private faderProfile?: FaderProfile;
  private page: number = 1;

  private readonly faderIdsByMidi = new Map<number, Id>();
  private readonly faderIdsByEos = new Map<number, Id>();

  private readonly faderGroups = new Map<Id, FaderGroup>();
  private readonly faders = new Map<Id, Fader>();
  private readonly metadataMap = new Map<Id, FaderProfileMetadata>();

  initialize() {
    this.ensureProfilesDir();
    this.loadMetadata();
    this.loadProfile();
  }

  private ensureProfilesDir() {
    fs.mkdirSync(profilesDir, { recursive: true });
  }

  private loadMetadata() {
    if (!fs.existsSync(profilesDir)) {
      log("Fader profile directory missing.", "error");
      return;
    }
    try {
      this.metadataMap.clear();
      fs.readdirSync(profilesDir)
        .filter((filename) => filename.endsWith(".json"))
        .map((filename) => ({
          content: JSON.parse(
            fs.readFileSync(path.join(profilesDir, filename), "utf8")
          ),
          fileName: filename,
        }))
        .filter((data) => isFaderProfile(data.content))
        .forEach((data) =>
          this.metadataMap.set(data.content.id, {
            id: data.content.id,
            name: data.content.name,
            filename: data.fileName,
          } as FaderProfileMetadata)
        );
      console.log("Fader profile metadata loaded:", this.metadataMap);
    } catch (error) {
      log(`Failed to read fader profile file(s): ${error}`, "error");
    }
  }

  loadProfile(id?: Id) {
    if (!fs.existsSync(profilesDir)) {
      log("Fader profile directory missing.", "error");
      return;
    }
    const profileId = id || configManager.getConfig().app?.faderProfileId || "";
    const filename = this.metadataMap.get(profileId)?.filename;
    if (!filename) {
      log(`Fader profile file not found with Id ${profileId}`, "error");
      return;
    }
    try {
      this.faderProfile = JSON.parse(
        fs.readFileSync(path.join(profilesDir, filename), "utf8")
      );
      this.page = this.faderProfile?.currentPage || 1;

      this.rebuildFaderMaps();
    } catch (error) {
      log(`Failed to read fader profile file(s): ${error}`, "error");
    }
  }

  private buildFaderProfile(
    name = "New Profile",
    numFGs = 0,
    numFs = 0
  ): FaderProfile {
    let newProfile: FaderProfile = {
      id: getId(),
      name: name,
      faderGroups: [],
      faders: [],
    };
    newProfile.faderGroups = Array.from({ length: numFGs }, () =>
      this.buildFaderGroup()
    );

    const fadersPerGroup = Math.ceil(numFs / numFGs);
    newProfile.faders = Array.from({ length: numFs }, (_, index) => {
      const groupIndex = Math.floor(index / fadersPerGroup);
      const groupId = newProfile.faderGroups[groupIndex]?.id;
      if (!groupId) {
        throw new Error("Group ID is undefined");
      }
      const eosFader = index + 1;
      const midiController = index + 1;
      return this.buildFader(groupId, eosFader, midiController);
    });

    return newProfile;
  }

  createFaderProfile(
    name = "New Profile",
    numFGs = 0,
    numFs = 0
  ): FaderProfile {
    const profile = this.buildFaderProfile(name, numFGs, numFs);
    this.faderProfile = profile;
    this.rebuildFaderMaps();
    return profile;
  }

  deleteFaderProfile(id: Id) {
    const filename = this.metadataMap.get(id)?.filename;
    if (filename) {
      fs.unlinkSync(path.join(profilesDir, filename));
      this.metadataMap.delete(id);
    }
    if (this.faderProfile?.id === id) {
      this.faderProfile = undefined;
      this.rebuildFaderMaps();
    }
    this.loadMetadata();
  }

  getFaderGroups(): FaderGroup[] {
    return Array.from(this.faderGroups.values());
  }

  updateFaderGroups(faderGroups: FaderGroup[]) {
    this.faderGroups.clear();
    faderGroups.forEach((fg) => this.faderGroups.set(fg.id, fg));
  }

  sendFaderGroups() {
    /*   const faderGroups = Array.from(this.faderGroups.values());
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("faderProfile:updateGroups", faderGroups);
    }); */
  }

  getFaders(): Fader[] {
    return Array.from(this.faders.values()).filter(
      (f) =>
        f.groupId === this.faderGroups.get(f.groupId)?.id &&
        f.groupId !== undefined
    );
  }

  updateFaders(faders: Fader[]) {
    this.faders.clear();
    faders.forEach((f) => this.faders.set(f.id, f));
  }

  sendFaders() {
    /*     const faders = Array.from(this.faders.values());
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('faderProfile:updateFaders', faders);
    }); */
  }

  private buildFaderGroup(name = "New Group", page = 1): FaderGroup {
    return {
      id: getId(),
      name,
      page,
    } as FaderGroup;
  }

  createFaderGroup(name = "New Group", page = 1): FaderGroup {
    const group = this.buildFaderGroup(name, page);
    this.faderGroups.set(group.id, group);
    if (this.faderProfile) {
      this.faderProfile.faderGroups.push(group);
    }
    return group;
  }

  updateFaderGroupName(id: Id, name: string) {
    const group = this.faderGroups.get(id);
    if (!group) return;

    group.name = name;
    this.faderGroups.set(id, group);
  }

  deleteFaderGroup(id: Id) {
    this.faderGroups.delete(id);
    this.faders.forEach((fader) => {
      if (fader.groupId === id) {
        this.faders.delete(fader.id);
      }
    });
    this.rebuildFaderIdMaps();
  }

  private buildFader(groupId: Id, eosFader = 1, midiController = 1): Fader {
    return {
      id: getId(),
      groupId,
      eos: 0,
      midi: 0,
      config: {
        midiController,
        eosFader,
      },
    };
  }

  createFader(groupId: Id, eosFader = 1, midiController = 1): Fader {
    const fader = this.buildFader(groupId, eosFader, midiController);
    this.faders.set(fader.id, fader);
    if (this.faderProfile) {
      this.faderProfile.faders.push(fader);
    }
    this.rebuildFaderIdMaps();
    return fader;
  }

  updateFaderConfig(id: Id, faderConfig: Partial<FaderConfig>) {
    const existingFader = this.faders.get(id);
    if (!existingFader) return;

    this.faders.set(id, {
      ...existingFader,
      config: { ...existingFader.config, ...faderConfig },
    });
  }

  deleteFader(id: Id) {
    this.faders.delete(id);
    this.rebuildFaderIdMaps();
  }

  setPage(page: number) {
    this.page = page;
    this.rebuildFaderIdMaps();
    if (this.faderProfile) {
      this.faderProfile.currentPage = page;
    }
  }

  getPage(): number {
    return this.page;
  }

  getPages(): number[] {
    return Array.from(
      new Set(Array.from(this.faderGroups.values()).map((fg) => fg.page))
    );
  }

  getFader(id: Id): Fader | undefined {
    return this.faders.get(id);
  }

  setFader(id: Id, fader: Fader) {
    this.faders.set(id, fader);
  }

  getMaxEosFader() {
    return Math.max(
      ...Array.from(this.faders.values()).map((f) => f.config.eosFader)
    );
  }

  getFaderByMidi(midiController: number): Fader | undefined {
    const id = this.faderIdsByMidi.get(midiController);
    return id ? this.faders.get(id) : undefined;
  }

  getFaderByEos(eosFader: number): Fader | undefined {
    const id = this.faderIdsByEos.get(eosFader);
    return id ? this.faders.get(id) : undefined;
  }

  getProfileMetadata(): FaderProfileMetadata[] {
    return Array.from(this.metadataMap.values());
  }

  private rebuildFaderMaps() {
    this.faderGroups.clear();
    this.faders.clear();

    this.faderProfile?.faderGroups.forEach((fg) =>
      this.faderGroups.set(fg.id, fg)
    );
    this.faderProfile?.faders.forEach((f) => this.faders.set(f.id, f));

    console.log("Fader groups:", this.faderGroups);
    console.log("Faders:", this.faders);
    this.rebuildFaderIdMaps();
  }

  private rebuildFaderIdMaps() {
    this.faderIdsByMidi.clear();
    this.faderIdsByEos.clear();

    Array.from(this.faders.values()).forEach((fader) => {
      const group = this.faderGroups.get(fader.groupId);
      if (group && group.page === this.page) {
        this.faderIdsByMidi.set(fader.config.midiController, fader.id);
        this.faderIdsByEos.set(fader.config.eosFader, fader.id);
      }
    });

    console.log("Fader IDs by MIDI:", this.faderIdsByMidi);
    console.log("Fader IDs by Eos:", this.faderIdsByEos);
  }
}

const faderProfileManager = new FaderProfileManager();
export { faderProfileManager };
