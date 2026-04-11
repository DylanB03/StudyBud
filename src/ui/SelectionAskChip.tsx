type SelectionAskChipProps = {
  position: {
    x: number;
    y: number;
  };
  onOpen: () => void;
  onDismiss: () => void;
};

export const SelectionAskChip = ({
  position,
  onOpen,
  onDismiss,
}: SelectionAskChipProps) => {
  return (
    <div
      className="selection-ask-chip"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button type="button" onClick={onOpen}>
        Ask about this
      </button>
      <button
        type="button"
        className="ghost-button selection-ask-chip-dismiss"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
};
