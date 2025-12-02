interface Props {
    showDetails: boolean;
    isDetailsOpen: boolean;
    isAIOpen: boolean;
    onDetailsClick: () => void;
    onAIClick: () => void;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
    transition?: string;
  }
  
  export default function DetailsRightStrip({
    showDetails,
    isDetailsOpen,
    isAIOpen,
    onDetailsClick,
    onAIClick,
    onHoverStart,
    onHoverEnd,
    transition,
  }: Props) {
    const commonStyle =
      "text-sm font-medium cursor-pointer transition-colors rounded";
    const labelStyle = {
      writingMode: "vertical-lr" as const,
      textOrientation: "mixed" as const,
    };
  
    const activeStyle = "bg-gray-200 dark:bg-black/30 text-white";
    const hoverStyle = "hover:bg-gray-100 dark:hover:bg-black/20";
    const inactiveStyle = `text-gray-400 dark:text-gray-300 ${hoverStyle}`;
  
    return (
      <div
        className="flex items-start justify-center select-none
                   bg-dominofy-light-panel dark:bg-dominofy-dark-panel
                   border-l border-gray-200 dark:border-gray-700"
        style={{ width: 40, transition }}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      >
        <div className="flex flex-col space-y-2 mt-2">
          {showDetails && (
            <span
              onClick={onDetailsClick}
              className={`${commonStyle} ${
                isDetailsOpen ? activeStyle : inactiveStyle
              }`}
              style={labelStyle}
            >
              <div className="rotate-180 px-2 py-2">Details</div>
            </span>
          )}
          <span
            onClick={onAIClick}
            className={`${commonStyle} ${
              isAIOpen ? activeStyle : inactiveStyle
            }`}
            style={labelStyle}
          >
            <div className="rotate-180 px-2 py-2">Perrot AI</div>
          </span>
        </div>
      </div>
    );
  }
  
