import { DEVICE_MODULES, deviceEngine } from "../deviceEngine";
import { DeviceScreen } from "../DeviceScreen";
import { DRUM_PIECES } from "../instrumentIcons";
import { knobValue } from "../modules";
import { beatMs } from "../noteRecorder";
import { useSession } from "../sessionStore";
import styles from "../SynthDevice.module.css";
import { useDevice } from "../../../providers/DeviceProvider";
import { useFeedback } from "../../../providers/FeedbackProvider";
import { useScreenState } from "../../../providers/ScreenStateProvider";
import { useModules } from "../../../providers/ModuleProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useSequencer } from "../../../providers/SequencerProvider";
import { useSound } from "../../../providers/SoundProvider";
import { useTracks } from "../../../providers/TracksProvider";
import { useTransportContext } from "../../../providers/TransportProvider";
import { useView } from "../../../providers/ViewProvider";
import { useScreenTiles } from "./screenTiles";

export function ScreenSlot() {
  const { view } = useView();
  const transport = useTransportContext();
  const { preset, edits, params, paramPage, selectParam } = useSound();
  const { tapMode } = usePerformance();
  const tracks = useTracks();
  const sequencer = useSequencer();
  const modules = useModules();
  const { badge, screen } = useScreenState();
  const { rollScrolls, rollAt, rollLow, scrollRoll, scrollRollPitch } =
    useDevice();
  const { overlayForScreen, notice } = useFeedback();
  const { songs, song } = useSession();
  const { tiles, selected, onSelect } = useScreenTiles();

  const openSongNow = songs.find(({ id }) => id === song);
  const barBeats = transport.timing.meter.beats;
  const activeModule = modules.activeModule;

  const title = activeModule
    ? `${DEVICE_MODULES[activeModule].label} · ${modules.modulesOwner}`
    : view === "tempo"
      ? "Tempo"
      : view === "tracks"
        ? `Tracks · ${openSongNow?.name ?? ""}`
        : view === "album"
          ? "Album"
          : view === "chords"
            ? "Chords"
            : view === "chordStyle"
              ? "Chord style"
              : view === "revert"
                ? "Revert"
                : preset.name;

  const beat = tapMode
    ? transport.tapCount > 0
      ? (transport.tapCount - 1) % barBeats
      : null
    : transport.beat;

  return (
    <DeviceScreen
      className={styles.screenSlot}
      view={view}
      overlay={overlayForScreen}
      title={title}
      unsaved={
        Boolean(edits) && !activeModule && view !== "tempo" && view !== "tracks"
      }
      status={screen[view].status}
      footer={[notice ?? screen[view].footer[0], screen[view].footer[1]]}
      badges={badge && !notice ? [badge] : undefined}
      timing={transport.timing}
      tracks={tracks.screenTracks}
      getTrackPosition={() =>
        tracks.mixScrubPos !== null
          ? tracks.mixScrubPos / beatMs(transport.timing)
          : tracks.mix.position()
      }
      trackSpan={tracks.trackSpan}
      trackZoom={tracks.trackZoom}
      trackFrom={tracks.trackFrom}
      onPanTracks={tracks.panTracks}
      barBeats={barBeats}
      getRoll={transport.roll}
      rollPosition={rollScrolls ? rollAt : null}
      rollLow={rollLow}
      onRollScroll={rollScrolls ? scrollRoll : undefined}
      onRollPitch={scrollRollPitch}
      beat={beat}
      getAnalyser={deviceEngine.getAnalyser}
      params={params}
      page={paramPage}
      tiles={tiles}
      selected={selected}
      onSelect={onSelect}
      onLoopEdge={tracks.dragLoopEdge}
      onLoopEdgeDrag={(dragging) =>
        tracks.setDragSpan(dragging ? tracks.trackSpan : null)
      }
      stepRows={sequencer.stepRows.map((piece) => {
        const { name, Icon } = DRUM_PIECES[piece];
        return { id: piece, label: name, icon: Icon && <Icon /> };
      })}
      stepCount={sequencer.stepCount}
      stepsPerBeat={sequencer.stepPerBeat}
      stepsPerBar={sequencer.stepsPerBar}
      stepHits={sequencer.stepHits}
      getStepHead={sequencer.getStepHead}
      stepRecording={sequencer.recordingSteps}
      onToggleStep={sequencer.toggleStep}
      onMoveStep={(by) => sequencer.moveStepHead(sequencer.stepHeadRef.current + by)}
      onSelectParam={selectParam}
      readouts={modules.readouts}
      lfoShape={modules.moduleSteps.lfo[2]}
      lfoRate={knobValue(DEVICE_MODULES.lfo.knobs[0], modules.moduleSteps.lfo[0])}
    />
  );
}
