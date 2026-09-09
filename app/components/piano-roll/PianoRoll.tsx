import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  generate10OctavesNotes,
  TOTAL_OCTAVES,
  MAX_OCTAVE,
  ROW_HEIGHT,
  VERTICAL_WHITE_KEYS,
  VERTICAL_BLACK_KEYS,
  ROOT_KEYS,
  SCALES,
  isNoteInKey,
  transposeNote,
  PATTERN_PRESETS,
  PIANO_PATTERN_PRESETS,
  DRUM_PATTERN_PRESETS,
  type ScaleType,
  getTargetNoteForPreset,
  getPresetJumpConfig,
  getRootKeySemitoneDelta,
  snapNoteToScale,
} from "./types";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Dropdown } from "../design-system/Dropdown";
import { Card } from "../design-system/Card";
import { Label, Caption, Title } from "../design-system/Typography";
import { cn } from "../../lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Trash2,
  VolumeX,
  Volume2,
  X,
  Copy,
  CheckSquare,
} from "lucide-react";

export interface PianoRollProps {
  className?: string;
  initialActiveNotes?: string[];
  activeNotes?: string[];
  onNotesChange?: (activeNotes: string[]) => void;
  disabledNotes?: string[];
  onDisabledNotesChange?: (disabledNotes: string[]) => void;
  selectedNotes?: string[];
  onSelectedNotesChange?: (selectedNotes: string[]) => void;
  noteVelocities?: Record<string, number>;
  onNoteVelocitiesChange?: (velocities: Record<string, number>) => void;
  onNoteVelocityChange?: (noteKey: string, velocity: number) => void;
  currentStep?: number | null;
  isPlaying?: boolean;
  isRecording?: boolean;
  totalSteps?: number;
  onTotalStepsChange?: (steps: number) => void;
  timeSignature?: "4/4" | "3/4" | "triplet";
  jumpOctave?: number;
  onJumpOctaveChange?: (octave: number) => void;
  velocity?: number;
  onVelocityChange?: (velocity: number) => void;
  selectedPreset?: string;
  externalPressedKeys?: string[];
  rootKey?: string;
  onRootKeyChange?: (rootKey: string) => void;
  scale?: ScaleType;
  onScaleChange?: (scale: ScaleType) => void;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  className,
  initialActiveNotes,
  activeNotes: controlledActiveNotes,
  onNotesChange,
  disabledNotes: controlledDisabledNotes,
  onDisabledNotesChange,
  selectedNotes: controlledSelectedNotes,
  onSelectedNotesChange,
  noteVelocities: controlledNoteVelocities,
  onNoteVelocitiesChange,
  onNoteVelocityChange,
  currentStep = null,
  isPlaying = false,
  isRecording = false,
  totalSteps: controlledTotalSteps,
  onTotalStepsChange: _onTotalStepsChange,
  timeSignature = "4/4",
  jumpOctave: controlledJumpOctave,
  onJumpOctaveChange: _onJumpOctaveChange,
  velocity: controlledVelocity,
  onVelocityChange: _onVelocityChange,
  selectedPreset = "grand_piano",
  externalPressedKeys = [],
  rootKey: controlledRootKey,
  onRootKeyChange,
  scale: controlledScale,
  onScaleChange,
}) => {
  const notes = useMemo(() => generate10OctavesNotes(), []);
  const noteNameToIndex = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach((n, idx) => map.set(n.fullName, idx));
    return map;
  }, [notes]);
  const containerRef = useRef<HTMLDivElement>(null);
  const externalPressedKeysSet = useMemo(
    () => new Set(externalPressedKeys),
    [externalPressedKeys],
  );
  const jumpConfig = useMemo(
    () => getPresetJumpConfig(selectedPreset),
    [selectedPreset],
  );
  const [, setInternalJumpOctave] = useState<number>(
    jumpConfig.defaultOctave,
  );

  const [internalVelocity] = useState(85);
  const velocity = controlledVelocity ?? internalVelocity;

  const [internalNoteVelocities, setInternalNoteVelocities] = useState<
    Record<string, number>
  >(() => ({
    "C3-0": 85,
    "C4-0": 95,
    "E4-0": 80,
    "G4-0": 88,
    "C4-2": 90,
    "E4-2": 82,
    "G4-2": 85,
    "G2-4": 85,
  }));
  const noteVelocities = controlledNoteVelocities ?? internalNoteVelocities;

  const updateNoteVelocities = useCallback(
    (next: Record<string, number>) => {
      setInternalNoteVelocities(next);
      if (onNoteVelocitiesChange) {
        onNoteVelocitiesChange(next);
      }
    },
    [onNoteVelocitiesChange],
  );

  const handleNoteVelocityChange = useCallback(
    (noteKey: string, val: number) => {
      const clamped = Math.max(5, Math.min(100, Math.round(val)));
      const next = { ...noteVelocities, [noteKey]: clamped };
      updateNoteVelocities(next);
      if (onNoteVelocityChange) {
        onNoteVelocityChange(noteKey, clamped);
      }
    },
    [noteVelocities, updateNoteVelocities, onNoteVelocityChange],
  );

  const [velocityPopoverNote, setVelocityPopoverNote] = useState<string | null>(
    null,
  );
  const [isDraggingSlider, setIsDraggingSlider] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingSlider(null);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    if (!velocityPopoverNote) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-velocity-popover="true"]')) {
        return;
      }

      const noteCell = target.closest("[data-note-key]");
      if (
        noteCell &&
        noteCell.getAttribute("data-note-key") === velocityPopoverNote
      ) {
        return;
      }

      setVelocityPopoverNote(null);
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
    };
  }, [velocityPopoverNote]);

  const [internalTotalSteps] = useState(16);
  const totalSteps = controlledTotalSteps ?? internalTotalSteps;

  const groupSize =
    timeSignature === "triplet"
      ? 3
      : timeSignature === "3/4"
        ? 4
        : totalSteps === 12 || totalSteps === 24
          ? 3
          : 4;
  const [internalRootKey, setInternalRootKey] = useState("C");
  const rootKey = controlledRootKey ?? internalRootKey;
  const [internalScale, setInternalScale] = useState<ScaleType>("major");
  const scale = controlledScale ?? internalScale;
  const [lastLoadedPatternId, setLastLoadedPatternId] = useState<string | null>(null);

  const prevRootKeyRef = useRef(rootKey);
  const prevScaleRef = useRef(scale);

  const [internalActiveNotes, setInternalActiveNotes] = useState<Set<string>>(
    () => {
      if (initialActiveNotes) {
        return new Set(initialActiveNotes);
      }
      return new Set([
        "C3-0",
        "C4-0",
        "E4-0",
        "G4-0",
        "C4-2",
        "E4-2",
        "G4-2",
        "G2-4",
        "G3-4",
        "B3-4",
        "D4-4",
        "G3-6",
        "B3-6",
        "D4-6",
        "A2-8",
        "A3-8",
        "C4-8",
        "E4-8",
        "A3-10",
        "C4-10",
        "E4-10",
        "F2-12",
        "F3-12",
        "A3-12",
        "C4-12",
        "F3-14",
        "A3-14",
        "C4-14",
      ]);
    },
  );

  const activeNotes = useMemo(() => {
    if (controlledActiveNotes !== undefined) {
      return new Set(controlledActiveNotes);
    }
    return internalActiveNotes;
  }, [controlledActiveNotes, internalActiveNotes]);

  const updateNotes = useCallback(
    (next: Set<string>) => {
      if (controlledActiveNotes === undefined) {
        setInternalActiveNotes(next);
      }
      if (onNotesChange) {
        onNotesChange(Array.from(next));
      }
    },
    [controlledActiveNotes, onNotesChange],
  );

  const [internalDisabledNotes, setInternalDisabledNotes] = useState<
    Set<string>
  >(new Set());
  const disabledNotes = useMemo(() => {
    if (controlledDisabledNotes !== undefined) {
      return new Set(controlledDisabledNotes);
    }
    return internalDisabledNotes;
  }, [controlledDisabledNotes, internalDisabledNotes]);

  const updateDisabledNotes = useCallback(
    (next: Set<string>) => {
      if (controlledDisabledNotes === undefined) {
        setInternalDisabledNotes(next);
      }
      if (onDisabledNotesChange) {
        onDisabledNotesChange(Array.from(next));
      }
    },
    [controlledDisabledNotes, onDisabledNotesChange],
  );

  const [internalSelectedNotes, setInternalSelectedNotes] = useState<
    Set<string>
  >(new Set());
  const selectedNotes = useMemo(() => {
    if (controlledSelectedNotes !== undefined) {
      return new Set(controlledSelectedNotes);
    }
    return internalSelectedNotes;
  }, [controlledSelectedNotes, internalSelectedNotes]);

  const updateSelectedNotes = useCallback(
    (next: Set<string>) => {
      if (controlledSelectedNotes === undefined) {
        setInternalSelectedNotes(next);
      }
      if (onSelectedNotesChange) {
        onSelectedNotesChange(Array.from(next));
      }
    },
    [controlledSelectedNotes, onSelectedNotesChange],
  );

  interface DraggedNoteInfo {
    key: string;
    noteName: string;
    step: number;
    row: number;
    velocity: number;
    isDisabled: boolean;
  }

  interface NoteDragState {
    isDragging: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
    currentX: number;
    currentY: number;
    stepWidth: number;
    cellHeight: number;
    primaryNoteKey: string;
    primaryRow: number;
    primaryStep: number;
    draggedNotes: DraggedNoteInfo[];
    deltaStep: number;
    deltaRow: number;
    isCopy: boolean;
  }

  interface MarqueeBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
    initialSelected: Set<string>;
  }

  const [noteDrag, setNoteDrag] = useState<NoteDragState | null>(null);
  const noteDragRef = useRef<NoteDragState | null>(null);
  useEffect(() => {
    noteDragRef.current = noteDrag;
  }, [noteDrag]);

  const activeNotesRef = useRef(activeNotes);
  useEffect(() => {
    activeNotesRef.current = activeNotes;
  }, [activeNotes]);

  const disabledNotesRef = useRef(disabledNotes);
  useEffect(() => {
    disabledNotesRef.current = disabledNotes;
  }, [disabledNotes]);

  const selectedNotesRef = useRef(selectedNotes);
  useEffect(() => {
    selectedNotesRef.current = selectedNotes;
  }, [selectedNotes]);

  const noteVelocitiesRef = useRef(noteVelocities);
  useEffect(() => {
    noteVelocitiesRef.current = noteVelocities;
  }, [noteVelocities]);

  const velocityRef = useRef(velocity);
  useEffect(() => {
    velocityRef.current = velocity;
  }, [velocity]);

  const totalStepsRef = useRef(totalSteps);
  useEffect(() => {
    totalStepsRef.current = totalSteps;
  }, [totalSteps]);

  const { draggedOriginalKeysSet, dragPreviewNotesMap } = useMemo(() => {
    if (!noteDrag || !noteDrag.isDragging) {
      return {
        draggedOriginalKeysSet: new Set<string>(),
        dragPreviewNotesMap: new Map<
          string,
          {
            originalKey: string;
            noteName: string;
            step: number;
            velocity: number;
            isDisabled: boolean;
          }
        >(),
      };
    }

    const draggedOriginalKeysSet = new Set<string>(
      noteDrag.draggedNotes.map((n) => n.key),
    );
    const dragPreviewNotesMap = new Map<
      string,
      {
        originalKey: string;
        noteName: string;
        step: number;
        velocity: number;
        isDisabled: boolean;
      }
    >();

    noteDrag.draggedNotes.forEach((item) => {
      const newRow = item.row + noteDrag.deltaRow;
      const newStep = item.step + noteDrag.deltaStep;
      if (
        newRow >= 0 &&
        newRow < notes.length &&
        newStep >= 0 &&
        newStep < totalSteps
      ) {
        const targetNoteName = notes[newRow].fullName;
        const targetKey = `${targetNoteName}-${newStep}`;
        dragPreviewNotesMap.set(targetKey, {
          originalKey: item.key,
          noteName: targetNoteName,
          step: newStep,
          velocity: item.velocity,
          isDisabled: item.isDisabled,
        });
      }
    });

    return { draggedOriginalKeysSet, dragPreviewNotesMap };
  }, [noteDrag, notes, totalSteps]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    noteKey?: string;
  } | null>(null);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const marqueeRef = useRef<MarqueeBox | null>(null);
  useEffect(() => {
    marqueeRef.current = marquee;
  }, [marquee]);
  const dragStartClientRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, button, [data-velocity-popover]")) return;

      const activeCellEl = target.closest<HTMLElement>(
        '[data-active-note="true"]',
      );
      if (activeCellEl) {
        const noteKey = activeCellEl.getAttribute("data-note-key");
        if (!noteKey) return;

        const lastDash = noteKey.lastIndexOf("-");
        if (lastDash === -1) return;
        const noteName = noteKey.slice(0, lastDash);
        const step = parseInt(noteKey.slice(lastDash + 1), 10);
        const row = noteNameToIndex.get(noteName);
        if (row === undefined) return;

        let targetKeys: string[];
        if (selectedNotes.has(noteKey)) {
          targetKeys = Array.from(selectedNotes);
        } else if (e.shiftKey) {
          targetKeys = Array.from(new Set([...selectedNotes, noteKey]));
        } else {
          targetKeys = [noteKey];
        }

        const draggedNotes: DraggedNoteInfo[] = [];
        for (const key of targetKeys) {
          const dash = key.lastIndexOf("-");
          if (dash === -1) continue;
          const nName = key.slice(0, dash);
          const nStep = parseInt(key.slice(dash + 1), 10);
          const nRow = noteNameToIndex.get(nName);
          if (nRow === undefined) continue;
          draggedNotes.push({
            key,
            noteName: nName,
            step: nStep,
            row: nRow,
            velocity: noteVelocities[key] ?? velocity,
            isDisabled: disabledNotes.has(key),
          });
        }

        const cellRect = activeCellEl.getBoundingClientRect();
        const stepWidth = cellRect.width || 80;
        const cellHeight = cellRect.height || ROW_HEIGHT;
        const scrollContainer = containerRef.current;

        const initialDragState: NoteDragState = {
          isDragging: false,
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: scrollContainer ? scrollContainer.scrollLeft : 0,
          startScrollTop: scrollContainer ? scrollContainer.scrollTop : 0,
          currentX: e.clientX,
          currentY: e.clientY,
          stepWidth,
          cellHeight,
          primaryNoteKey: noteKey,
          primaryRow: row,
          primaryStep: step,
          draggedNotes,
          deltaStep: 0,
          deltaRow: 0,
          isCopy: e.altKey,
        };

        dragStartClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        noteDragRef.current = initialDragState;
        setNoteDrag(initialDragState);
        return;
      }

      const rect = container.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      dragStartClientRef.current = { clientX: e.clientX, clientY: e.clientY };
      const initialSelected = e.shiftKey
        ? new Set(selectedNotes)
        : new Set<string>();

      setMarquee({
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        isDragging: false,
        initialSelected,
      });
    };

    const onCtxMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, button")) return;
      e.preventDefault();
      e.stopPropagation();

      const menuWidth = 190;
      const menuHeight = 240;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

      setContextMenu({ x, y });
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("contextmenu", onCtxMenu);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("contextmenu", onCtxMenu);
    };
  }, [selectedNotes, noteNameToIndex, noteVelocities, velocity, disabledNotes]);

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (noteDragRef.current) {
        const drag = noteDragRef.current;
        const scrollContainer = containerRef.current;
        const currentScrollLeft = scrollContainer
          ? scrollContainer.scrollLeft
          : 0;
        const currentScrollTop = scrollContainer
          ? scrollContainer.scrollTop
          : 0;

        const deltaX =
          e.clientX - drag.startX + (currentScrollLeft - drag.startScrollLeft);
        const deltaY =
          e.clientY - drag.startY + (currentScrollTop - drag.startScrollTop);
        const dist = Math.hypot(
          e.clientX - drag.startX,
          e.clientY - drag.startY,
        );

        if (!drag.isDragging && dist > 4) {
          setVelocityPopoverNote(null);
          if (
            !selectedNotesRef.current.has(drag.primaryNoteKey) &&
            !e.shiftKey
          ) {
            updateSelectedNotes(new Set([drag.primaryNoteKey]));
          }
          document.body.style.cursor = "grabbing";
        }

        if (drag.isDragging || dist > 4) {
          if (scrollContainer) {
            const cRect = scrollContainer.getBoundingClientRect();
            if (e.clientY < cRect.top + 36) {
              scrollContainer.scrollTop -= 8;
            } else if (e.clientY > cRect.bottom - 36) {
              scrollContainer.scrollTop += 8;
            }
            if (e.clientX < cRect.left + 36) {
              scrollContainer.scrollLeft -= 10;
            } else if (e.clientX > cRect.right - 36) {
              scrollContainer.scrollLeft += 10;
            }
          }

          const rawDeltaStep = Math.round(deltaX / drag.stepWidth);
          const rawDeltaRow = Math.round(deltaY / drag.cellHeight);

          const minStep = Math.min(...drag.draggedNotes.map((n) => n.step));
          const maxStep = Math.max(...drag.draggedNotes.map((n) => n.step));
          const minDeltaStep = -minStep;
          const maxDeltaStep = totalStepsRef.current - 1 - maxStep;
          const clampedDeltaStep = Math.max(
            minDeltaStep,
            Math.min(maxDeltaStep, rawDeltaStep),
          );

          const minRow = Math.min(...drag.draggedNotes.map((n) => n.row));
          const maxRow = Math.max(...drag.draggedNotes.map((n) => n.row));
          const minDeltaRow = -minRow;
          const maxDeltaRow = notes.length - 1 - maxRow;
          const clampedDeltaRow = Math.max(
            minDeltaRow,
            Math.min(maxDeltaRow, rawDeltaRow),
          );

          if (clampedDeltaRow !== drag.deltaRow) {
            const primaryTargetRow = drag.primaryRow + clampedDeltaRow;
            if (primaryTargetRow >= 0 && primaryTargetRow < notes.length) {
              const targetNoteName = notes[primaryTargetRow].fullName;
              const vel =
                (noteVelocitiesRef.current[drag.primaryNoteKey] ??
                  velocityRef.current) / 100;
              synth.playNote(targetNoteName, undefined, 0.2, vel);
            }
          }

          const nextState: NoteDragState = {
            ...drag,
            isDragging: true,
            currentX: e.clientX,
            currentY: e.clientY,
            deltaStep: clampedDeltaStep,
            deltaRow: clampedDeltaRow,
            isCopy: e.altKey,
          };

          noteDragRef.current = nextState;
          setNoteDrag(nextState);
        }
        return;
      }

      if (
        !dragStartClientRef.current ||
        !gridContainerRef.current ||
        !marqueeRef.current
      )
        return;

      const startClient = dragStartClientRef.current;
      const dist = Math.hypot(
        e.clientX - startClient.clientX,
        e.clientY - startClient.clientY,
      );

      if (dist > 4) {
        const container = gridContainerRef.current;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const m = marqueeRef.current;
        const mLeft = Math.min(m.startX, currentX);
        const mRight = Math.max(m.startX, currentX);
        const mTop = Math.min(m.startY, currentY);
        const mBottom = Math.max(m.startY, currentY);

        const nextSelected = new Set(m.initialSelected);
        const activeElements = container.querySelectorAll<HTMLElement>(
          '[data-active-note="true"]',
        );
        activeElements.forEach((el) => {
          const noteKey = el.getAttribute("data-note-key");
          if (!noteKey) return;
          const elRect = el.getBoundingClientRect();
          const elLeft = elRect.left - rect.left;
          const elTop = elRect.top - rect.top;
          const elRight = elRect.right - rect.left;
          const elBottom = elRect.bottom - rect.top;

          const overlaps = !(
            elRight < mLeft ||
            elLeft > mRight ||
            elBottom < mTop ||
            elTop > mBottom
          );

          if (overlaps) {
            nextSelected.add(noteKey);
          }
        });

        setMarquee({
          ...m,
          currentX,
          currentY,
          isDragging: true,
        });

        updateSelectedNotes(nextSelected);
      }
    };

    const handleWindowMouseUp = () => {
      document.body.style.cursor = "";

      if (noteDragRef.current) {
        const drag = noteDragRef.current;
        if (drag.isDragging) {
          wasDraggingRef.current = true;
          setTimeout(() => {
            wasDraggingRef.current = false;
          }, 60);

          const hasMoved = drag.deltaStep !== 0 || drag.deltaRow !== 0;
          if (hasMoved || drag.isCopy) {
            const nextActive = new Set(activeNotesRef.current);
            const nextDisabled = new Set(disabledNotesRef.current);
            const nextVelocities = { ...noteVelocitiesRef.current };
            const nextSelected = new Set<string>();

            if (!drag.isCopy) {
              drag.draggedNotes.forEach((item) => {
                nextActive.delete(item.key);
                nextDisabled.delete(item.key);
                delete nextVelocities[item.key];
              });
            }

            drag.draggedNotes.forEach((item) => {
              const newRow = item.row + drag.deltaRow;
              const newStep = item.step + drag.deltaStep;
              if (
                newRow >= 0 &&
                newRow < notes.length &&
                newStep >= 0 &&
                newStep < totalStepsRef.current
              ) {
                const newNoteName = notes[newRow].fullName;
                const newKey = `${newNoteName}-${newStep}`;

                nextActive.add(newKey);
                if (item.isDisabled) {
                  nextDisabled.add(newKey);
                }
                nextVelocities[newKey] = item.velocity;
                nextSelected.add(newKey);
              }
            });

            updateNotes(nextActive);
            updateDisabledNotes(nextDisabled);
            updateNoteVelocities(nextVelocities);
            updateSelectedNotes(nextSelected);

            const primaryTargetRow = drag.primaryRow + drag.deltaRow;
            if (primaryTargetRow >= 0 && primaryTargetRow < notes.length) {
              const targetNoteName = notes[primaryTargetRow].fullName;
              const vel =
                (noteVelocitiesRef.current[drag.primaryNoteKey] ??
                  velocityRef.current) / 100;
              synth.playNote(targetNoteName, undefined, 0.35, vel);
            }
          }
        }

        dragStartClientRef.current = null;
        noteDragRef.current = null;
        setNoteDrag(null);
        return;
      }

      if (marqueeRef.current) {
        if (marqueeRef.current.isDragging) {
          wasDraggingRef.current = true;
          setTimeout(() => {
            wasDraggingRef.current = false;
          }, 50);
        }
        dragStartClientRef.current = null;
        setMarquee(null);
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [
    updateSelectedNotes,
    notes,
    updateNotes,
    updateDisabledNotes,
    updateNoteVelocities,
  ]);

  const handleNoteClick = useCallback(
    (noteKey: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (wasDraggingRef.current) return;

      setVelocityPopoverNote(noteKey);

      if (e.shiftKey) {
        const nextSelected = new Set(selectedNotes);
        if (nextSelected.has(noteKey)) {
          nextSelected.delete(noteKey);
        } else {
          nextSelected.add(noteKey);
        }
        updateSelectedNotes(nextSelected);
      } else {
        updateSelectedNotes(new Set([noteKey]));
      }
    },
    [selectedNotes, updateSelectedNotes],
  );

  const handleNoteDoubleClick = useCallback(
    (noteKey: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (velocityPopoverNote === noteKey) {
        setVelocityPopoverNote(null);
      }
      const nextActive = new Set(activeNotes);
      nextActive.delete(noteKey);
      updateNotes(nextActive);

      if (disabledNotes.has(noteKey)) {
        const nextDisabled = new Set(disabledNotes);
        nextDisabled.delete(noteKey);
        updateDisabledNotes(nextDisabled);
      }

      if (selectedNotes.has(noteKey)) {
        const nextSelected = new Set(selectedNotes);
        nextSelected.delete(noteKey);
        updateSelectedNotes(nextSelected);
      }

      if (noteVelocities[noteKey] !== undefined) {
        const nextVel = { ...noteVelocities };
        delete nextVel[noteKey];
        updateNoteVelocities(nextVel);
      }
    },
    [
      velocityPopoverNote,
      activeNotes,
      disabledNotes,
      selectedNotes,
      noteVelocities,
      updateNotes,
      updateDisabledNotes,
      updateSelectedNotes,
      updateNoteVelocities,
    ],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, targetNoteKey?: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (targetNoteKey) {
        if (!selectedNotes.has(targetNoteKey)) {
          updateSelectedNotes(new Set([targetNoteKey]));
        }
      }

      const menuWidth = 190;
      const menuHeight = 240;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

      setContextMenu({ x, y, noteKey: targetNoteKey });
    },
    [selectedNotes, updateSelectedNotes, setContextMenu],
  );

  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleOutside);
    window.addEventListener("contextmenu", handleOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutside);
      window.removeEventListener("contextmenu", handleOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const handleCellClick = useCallback(
    (noteFullName: string, stepIndex: number) => {
      if (wasDraggingRef.current) return;
      const noteKey = `${noteFullName}-${stepIndex}`;
      if (activeNotes.has(noteKey)) return;

      const nextActive = new Set(activeNotes);
      nextActive.add(noteKey);
      updateNotes(nextActive);

      if (disabledNotes.has(noteKey)) {
        const nextDisabled = new Set(disabledNotes);
        nextDisabled.delete(noteKey);
        updateDisabledNotes(nextDisabled);
      }

      updateSelectedNotes(new Set([noteKey]));

      const noteVel = noteVelocities[noteKey] ?? velocity;
      handleNoteVelocityChange(noteKey, noteVel);
      const vel = noteVel / 100;
      const sustainSec = 0.8 + 1.2 * vel;
      synth.playNote(noteFullName, undefined, sustainSec, vel);
    },
    [
      activeNotes,
      disabledNotes,
      noteVelocities,
      velocity,
      updateNotes,
      updateDisabledNotes,
      updateSelectedNotes,
      handleNoteVelocityChange,
    ],
  );

  const duplicateSelectedNotes = useCallback(() => {
    if (selectedNotes.size === 0) return;
    const nextActive = new Set(activeNotes);
    const newSelected = new Set<string>();
    const nextVelocities = { ...noteVelocities };

    selectedNotes.forEach((key) => {
      const [noteName, stepStr] = key.split("-");
      const step = parseInt(stepStr, 10);
      const targetStep = (step + 1) % totalSteps;
      const newKey = `${noteName}-${targetStep}`;
      nextActive.add(newKey);
      newSelected.add(newKey);
      if (noteVelocities[key] !== undefined) {
        nextVelocities[newKey] = noteVelocities[key];
      }
    });

    updateNotes(nextActive);
    updateSelectedNotes(newSelected);
    updateNoteVelocities(nextVelocities);
    setContextMenu(null);
  }, [
    selectedNotes,
    activeNotes,
    noteVelocities,
    totalSteps,
    updateNotes,
    updateSelectedNotes,
    updateNoteVelocities,
    setContextMenu,
  ]);

  const selectAllNotes = useCallback(() => {
    updateSelectedNotes(new Set(activeNotes));
    setContextMenu(null);
  }, [activeNotes, updateSelectedNotes, setContextMenu]);

  const clearSelection = useCallback(() => {
    updateSelectedNotes(new Set());
    setContextMenu(null);
  }, [updateSelectedNotes, setContextMenu]);

  const deleteSelectedNotes = useCallback(() => {
    if (selectedNotes.size === 0) return;
    const nextActive = new Set(activeNotes);
    const nextDisabled = new Set(disabledNotes);
    const nextVelocities = { ...noteVelocities };

    selectedNotes.forEach((key) => {
      nextActive.delete(key);
      nextDisabled.delete(key);
      delete nextVelocities[key];
    });

    updateNotes(nextActive);
    updateDisabledNotes(nextDisabled);
    updateNoteVelocities(nextVelocities);
    updateSelectedNotes(new Set());
    setVelocityPopoverNote(null);
  }, [
    selectedNotes,
    activeNotes,
    disabledNotes,
    noteVelocities,
    updateNotes,
    updateDisabledNotes,
    updateNoteVelocities,
    updateSelectedNotes,
  ]);

  const toggleDisabledSelectedNotes = useCallback(() => {
    if (selectedNotes.size === 0) return;
    const nextDisabled = new Set(disabledNotes);
    const allDisabled = Array.from(selectedNotes).every((key) =>
      nextDisabled.has(key),
    );

    selectedNotes.forEach((key) => {
      if (allDisabled) {
        nextDisabled.delete(key);
      } else {
        nextDisabled.add(key);
      }
    });

    updateDisabledNotes(nextDisabled);
  }, [selectedNotes, disabledNotes, updateDisabledNotes]);

  const transposeSelectedOrAll = useCallback(
    (semitones: number) => {
      const targetSet = selectedNotes.size > 0 ? selectedNotes : activeNotes;
      if (targetSet.size === 0) return;
      const next = new Set<string>(activeNotes);
      const nextDisabled = new Set<string>(disabledNotes);
      const nextSelected = new Set<string>();
      const nextVelocities: Record<string, number> = { ...noteVelocities };

      for (const item of targetSet) {
        next.delete(item);
        const wasDisabled = nextDisabled.delete(item);
        const wasSelected = selectedNotes.has(item);
        const vel = nextVelocities[item];
        delete nextVelocities[item];

        const lastDash = item.lastIndexOf("-");
        if (lastDash === -1) continue;
        const noteName = item.slice(0, lastDash);
        const step = item.slice(lastDash + 1);
        const transposed = transposeNote(noteName, semitones);
        const newKey = `${transposed}-${step}`;
        next.add(newKey);
        if (wasDisabled) nextDisabled.add(newKey);
        if (wasSelected) nextSelected.add(newKey);
        if (vel !== undefined) nextVelocities[newKey] = vel;
      }
      updateNoteVelocities(nextVelocities);
      updateDisabledNotes(nextDisabled);
      if (selectedNotes.size > 0) {
        updateSelectedNotes(nextSelected);
      }
      updateNotes(next);
    },
    [
      activeNotes,
      disabledNotes,
      selectedNotes,
      noteVelocities,
      updateNotes,
      updateDisabledNotes,
      updateSelectedNotes,
      updateNoteVelocities,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (velocityPopoverNote) {
          e.preventDefault();
          setVelocityPopoverNote(null);
          return;
        }
        if (noteDragRef.current?.isDragging) {
          e.preventDefault();
          document.body.style.cursor = "";
          dragStartClientRef.current = null;
          noteDragRef.current = null;
          setNoteDrag(null);
          return;
        }
        if (selectedNotes.size > 0) {
          e.preventDefault();
          updateSelectedNotes(new Set());
          return;
        }
      }

      if (e.key === "Alt" && noteDragRef.current?.isDragging) {
        noteDragRef.current = { ...noteDragRef.current, isCopy: true };
        setNoteDrag((prev) => (prev ? { ...prev, isCopy: true } : null));
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNotes.size > 0) {
          e.preventDefault();
          deleteSelectedNotes();
        }
      } else if (
        e.key === "d" ||
        e.key === "D" ||
        e.key === "m" ||
        e.key === "M"
      ) {
        if (selectedNotes.size > 0) {
          e.preventDefault();
          toggleDisabledSelectedNotes();
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        updateSelectedNotes(new Set(activeNotes));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt" && noteDragRef.current?.isDragging) {
        noteDragRef.current = { ...noteDragRef.current, isCopy: false };
        setNoteDrag((prev) => (prev ? { ...prev, isCopy: false } : null));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    velocityPopoverNote,
    selectedNotes,
    activeNotes,
    deleteSelectedNotes,
    toggleDisabledSelectedNotes,
    updateSelectedNotes,
  ]);

  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const octavesList = useMemo(() => {
    return Array.from({ length: TOTAL_OCTAVES }, (_, i) => MAX_OCTAVE - i);
  }, []);

  const activePitches = useMemo(() => {
    const pitches = new Set<string>();
    for (const item of activeNotes) {
      const parts = item.split("-");
      if (parts.length >= 2) {
        pitches.add(parts[0]);
      }
    }
    return pitches;
  }, [activeNotes]);

  const scrollToNote = useCallback((targetNote: string, smooth = true) => {
    const container = containerRef.current;
    if (!container) return;
    const el = document.getElementById(`piano-roll-row-${targetNote}`);
    if (el) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop =
        relativeTop - container.clientHeight / 2 + targetRect.height / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const scrollToOctave = useCallback(
    (octave: number, smooth = true) => {
      scrollToNote(`C${octave}`, smooth);
    },
    [scrollToNote],
  );


  useEffect(() => {
    if (controlledJumpOctave !== undefined) {
      scrollToOctave(controlledJumpOctave);
    }
  }, [controlledJumpOctave, scrollToOctave]);

  const isFirstRender = useRef(true);

  useEffect(() => {
    const targetNote = getTargetNoteForPreset(selectedPreset);
    const timeout = setTimeout(() => {
      setInternalJumpOctave(jumpConfig.defaultOctave);
      scrollToNote(targetNote, !isFirstRender.current);
      isFirstRender.current = false;
    }, 60);

    return () => clearTimeout(timeout);
  }, [selectedPreset, jumpConfig.defaultOctave, scrollToNote]);

  const handleKeyClick = (noteFullName: string) => {
    setPressedKey(noteFullName);
    const vel = velocity / 100;
    const sustainSec = 0.8 + 1.2 * vel;
    synth.playNote(noteFullName, undefined, sustainSec, vel);
    setTimeout(() => {
      setPressedKey((current) => (current === noteFullName ? null : current));
    }, 180);
  };

  const shiftNotes = (offset: number) => {
    const next = new Set<string>();
    const nextDisabled = new Set<string>();
    const nextSelected = new Set<string>();
    const nextVelocities: Record<string, number> = {};
    for (const item of activeNotes) {
      const lastDash = item.lastIndexOf("-");
      if (lastDash === -1) continue;
      const noteName = item.slice(0, lastDash);
      const step = parseInt(item.slice(lastDash + 1), 10);
      const newStep = (step + offset + totalSteps) % totalSteps;
      const newKey = `${noteName}-${newStep}`;
      next.add(newKey);
      if (disabledNotes.has(item)) nextDisabled.add(newKey);
      if (selectedNotes.has(item)) nextSelected.add(newKey);
      nextVelocities[newKey] = noteVelocities[item] ?? velocity;
    }
    updateNoteVelocities(nextVelocities);
    updateDisabledNotes(nextDisabled);
    updateSelectedNotes(nextSelected);
    updateNotes(next);
  };


  const reverseNotes = () => {
    const next = new Set<string>();
    const nextDisabled = new Set<string>();
    const nextSelected = new Set<string>();
    const nextVelocities: Record<string, number> = {};
    for (const item of activeNotes) {
      const lastDash = item.lastIndexOf("-");
      if (lastDash === -1) continue;
      const noteName = item.slice(0, lastDash);
      const step = parseInt(item.slice(lastDash + 1), 10);
      const newStep = totalSteps - 1 - step;
      const newKey = `${noteName}-${newStep}`;
      next.add(newKey);
      if (disabledNotes.has(item)) nextDisabled.add(newKey);
      if (selectedNotes.has(item)) nextSelected.add(newKey);
      nextVelocities[newKey] = noteVelocities[item] ?? velocity;
    }
    updateNoteVelocities(nextVelocities);
    updateDisabledNotes(nextDisabled);
    updateSelectedNotes(nextSelected);
    updateNotes(next);
  };

  const applyRootKeyChange = useCallback(
    (newRootKey: string, oldRootKey: string) => {
      if (newRootKey === oldRootKey) return;
      const delta = getRootKeySemitoneDelta(oldRootKey, newRootKey);

      if (lastLoadedPatternId) {
        const pattern = PATTERN_PRESETS.find((p) => p.id === lastLoadedPatternId);
        if (pattern) {
          const rootIndex = ROOT_KEYS.indexOf(newRootKey as (typeof ROOT_KEYS)[number]);
          const semitoneOffset = rootIndex !== -1 ? rootIndex : 0;
          const next = new Set<string>();
          for (const item of pattern.notes) {
            const lastDash = item.lastIndexOf("-");
            if (lastDash === -1) continue;
            let noteName = item.slice(0, lastDash);
            const step = parseInt(item.slice(lastDash + 1), 10);
            if (step < totalSteps) {
              if (pattern.category === "chord" && semitoneOffset !== 0) {
                noteName = transposeNote(noteName, semitoneOffset);
              }
              if (scale !== "chromatic") {
                noteName = snapNoteToScale(noteName, newRootKey, scale);
              }
              next.add(`${noteName}-${step}`);
            }
          }
          updateDisabledNotes(new Set());
          updateSelectedNotes(new Set());
          updateNotes(next);
        }
      } else if (delta !== 0 && activeNotes.size > 0) {
        const next = new Set<string>();
        const nextDisabled = new Set<string>();
        const nextSelected = new Set<string>();
        const nextVelocities: Record<string, number> = {};

        for (const item of activeNotes) {
          const lastDash = item.lastIndexOf("-");
          if (lastDash === -1) continue;
          const noteName = item.slice(0, lastDash);
          const step = parseInt(item.slice(lastDash + 1), 10);
          const transposed = transposeNote(noteName, delta);
          const newKey = `${transposed}-${step}`;
          next.add(newKey);
          if (disabledNotes.has(item)) nextDisabled.add(newKey);
          if (selectedNotes.has(item)) nextSelected.add(newKey);
          nextVelocities[newKey] = noteVelocities[item] ?? velocity;
        }
        updateNoteVelocities(nextVelocities);
        updateDisabledNotes(nextDisabled);
        updateSelectedNotes(nextSelected);
        updateNotes(next);
      }

      const targetOctave = jumpConfig.defaultOctave;
      scrollToNote(`${newRootKey}${targetOctave}`, true);
    },
    [
      lastLoadedPatternId,
      totalSteps,
      scale,
      activeNotes,
      disabledNotes,
      selectedNotes,
      noteVelocities,
      velocity,
      jumpConfig.defaultOctave,
      scrollToNote,
      updateDisabledNotes,
      updateSelectedNotes,
      updateNotes,
      updateNoteVelocities,
    ],
  );

  const applyScaleChange = useCallback(
    (newScale: ScaleType) => {
      if (lastLoadedPatternId) {
        const pattern = PATTERN_PRESETS.find((p) => p.id === lastLoadedPatternId);
        if (pattern) {
          const rootIndex = ROOT_KEYS.indexOf(rootKey as (typeof ROOT_KEYS)[number]);
          const semitoneOffset = rootIndex !== -1 ? rootIndex : 0;
          const next = new Set<string>();
          for (const item of pattern.notes) {
            const lastDash = item.lastIndexOf("-");
            if (lastDash === -1) continue;
            let noteName = item.slice(0, lastDash);
            const step = parseInt(item.slice(lastDash + 1), 10);
            if (step < totalSteps) {
              if (pattern.category === "chord" && semitoneOffset !== 0) {
                noteName = transposeNote(noteName, semitoneOffset);
              }
              if (newScale !== "chromatic") {
                noteName = snapNoteToScale(noteName, rootKey, newScale);
              }
              next.add(`${noteName}-${step}`);
            }
          }
          updateDisabledNotes(new Set());
          updateSelectedNotes(new Set());
          updateNotes(next);
        }
      } else if (activeNotes.size > 0 && newScale !== "chromatic") {
        const next = new Set<string>();
        const nextDisabled = new Set<string>();
        const nextSelected = new Set<string>();
        const nextVelocities: Record<string, number> = {};

        for (const item of activeNotes) {
          const lastDash = item.lastIndexOf("-");
          if (lastDash === -1) continue;
          const noteName = item.slice(0, lastDash);
          const step = parseInt(item.slice(lastDash + 1), 10);
          const snapped = snapNoteToScale(noteName, rootKey, newScale);
          const newKey = `${snapped}-${step}`;
          next.add(newKey);
          if (disabledNotes.has(item)) nextDisabled.add(newKey);
          if (selectedNotes.has(item)) nextSelected.add(newKey);
          nextVelocities[newKey] = noteVelocities[item] ?? velocity;
        }
        updateNoteVelocities(nextVelocities);
        updateDisabledNotes(nextDisabled);
        updateSelectedNotes(nextSelected);
        updateNotes(next);
      }

      const targetOctave = jumpConfig.defaultOctave;
      scrollToNote(`${rootKey}${targetOctave}`, true);
    },
    [
      lastLoadedPatternId,
      rootKey,
      totalSteps,
      activeNotes,
      disabledNotes,
      selectedNotes,
      noteVelocities,
      velocity,
      jumpConfig.defaultOctave,
      scrollToNote,
      updateDisabledNotes,
      updateSelectedNotes,
      updateNotes,
      updateNoteVelocities,
    ],
  );

  const setRootKey = useCallback(
    (val: string) => {
      const prev = rootKey;
      if (controlledRootKey === undefined) {
        setInternalRootKey(val);
      }
      prevRootKeyRef.current = val;
      if (onRootKeyChange) {
        onRootKeyChange(val);
      }
      applyRootKeyChange(val, prev);
    },
    [controlledRootKey, rootKey, onRootKeyChange, applyRootKeyChange],
  );

  const setScale = useCallback(
    (val: ScaleType) => {
      if (controlledScale === undefined) {
        setInternalScale(val);
      }
      prevScaleRef.current = val;
      if (onScaleChange) {
        onScaleChange(val);
      }
      applyScaleChange(val);
    },
    [controlledScale, onScaleChange, applyScaleChange],
  );

  useEffect(() => {
    if (
      controlledRootKey !== undefined &&
      controlledRootKey !== prevRootKeyRef.current
    ) {
      const oldKey = prevRootKeyRef.current;
      prevRootKeyRef.current = controlledRootKey;
      applyRootKeyChange(controlledRootKey, oldKey);
    }
  }, [controlledRootKey, applyRootKeyChange]);

  useEffect(() => {
    if (
      controlledScale !== undefined &&
      controlledScale !== prevScaleRef.current
    ) {
      prevScaleRef.current = controlledScale;
      applyScaleChange(controlledScale);
    }
  }, [controlledScale, applyScaleChange]);

  const loadPattern = (presetId: string) => {
    const pattern = PATTERN_PRESETS.find((p) => p.id === presetId);
    if (!pattern) return;

    setLastLoadedPatternId(presetId);

    const rootIndex = ROOT_KEYS.indexOf(rootKey as (typeof ROOT_KEYS)[number]);
    const semitoneOffset = rootIndex !== -1 ? rootIndex : 0;

    const next = new Set<string>();
    for (const item of pattern.notes) {
      const lastDash = item.lastIndexOf("-");
      if (lastDash === -1) continue;
      let noteName = item.slice(0, lastDash);
      const step = parseInt(item.slice(lastDash + 1), 10);
      if (step < totalSteps) {
        if (pattern.category === "chord" && semitoneOffset !== 0) {
          noteName = transposeNote(noteName, semitoneOffset);
        }
        if (scale !== "chromatic") {
          noteName = snapNoteToScale(noteName, rootKey, scale);
        }
        next.add(`${noteName}-${step}`);
      }
    }
    updateDisabledNotes(new Set());
    updateSelectedNotes(new Set());
    updateNotes(next);
    if (pattern.category === "drum") {
      scrollToNote("C1", true);
    } else {
      scrollToNote(`${rootKey}${jumpConfig.defaultOctave}`, true);
    }
  };

  const stepWidthClass = "w-18 sm:w-20";

  const numGroups = Math.ceil(totalSteps / groupSize);

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full flex-1 overflow-hidden bg-surface-light dark:bg-surface-dark",
        className,
      )}
    >
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-auto relative bg-surface-light dark:bg-stone-950 select-none"
      >
        <div className="flex flex-col min-w-max w-full">
          <div className="sticky top-0 z-30 flex w-full bg-surface dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 shadow-sm">
            <div className="sticky left-0 z-40 w-32 sm:w-40 flex-shrink-0 bg-surface dark:bg-stone-900 px-3 py-2 border-r-2 border-stone-300 dark:border-stone-700 flex items-center justify-between">
              <Label className="text-[10px] font-mono font-bold text-stone-400">
                PITCH
              </Label>
              <Caption className="text-[10px] font-mono font-bold text-stone-700 dark:text-stone-300">
                {rootKey} {scale !== "chromatic" ? scale : ""}
              </Caption>
            </div>

            <div className="flex flex-shrink-0">
              {Array.from({ length: numGroups }).map((_, groupIdx) => {
                const stepsInGroup = Math.min(
                  groupSize,
                  totalSteps - groupIdx * groupSize,
                );

                return (
                  <div
                    key={groupIdx}
                    className="flex border-r-2 border-primary/50 dark:border-primary/50"
                  >
                    {Array.from({ length: stepsInGroup }).map((_, stepIdx) => {
                      const stepNumber = groupIdx * groupSize + stepIdx;
                      const isCurrentStep = currentStep === stepNumber;

                      return (
                        <div
                          key={stepNumber}
                          className={cn(
                            "h-8 flex flex-col items-center justify-center font-mono text-[11px] border-r border-stone-200 dark:border-stone-800 transition-colors flex-shrink-0",
                            stepWidthClass,
                            isCurrentStep
                              ? "bg-primary text-white font-bold ring-1 ring-primary-light"
                              : stepIdx === 0
                                ? "font-bold text-font dark:text-surface bg-surface-light/80 dark:bg-stone-800/80"
                                : "text-font-light dark:text-font-light",
                          )}
                        >
                          <span>{stepNumber + 1}</span>
                          <span
                            className={cn(
                              "text-[9px]",
                              isCurrentStep ? "opacity-90" : "opacity-60",
                            )}
                          >
                            {stepIdx === 0
                              ? `${(groupIdx % (timeSignature === "3/4" ? 3 : 4)) + 1}/4`
                              : stepIdx === 2 && groupSize === 4
                                ? "&"
                                : "·"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 min-w-0 bg-stone-200/80 dark:bg-stone-950 border-l-2 border-stone-400 dark:border-stone-600" />
          </div>

          <div className="flex w-full relative">
            <div className="sticky left-0 z-20 w-32 sm:w-40 flex-shrink-0 flex flex-col bg-stone-900 border-r-2 border-stone-300 dark:border-stone-700 shadow-md">
              {octavesList.map((octave) => {
                const upperHeight = 7 * ROW_HEIGHT;
                const lowerHeight = 5 * ROW_HEIGHT;
                const upperKeyHeight = upperHeight / 4;
                const lowerKeyHeight = lowerHeight / 3;

                return (
                  <div
                    key={octave}
                    className="relative w-full flex-shrink-0"
                    style={{ height: 12 * ROW_HEIGHT }}
                  >
                    <div className="absolute inset-0 flex flex-col z-10">
                      {VERTICAL_WHITE_KEYS.map((keyDef) => {
                        const fullName = `${keyDef.name}${octave}`;
                        const isPressed =
                          pressedKey === fullName ||
                          externalPressedKeysSet.has(fullName);
                        const hasActiveNote = activePitches.has(fullName);
                        const isC = keyDef.name === "C";
                        const inKey = isNoteInKey(keyDef.name, rootKey, scale);
                        const height =
                          keyDef.group === "upper"
                            ? upperKeyHeight
                            : lowerKeyHeight;

                        return (
                          <Button
                            key={fullName}
                            variant="solid"
                            tone="secondary"
                            size="sm"
                            onClick={() => handleKeyClick(fullName)}
                            aria-label={`Key ${fullName}`}
                            style={{ height }}
                            className={cn(
                              "w-full rounded-none border-0 border-b border-stone-300 dark:border-stone-300 px-3 text-xs font-mono font-medium transition-colors cursor-pointer select-none justify-end active:translate-y-0",
                              "!bg-gradient-to-r !from-stone-50 !via-white !to-stone-100 dark:!from-stone-50 dark:!via-white dark:!to-stone-100 hover:!from-stone-100 hover:!to-white active:!bg-stone-200 !text-stone-900 dark:!text-stone-900 shadow-sm",
                              isC &&
                                "border-b-2 border-b-stone-500 dark:border-b-stone-400 font-bold",
                              (hasActiveNote || isPressed) &&
                                "!bg-stone-200 dark:!bg-stone-300 ring-2 ring-stone-600 dark:ring-stone-400 ring-inset !text-stone-950 font-bold shadow-inner",
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {inKey && scale !== "chromatic" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
                              )}
                              {hasActiveNote && (
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-800 dark:bg-stone-200" />
                              )}
                              <span
                                className={cn(
                                  isC
                                    ? "font-bold text-stone-900 dark:text-stone-900"
                                    : "text-stone-800 dark:text-stone-800 font-semibold",
                                )}
                              >
                                {fullName}
                              </span>
                              {isC && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-stone-800 dark:bg-stone-700 text-white">
                                  C{octave}
                                </span>
                              )}
                            </span>
                          </Button>
                        );
                      })}
                    </div>

                    {VERTICAL_BLACK_KEYS.map((keyDef) => {
                      const fullName = `${keyDef.name}${octave}`;
                      const isPressed =
                        pressedKey === fullName ||
                        externalPressedKeysSet.has(fullName);
                      const hasActiveNote = activePitches.has(fullName);
                      const inKey = isNoteInKey(keyDef.name, rootKey, scale);
                      const top = keyDef.rowIndex * ROW_HEIGHT;

                      return (
                        <Button
                          key={fullName}
                          variant="solid"
                          tone="secondary"
                          size="sm"
                          onClick={() => handleKeyClick(fullName)}
                          aria-label={`Key ${fullName}`}
                          style={{
                            top,
                            height: ROW_HEIGHT,
                          }}
                          className={cn(
                            "absolute left-0 z-20 w-20 sm:w-24 px-2.5 text-xs font-mono rounded-none rounded-r border-0 border-y border-r border-stone-700 cursor-pointer select-none transition-all justify-between active:translate-y-0",
                            "!bg-gradient-to-r !from-stone-800 !via-stone-900 !to-black !text-stone-200 shadow-md shadow-black/80 hover:brightness-125 active:brightness-90",
                            (hasActiveNote || isPressed) &&
                              "!from-stone-700 !to-stone-800 !bg-stone-700 !text-white ring-2 ring-stone-500 ring-inset shadow-inner",
                          )}
                        >
                          <span className="text-[10px] font-medium opacity-90">
                            {fullName}
                          </span>
                          <span className="flex items-center gap-1">
                            {inKey && scale !== "chromatic" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                            )}
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full transition-colors",
                                hasActiveNote
                                  ? "bg-stone-200"
                                  : "bg-stone-700/80",
                              )}
                            />
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div
              ref={gridContainerRef}
              className="relative flex flex-col flex-1 min-w-0 select-none"
            >
              {marquee && marquee.isDragging && (
                <div
                  className="absolute pointer-events-none z-40 border-2 border-solid border-primary bg-primary/20 rounded shadow-md backdrop-blur-[0.5px]"
                  style={{
                    left: Math.min(marquee.startX, marquee.currentX),
                    top: Math.min(marquee.startY, marquee.currentY),
                    width: Math.abs(marquee.currentX - marquee.startX),
                    height: Math.abs(marquee.currentY - marquee.startY),
                  }}
                />
              )}
              {notes.map((note) => {
                const inKey = isNoteInKey(note.name, rootKey, scale);

                return (
                  <div
                    key={note.id}
                    id={`piano-roll-row-${note.fullName}`}
                    className={cn(
                      "flex w-full h-8 border-b border-stone-200/80 dark:border-stone-800/80 transition-colors",
                      note.isC &&
                        "border-b-2 border-b-primary/40 dark:border-b-primary/40",
                      inKey && scale !== "chromatic"
                        ? "bg-primary/[0.04] dark:bg-primary/[0.06]"
                        : scale !== "chromatic"
                          ? "opacity-60 dark:opacity-50"
                          : "",
                    )}
                  >
                    <div className="flex flex-shrink-0">
                      {Array.from({ length: numGroups }).map((_, groupIdx) => {
                        const stepsInGroup = Math.min(
                          groupSize,
                          totalSteps - groupIdx * groupSize,
                        );

                        return (
                          <div
                            key={groupIdx}
                            className="flex border-r-2 border-primary/40 dark:border-primary/40"
                          >
                            {Array.from({ length: stepsInGroup }).map(
                              (_, stepIdx) => {
                                const stepNumber =
                                  groupIdx * groupSize + stepIdx;
                                const noteKey = `${note.fullName}-${stepNumber}`;
                                const isNoteActive = activeNotes.has(noteKey);
                                const isNoteDisabled =
                                  disabledNotes.has(noteKey);
                                const isNoteSelected =
                                  selectedNotes.has(noteKey);
                                const isCurrentStep =
                                  currentStep === stepNumber &&
                                  (isPlaying || isRecording);

                                const noteVel =
                                  noteVelocities[noteKey] ?? velocity;
                                const isPopoverOpen =
                                  (velocityPopoverNote === noteKey ||
                                    isDraggingSlider === noteKey) &&
                                  !noteDrag?.isDragging;
                                const isBeingDragged =
                                  noteDrag?.isDragging &&
                                  draggedOriginalKeysSet.has(noteKey);
                                const previewInfo = noteDrag?.isDragging
                                  ? dragPreviewNotesMap.get(noteKey)
                                  : undefined;

                                return (
                                  <div
                                    key={stepNumber}
                                    role="button"
                                    tabIndex={0}
                                    data-note-key={noteKey}
                                    data-step-number={stepNumber}
                                    data-note-name={note.fullName}
                                    data-active-note={
                                      isNoteActive ? "true" : "false"
                                    }
                                    onClick={(e) => {
                                      if (isNoteActive) {
                                        handleNoteClick(noteKey, e);
                                      } else {
                                        handleCellClick(
                                          note.fullName,
                                          stepNumber,
                                        );
                                      }
                                    }}
                                    onDoubleClick={(e) => {
                                      if (isNoteActive) {
                                        handleNoteDoubleClick(noteKey, e);
                                      }
                                    }}
                                    onContextMenu={(e) => {
                                      handleContextMenu(
                                        e,
                                        isNoteActive ? noteKey : undefined,
                                      );
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        if (isNoteActive) {
                                          handleNoteClick(
                                            noteKey,
                                            e as unknown as React.MouseEvent,
                                          );
                                        } else {
                                          handleCellClick(
                                            note.fullName,
                                            stepNumber,
                                          );
                                        }
                                      }
                                    }}
                                    aria-label={`${note.fullName} at step ${stepNumber + 1}${isNoteDisabled ? " (disabled)" : ""}${isNoteSelected ? " (selected)" : ""}`}
                                    className={cn(
                                      "h-full rounded-none border-0 border-r border-stone-200/70 dark:border-stone-800/70 transition-colors relative flex-shrink-0 p-0 select-none",
                                      stepWidthClass,
                                      isPopoverOpen
                                        ? "z-40 cursor-pointer"
                                        : isNoteSelected
                                          ? "z-20 cursor-pointer"
                                          : previewInfo
                                            ? "z-30 bg-primary/20 cursor-grabbing"
                                            : isNoteActive
                                              ? "z-10 cursor-grab active:cursor-grabbing"
                                              : "z-0 cursor-pointer",
                                      isCurrentStep &&
                                        "bg-primary/15 dark:bg-primary/25",
                                      note.isBlack
                                        ? "bg-stone-100/70 dark:bg-stone-900/50 hover:bg-stone-200/80 dark:hover:bg-stone-800/70"
                                        : "bg-surface-light dark:bg-stone-950/40 hover:bg-stone-100 dark:hover:bg-stone-900/50",
                                    )}
                                  >
                                    {previewInfo && (
                                      <div
                                        className={cn(
                                          "absolute inset-0.5 rounded-sm font-mono text-[9px] font-bold flex flex-col justify-between px-1.5 py-0.5 pointer-events-none z-30 transition-all select-none shadow-md",
                                          previewInfo.isDisabled
                                            ? "bg-stone-500/80 text-stone-200 ring-2 ring-stone-400"
                                            : "bg-gradient-to-r from-primary to-primary-light text-white ring-2 ring-primary-light ring-offset-1 ring-offset-stone-900 shadow-primary/50 animate-pulse",
                                        )}
                                      >
                                        <div className="flex items-center justify-between w-full leading-none">
                                          <span className="leading-tight font-bold">
                                            {previewInfo.noteName}
                                          </span>
                                          {noteDrag?.isCopy ? (
                                            <span className="text-[7px] font-mono font-bold px-1 py-0 rounded bg-amber-400 text-stone-950 shadow-sm">
                                              +COPY
                                            </span>
                                          ) : previewInfo.isDisabled ? (
                                            <span className="text-[7px] font-mono font-bold px-0.5 py-0 rounded bg-stone-700/60 text-stone-300">
                                              OFF
                                            </span>
                                          ) : (
                                            <span className="text-[8px] font-mono opacity-90 select-none">
                                              {previewInfo.velocity}%
                                            </span>
                                          )}
                                        </div>
                                        <div className="w-full">
                                          <div className="h-1 w-full rounded-full overflow-hidden bg-white/25">
                                            <div
                                              className="h-full rounded-full bg-white"
                                              style={{
                                                width: `${previewInfo.velocity}%`,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {isNoteActive && (
                                      <div
                                        className={cn(
                                          "relative w-full h-full cursor-grab active:cursor-grabbing",
                                          isBeingDragged &&
                                            !noteDrag?.isCopy &&
                                            "opacity-35 grayscale-[40%]",
                                        )}
                                        onWheel={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          const delta = e.deltaY < 0 ? 5 : -5;
                                          handleNoteVelocityChange(
                                            noteKey,
                                            Math.max(
                                              5,
                                              Math.min(100, noteVel + delta),
                                            ),
                                          );
                                        }}
                                      >
                                        <div
                                          className={cn(
                                            "absolute inset-0.5 rounded-sm font-mono text-[9px] font-bold flex flex-col justify-between px-1.5 py-0.5 shadow-sm transition-all select-none",
                                            isNoteDisabled
                                              ? "bg-stone-300/80 dark:bg-stone-800/90 text-stone-500 dark:text-stone-400 border border-dashed border-stone-400/80 dark:border-stone-600 opacity-60"
                                              : "bg-gradient-to-r from-primary to-primary-light text-white",
                                            isNoteSelected &&
                                              "ring-2 ring-amber-400 ring-offset-1 ring-offset-stone-100 dark:ring-offset-stone-900 border-amber-300 shadow-md shadow-amber-400/50 z-10 brightness-110",
                                          )}
                                          style={{
                                            opacity: isNoteDisabled
                                              ? 0.55
                                              : 0.5 + (noteVel / 100) * 0.5,
                                          }}
                                        >
                                          <div className="flex items-center justify-between w-full leading-none">
                                            <Caption asChild>
                                              <span
                                                className={cn(
                                                  "leading-tight font-bold",
                                                  isNoteDisabled &&
                                                    "line-through opacity-75",
                                                )}
                                              >
                                                {note.fullName}
                                              </span>
                                            </Caption>
                                            {isNoteDisabled ? (
                                              <Caption asChild>
                                                <span className="text-[7px] font-mono font-bold px-0.5 py-0 rounded bg-stone-500/20 dark:bg-stone-600/40 text-stone-600 dark:text-stone-300">
                                                  OFF
                                                </span>
                                              </Caption>
                                            ) : (
                                              <Caption asChild>
                                                <span className="text-[8px] font-mono opacity-90 select-none">
                                                  {noteVel}%
                                                </span>
                                              </Caption>
                                            )}
                                          </div>
                                          <div className="w-full">
                                            <div
                                              className={cn(
                                                "h-1 w-full rounded-full overflow-hidden",
                                                isNoteDisabled
                                                  ? "bg-stone-400/30 dark:bg-stone-700/40"
                                                  : "bg-black/25 dark:bg-white/20",
                                              )}
                                            >
                                              <div
                                                className={cn(
                                                  "h-full rounded-full transition-all",
                                                  isNoteDisabled
                                                    ? "bg-stone-400 dark:bg-stone-500"
                                                    : "bg-white",
                                                )}
                                                style={{
                                                  width: `${noteVel}%`,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {isPopoverOpen && (
                                          <Card
                                            elevation="high"
                                            data-velocity-popover="true"
                                            className={cn(
                                              "absolute z-50 flex flex-row items-center gap-1.5 px-2.5 py-1.5 bg-stone-900/95 dark:bg-stone-900 text-white rounded-lg shadow-2xl border border-stone-700/80 dark:border-stone-700 backdrop-blur-md pointer-events-auto select-none min-w-[168px]",
                                              stepNumber === 0
                                                ? "left-0"
                                                : stepNumber >= totalSteps - 1
                                                  ? "right-0"
                                                  : "left-1/2 -translate-x-1/2",
                                              note.octave >= 10
                                                ? "top-full mt-1.5"
                                                : "bottom-full mb-1.5",
                                            )}
                                          >
                                            <Caption className="text-[9px] font-mono text-stone-400 uppercase font-semibold flex-shrink-0">
                                              Vel
                                            </Caption>
                                            <input
                                              type="range"
                                              min={5}
                                              max={100}
                                              step={1}
                                              value={noteVel}
                                              onChange={(e) => {
                                                const val = Number(
                                                  e.target.value,
                                                );
                                                handleNoteVelocityChange(
                                                  noteKey,
                                                  val,
                                                );
                                              }}
                                              onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setIsDraggingSlider(noteKey);
                                              }}
                                              onMouseUp={() => {
                                                setIsDraggingSlider(null);
                                                const v = noteVel / 100;
                                                synth.playNote(
                                                  note.fullName,
                                                  undefined,
                                                  0.3,
                                                  v,
                                                );
                                              }}
                                              aria-label={`${note.fullName} velocity`}
                                              className="w-20 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                            <Caption asChild>
                                              <span className="text-[10px] font-mono font-bold text-primary-light min-w-[28px] text-right">
                                                {noteVel}%
                                              </span>
                                            </Caption>
                                            <Button
                                              variant="ghost"
                                              tone="secondary"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setVelocityPopoverNote(null);
                                              }}
                                              className="!h-4 !w-4 !p-0 min-w-0 rounded text-stone-400 hover:text-white hover:bg-stone-800 border-0"
                                              aria-label="Close velocity slider"
                                            >
                                              <X className="w-3 h-3" />
                                            </Button>
                                            <div
                                              className={cn(
                                                "absolute border-4 border-transparent",
                                                stepNumber === 0
                                                  ? "left-4"
                                                  : stepNumber >= totalSteps - 1
                                                    ? "right-4"
                                                    : "left-1/2 -translate-x-1/2",
                                                note.octave >= 10
                                                  ? "bottom-full border-b-stone-900/95 dark:border-b-stone-900"
                                                  : "top-full border-t-stone-900/95 dark:border-t-stone-900",
                                              )}
                                            />
                                          </Card>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex-1 min-w-0 bg-stone-200/50 dark:bg-black/70 border-l-2 border-stone-400/50 dark:border-stone-700/50" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-between px-2.5 py-1.5 bg-stone-100/90 dark:bg-surface-dark border-t border-stone-300 dark:border-stone-800 gap-2 overflow-x-auto flex-shrink-0 select-none z-30 no-scrollbar">
        <div className="flex items-center gap-1 flex-shrink-0">
          <Label className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
            Key:
          </Label>
          <Dropdown
            size="xs"
            value={rootKey}
            onChange={(val) => setRootKey(val)}
            options={ROOT_KEYS.map((k) => ({ value: k, label: k }))}
            className="w-16"
          />

          <Dropdown
            size="xs"
            value={scale}
            onChange={(val) => setScale(val as ScaleType)}
            options={Object.entries(SCALES).map(([sKey, sVal]) => ({
              value: sKey,
              label: sVal.name,
            }))}
            className="w-36"
          />
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 flex-shrink-0">
            <Label className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
              Piano:
            </Label>
            <Dropdown
              size="xs"
              placeholder="Piano Presets..."
              value=""
              onChange={(val) => {
                if (val) loadPattern(val);
              }}
              options={PIANO_PATTERN_PRESETS.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              className="w-40 sm:w-48"
            />
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Label className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
              Drums:
            </Label>
            <Dropdown
              size="xs"
              placeholder="Drum Presets..."
              value=""
              onChange={(val) => {
                if (val) loadPattern(val);
              }}
              options={DRUM_PATTERN_PRESETS.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              className="w-40 sm:w-48"
            />
          </div>
        </div>
      </div>

      {contextMenu && (
        <Card
          elevation="high"
          role="menu"
          aria-label="Note context menu"
          tabIndex={-1}
          className="fixed z-50 min-w-[190px] p-1 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl shadow-xl border border-stone-200/90 dark:border-stone-800/90 text-xs text-stone-700 dark:text-stone-300 font-sans select-none animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5 focus:outline-none"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") setContextMenu(null);
            e.stopPropagation();
          }}
        >
          {selectedNotes.size > 0 && (
            <Caption className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 border-b border-stone-100 dark:border-stone-800/60 mb-1">
              {selectedNotes.size} note{selectedNotes.size > 1 ? "s" : ""} selected
            </Caption>
          )}
          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={selectedNotes.size === 0}
            onClick={() => {
              toggleDisabledSelectedNotes();
              setContextMenu(null);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              {selectedNotes.size > 0 &&
              Array.from(selectedNotes).every((k) => disabledNotes.has(k)) ? (
                <Volume2 className="w-3.5 h-3.5 text-stone-500" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-stone-500" />
              )}
              {selectedNotes.size > 0 &&
              Array.from(selectedNotes).every((k) => disabledNotes.has(k))
                ? "Unmute"
                : "Mute"}
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
              D
            </span>
          </Button>

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={selectedNotes.size === 0}
            onClick={duplicateSelectedNotes}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-stone-500" />
              Duplicate
            </span>
          </Button>

          <div className="my-0.5 border-t border-stone-200/70 dark:border-stone-800/70" />

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={selectedNotes.size === 0 && activeNotes.size === 0}
            onClick={() => {
              transposeSelectedOrAll(1);
              setContextMenu(null);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-stone-500" />
              Transpose +1 (Up)
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
              ↑
            </span>
          </Button>

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={selectedNotes.size === 0 && activeNotes.size === 0}
            onClick={() => {
              transposeSelectedOrAll(-1);
              setContextMenu(null);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5 text-stone-500" />
              Transpose -1 (Down)
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
              ↓
            </span>
          </Button>

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={activeNotes.size === 0}
            onClick={() => {
              shiftNotes(-1);
              setContextMenu(null);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              <ChevronLeft className="w-3.5 h-3.5 text-stone-500" />
              Shift Left (-1 step)
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
              ←
            </span>
          </Button>

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={activeNotes.size === 0}
            onClick={() => {
              shiftNotes(1);
              setContextMenu(null);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
              Shift Right (+1 step)
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
              →
            </span>
          </Button>

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={activeNotes.size === 0}
            onClick={() => {
              reverseNotes();
              setContextMenu(null);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5 text-stone-500" />
              Flip Pattern
            </span>
          </Button>

          <div className="my-0.5 border-t border-stone-200/70 dark:border-stone-800/70" />

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={selectedNotes.size === 0}
            onClick={() => {
              deleteSelectedNotes();
              setContextMenu(null);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal rounded-md"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </span>
            <span className="text-[10px] font-mono text-red-400 dark:text-red-500">
              Del
            </span>
          </Button>

          <div className="my-0.5 border-t border-stone-200/70 dark:border-stone-800/70" />

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            disabled={activeNotes.size === 0}
            onClick={selectAllNotes}
            className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-40 disabled:pointer-events-none transition-colors border-0 font-normal"
          >
            <span className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-stone-500" />
              Select All
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
              ⌘A
            </span>
          </Button>

          {selectedNotes.size > 0 && (
            <Button
              variant="ghost"
              tone="secondary"
              size="sm"
              onClick={clearSelection}
              className="flex items-center justify-between w-full px-3 py-1.5 h-auto text-left rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/70 transition-colors border-0 font-normal"
            >
              <span className="flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-stone-500" />
                Deselect
              </span>
              <Caption asChild>
                <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                  Esc
                </span>
              </Caption>
            </Button>
          )}
        </Card>
      )}

      {noteDrag && noteDrag.isDragging && (
        <Card
          elevation="high"
          className="fixed pointer-events-none z-50 flex flex-row items-center gap-1.5 px-2.5 py-1 bg-stone-900/95 dark:bg-stone-900/95 text-white rounded-md shadow-2xl border border-stone-700/80 text-[11px] font-mono backdrop-blur-md -translate-x-1/2 -translate-y-9 transition-transform"
          style={{ left: noteDrag.currentX, top: noteDrag.currentY }}
        >
          {noteDrag.isCopy && (
            <Caption asChild>
              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-400 text-stone-950">
                COPY
              </span>
            </Caption>
          )}
          <Caption asChild>
            <span className="font-bold text-primary-light">
              {notes[noteDrag.primaryRow + noteDrag.deltaRow]?.fullName}
            </span>
          </Caption>
          <Caption asChild>
            <span className="text-stone-400">
              Step {noteDrag.primaryStep + noteDrag.deltaStep + 1}
            </span>
          </Caption>
          {(noteDrag.deltaRow !== 0 || noteDrag.deltaStep !== 0) && (
            <Caption asChild>
              <span className="text-[10px] text-stone-400 pl-1 border-l border-stone-700">
                {noteDrag.deltaRow !== 0 && (
                  <span>
                    {-noteDrag.deltaRow > 0
                      ? `+${-noteDrag.deltaRow}`
                      : `${-noteDrag.deltaRow}`}{" "}
                    st
                  </span>
                )}
                {noteDrag.deltaRow !== 0 && noteDrag.deltaStep !== 0 && " • "}
                {noteDrag.deltaStep !== 0 && (
                  <span>
                    {noteDrag.deltaStep > 0
                      ? `+${noteDrag.deltaStep}`
                      : `${noteDrag.deltaStep}`}{" "}
                    step{Math.abs(noteDrag.deltaStep) > 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </Caption>
          )}
          {noteDrag.draggedNotes.length > 1 && (
            <Caption asChild>
              <span className="text-[9px] px-1 rounded bg-stone-800 text-stone-300">
                +{noteDrag.draggedNotes.length - 1} more
              </span>
            </Caption>
          )}
        </Card>
      )}

    </div>
  );
};

export default PianoRoll;
