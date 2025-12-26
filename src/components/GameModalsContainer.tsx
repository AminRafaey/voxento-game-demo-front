import { useState, useEffect } from "react";
import { LoadingModal, LobbyModal, ResultsModal } from "./GameModals";
import { modalManager, ModalState } from "../utils/modalManager";

// Event emitter for Phaser callbacks
export const modalCallbacks = {
  onStartGame: null as (() => void) | null,
  onCloseResults: null as (() => void) | null,
};

export function GameModalsContainer() {
  const [modalState, setModalState] = useState<ModalState>({ type: null });

  useEffect(() => {
    const unsubscribe = modalManager.subscribe((state) => {
      setModalState(state);
    });

    return unsubscribe;
  }, []);

  return (
    <>
      <LoadingModal
        open={modalState.type === "loading"}
        message={modalState.loading?.message || "Loading..."}
      />

      <LobbyModal
        open={modalState.type === "lobby"}
        title={modalState.lobby?.title || ""}
        message={modalState.lobby?.message || ""}
        playerCount={modalState.lobby?.playerCount || 0}
        isAdmin={modalState.lobby?.isAdmin || false}
        countdown={modalState.lobby?.countdown || 60}
        onStartGame={() => {
          if (modalCallbacks.onStartGame) {
            modalCallbacks.onStartGame();
          }
        }}
      />

      <ResultsModal
        open={modalState.type === "results"}
        title={modalState.results?.title || ""}
        winnerId={modalState.results?.winnerId || null}
        results={modalState.results?.results || []}
        mySessionId={modalState.results?.mySessionId || ""}
        onClose={() => {
          if (modalCallbacks.onCloseResults) {
            modalCallbacks.onCloseResults();
          }
          modalManager.hideResults();
        }}
      />
    </>
  );
}
