// components/widgets/CodeInput.tsx
export function CodeInput({ value = '', placeholder = '', onChange }: any) {
    return (
        <textarea
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border rounded p-2 font-mono"
            rows={10}
        />
    );
}
