export function Checkbox({ value = false, onChange }: any) {
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
      className="
        w-4 h-4
        rounded-md
        border
        border-gray-400 
        text-dominofy-light-accent
        focus:ring-1 
        focus:ring-dominofy-light-accent 
        dark:border-gray-600
        dark:text-dominofy-dark-accent
        dark:focus:ring-dominofy-dark-accent
        cursor-pointer
        "
      style={{
        transform: 'scale(0.85)',
        transformOrigin: 'center center',
      }}
    />
  );
}
