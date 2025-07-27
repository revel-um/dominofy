interface Props {
    showDetails: boolean;
    isDetailsOpen: boolean;
    isAIOpen: boolean;
    onDetailsClick: () => void;
    onAIClick: () => void;
}

export default function DetailsRightStrip({
    showDetails,
    isDetailsOpen,
    isAIOpen,
    onDetailsClick,
    onAIClick,
}: Props) {
    const commonStyle = "text-center text-sm font-medium px-2 py-1 rounded cursor-pointer transition-colors";
    const labelStyle = {
        writingMode: 'vertical-lr' as const,
        textOrientation: 'mixed' as const,
        transform: 'rotate(-180deg)',
    };

    return (
        <div
            className="flex items-start justify-center pt-4 select-none
                     bg-dominofy-light-panel dark:bg-dominofy-dark-panel
                     border-l border-gray-200 dark:border-gray-700"
            style={{ width: 40 }}
        >
            <div className="flex flex-col space-y-12">
                {showDetails && (
                    <span
                        onClick={onDetailsClick}
                        className={`${commonStyle} ${isDetailsOpen
                            ? 'bg-dominofy-light-accent/20 dark:bg-dominofy-dark-accent/30 text-white'
                            : 'text-gray-400 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-black/30'
                            }`}
                        style={labelStyle}
                    >
                        Details
                    </span>
                )}
                <span
                    onClick={onAIClick}
                    className={`${commonStyle} ${isAIOpen
                        ? 'bg-dominofy-light-accent/20 dark:bg-dominofy-dark-accent/30 text-white'
                        : 'text-gray-400 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-black/30'
                        }`}
                    style={labelStyle}
                >
                    Perrot AI
                </span>
            </div>
        </div>
    );

}
