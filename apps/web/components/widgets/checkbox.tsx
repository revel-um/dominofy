// components/widgets/BooleanInput.tsx
export function Checkbox({ value = false, onChange }: any) {
    return (
        <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-5 h-5"
        />
    );
}
