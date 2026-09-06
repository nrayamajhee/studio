import { midiToNote, noteToMidi } from "../components/piano-roll/types";

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: "connected" | "disconnected";
}

export interface MidiNoteEvent {
  noteName: string;
  midiNumber: number;
  velocity: number; // 0.0 to 1.0
  rawVelocity: number; // 0 to 127
  channel: number; // 1 to 16
  isDrum: boolean;
  type: "on" | "off";
  deviceId: string;
  timestamp: number;
}

export interface MidiCCEvent {
  controller: number;
  value: number; // 0 to 127
  normalizedValue: number; // 0.0 to 1.0
  channel: number; // 1 to 16
  name: string;
  deviceId: string;
  timestamp: number;
}

export interface MidiPitchBendEvent {
  value: number; // -1.0 to 1.0
  semitones: number; // approximately -2 to +2
  channel: number;
  deviceId: string;
  timestamp: number;
}

export interface MidiActivityItem {
  id: string;
  timestamp: number;
  type: "noteOn" | "noteOff" | "cc" | "pitchBend";
  label: string;
  channel: number;
  value: string;
  isDrum: boolean;
}

const CC_NAMES: Record<number, string> = {
  1: "Mod Wheel",
  2: "Breath",
  7: "Volume",
  10: "Pan",
  11: "Expression",
  64: "Sustain Pedal",
  65: "Portamento",
  71: "Resonance",
  74: "Cutoff / Brightness",
  84: "Portamento Control",
  91: "Reverb",
  93: "Chorus / Drive",
  120: "All Sound Off",
  121: "Reset All Controllers",
  123: "All Notes Off",
};

export class WebMidiManager {
  private midiAccess: MIDIAccess | null = null;
  private connectedInputs: Map<string, MIDIInput> = new Map();
  private selectedInputId: string = "all";
  private drumChannel: number = 10; // Default: MIDI channel 10
  private octaveShift: number = 0;
  private isAccessRequested = false;
  private hasAccess = false;
  private isSupportedState = false;

  private sustainPedal = false;
  private sustainedNotes: Set<string> = new Set();
  private heldNotes: Set<string> = new Set();

  private activityLog: MidiActivityItem[] = [];
  private maxActivityLog = 15;

  private noteOnListeners: Set<(e: MidiNoteEvent) => void> = new Set();
  private noteOffListeners: Set<(e: MidiNoteEvent) => void> = new Set();
  private ccListeners: Set<(e: MidiCCEvent) => void> = new Set();
  private pitchBendListeners: Set<(e: MidiPitchBendEvent) => void> = new Set();
  private devicesListeners: Set<(devices: MidiDeviceInfo[]) => void> = new Set();
  private activityListeners: Set<(activity: MidiActivityItem[]) => void> = new Set();
  private sustainListeners: Set<(isDown: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined" && "navigator" in window) {
      this.isSupportedState = "requestMIDIAccess" in navigator;
    }
  }

  public isSupported(): boolean {
    return this.isSupportedState;
  }

  public isAccessGranted(): boolean {
    return this.hasAccess;
  }

  public async requestAccess(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (this.hasAccess && this.midiAccess) return true;
    if (this.isAccessRequested && this.midiAccess) return true;

    this.isAccessRequested = true;
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess = access;
      this.hasAccess = true;

      this.updateInputs();
      access.onstatechange = () => {
        this.updateInputs();
      };
      return true;
    } catch {
      this.hasAccess = false;
      return false;
    }
  }

  private updateInputs(): void {
    if (!this.midiAccess) return;
    this.connectedInputs.clear();

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      if (input.state === "connected") {
        this.connectedInputs.set(input.id, input);
        input.onmidimessage = (event) => this.handleMidiMessage(input.id, event);
      }
    }
    this.notifyDevicesChange();
  }

  public getDevices(): MidiDeviceInfo[] {
    const list: MidiDeviceInfo[] = [];
    if (!this.midiAccess) return list;

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      list.push({
        id: input.id,
        name: input.name || `MIDI Device (${input.id.slice(0, 4)})`,
        manufacturer: input.manufacturer || "Generic",
        state: input.state as "connected" | "disconnected",
      });
    }
    return list;
  }

  public setSelectedInput(id: string): void {
    this.selectedInputId = id;
  }

  public getSelectedInput(): string {
    return this.selectedInputId;
  }

  public setDrumChannel(channel: number): void {
    this.drumChannel = Math.max(0, Math.min(16, channel));
  }

  public getDrumChannel(): number {
    return this.drumChannel;
  }

  public setOctaveShift(shift: number): void {
    this.octaveShift = Math.max(-3, Math.min(3, shift));
  }

  public getOctaveShift(): number {
    return this.octaveShift;
  }

  public getSustainPedal(): boolean {
    return this.sustainPedal;
  }

  public getActivityLog(): MidiActivityItem[] {
    return [...this.activityLog];
  }

  private logActivity(
    type: MidiActivityItem["type"],
    label: string,
    channel: number,
    value: string,
    isDrum: boolean,
  ): void {
    const item: MidiActivityItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type,
      label,
      channel,
      value,
      isDrum,
    };
    this.activityLog = [item, ...this.activityLog].slice(0, this.maxActivityLog);
    this.activityListeners.forEach((cb) => cb(this.activityLog));
  }

  private handleMidiMessage(deviceId: string, event: MIDIMessageEvent): void {
    if (this.selectedInputId !== "all" && this.selectedInputId !== deviceId) {
      return;
    }

    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0];
    const command = status >> 4;
    const channel = (status & 0x0f) + 1; // 1-indexed (1 to 16)
    const noteOrCC = data[1];
    const velocityOrVal = data.length > 2 ? data[2] : 0;

    const isDrum =
      this.drumChannel === 0 ||
      channel === this.drumChannel ||
      (channel === 10 && (this.drumChannel === 10 || this.drumChannel === 0));

    // Note On
    if (command === 0x9 && velocityOrVal > 0) {
      const shiftedMidi = isDrum
        ? noteOrCC
        : Math.max(12, Math.min(127, noteOrCC + this.octaveShift * 12));
      const noteName = midiToNote(shiftedMidi);
      if (!noteName) return;

      const rawVel = velocityOrVal;
      const velocity = rawVel / 127;
      this.heldNotes.add(noteName);
      this.sustainedNotes.delete(noteName);

      const noteEvent: MidiNoteEvent = {
        noteName,
        midiNumber: shiftedMidi,
        velocity,
        rawVelocity: rawVel,
        channel,
        isDrum,
        type: "on",
        deviceId,
        timestamp: Date.now(),
      };

      this.logActivity(
        "noteOn",
        `${noteName} (${shiftedMidi})`,
        channel,
        `Vel: ${rawVel}`,
        isDrum,
      );

      this.noteOnListeners.forEach((cb) => cb(noteEvent));
      return;
    }

    // Note Off (or Note On with velocity 0)
    if (command === 0x8 || (command === 0x9 && velocityOrVal === 0)) {
      const shiftedMidi = isDrum
        ? noteOrCC
        : Math.max(12, Math.min(127, noteOrCC + this.octaveShift * 12));
      const noteName = midiToNote(shiftedMidi);
      if (!noteName) return;

      this.heldNotes.delete(noteName);

      if (!isDrum && this.sustainPedal) {
        this.sustainedNotes.add(noteName);
      } else {
        const noteEvent: MidiNoteEvent = {
          noteName,
          midiNumber: shiftedMidi,
          velocity: 0,
          rawVelocity: 0,
          channel,
          isDrum,
          type: "off",
          deviceId,
          timestamp: Date.now(),
        };

        this.logActivity(
          "noteOff",
          `${noteName} (${shiftedMidi})`,
          channel,
          "Off",
          isDrum,
        );

        this.noteOffListeners.forEach((cb) => cb(noteEvent));
      }
      return;
    }

    // Control Change (CC)
    if (command === 0xb) {
      const controller = noteOrCC;
      const value = velocityOrVal;
      const normalizedValue = value / 127;
      const ccName = CC_NAMES[controller] || `CC ${controller}`;

      // Handle Sustain Pedal (CC 64)
      if (controller === 64) {
        const isDown = value >= 64;
        if (this.sustainPedal !== isDown) {
          this.sustainPedal = isDown;
          this.sustainListeners.forEach((cb) => cb(isDown));

          if (!isDown) {
            this.sustainedNotes.forEach((noteName) => {
              const midiNum = noteToMidi(noteName) ?? 60;
              const offEvent: MidiNoteEvent = {
                noteName,
                midiNumber: midiNum,
                velocity: 0,
                rawVelocity: 0,
                channel,
                isDrum: false,
                type: "off",
                deviceId,
                timestamp: Date.now(),
              };
              this.noteOffListeners.forEach((cb) => cb(offEvent));
            });
            this.sustainedNotes.clear();
          }
        }
      }

      // Handle All Notes Off (CC 123) or All Sound Off (CC 120)
      if (controller === 123 || controller === 120) {
        this.panic();
      }

      const ccEvent: MidiCCEvent = {
        controller,
        value,
        normalizedValue,
        channel,
        name: ccName,
        deviceId,
        timestamp: Date.now(),
      };

      this.logActivity("cc", ccName, channel, `${value}`, false);
      this.ccListeners.forEach((cb) => cb(ccEvent));
      return;
    }

    // Pitch Bend
    if (command === 0xe) {
      const raw14Bit = (velocityOrVal << 7) | noteOrCC;
      const normalized = (raw14Bit - 8192) / 8192;
      const semitones = normalized * 2.0;

      const bendEvent: MidiPitchBendEvent = {
        value: normalized,
        semitones,
        channel,
        deviceId,
        timestamp: Date.now(),
      };

      this.logActivity(
        "pitchBend",
        "Pitch Bend",
        channel,
        `${semitones > 0 ? "+" : ""}${semitones.toFixed(2)} st`,
        false,
      );

      this.pitchBendListeners.forEach((cb) => cb(bendEvent));
    }
  }

  public panic(): void {
    this.heldNotes.clear();
    this.sustainedNotes.clear();
    this.sustainPedal = false;
    this.sustainListeners.forEach((cb) => cb(false));
  }

  public onNoteOn(listener: (e: MidiNoteEvent) => void): () => void {
    this.noteOnListeners.add(listener);
    return () => this.noteOnListeners.delete(listener);
  }

  public onNoteOff(listener: (e: MidiNoteEvent) => void): () => void {
    this.noteOffListeners.add(listener);
    return () => this.noteOffListeners.delete(listener);
  }

  public onControlChange(listener: (e: MidiCCEvent) => void): () => void {
    this.ccListeners.add(listener);
    return () => this.ccListeners.delete(listener);
  }

  public onPitchBend(listener: (e: MidiPitchBendEvent) => void): () => void {
    this.pitchBendListeners.add(listener);
    return () => this.pitchBendListeners.delete(listener);
  }

  public onDevicesChange(listener: (devices: MidiDeviceInfo[]) => void): () => void {
    this.devicesListeners.add(listener);
    return () => this.devicesListeners.delete(listener);
  }

  public onActivity(listener: (activity: MidiActivityItem[]) => void): () => void {
    this.activityListeners.add(listener);
    return () => this.activityListeners.delete(listener);
  }

  public onSustainChange(listener: (isDown: boolean) => void): () => void {
    this.sustainListeners.add(listener);
    return () => this.sustainListeners.delete(listener);
  }

  private notifyDevicesChange(): void {
    const devices = this.getDevices();
    this.devicesListeners.forEach((cb) => cb(devices));
  }
}

export const midiManager = new WebMidiManager();
