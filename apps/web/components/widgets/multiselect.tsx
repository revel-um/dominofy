// components/widgets/MultiSelectInput.tsx
export function MultiSelect({ value = [], options = [], onChange }: any) {
    return (
        <select
            multiple
            value={value}
            onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o: any) => o.value);
                onChange(selected);
            }}
            className="w-full border rounded p-2"
        >
            {options.map((opt: string) => (
                <option key={opt} value={opt}>
                    {opt}
                </option>
            ))}
        </select>
    );
}
