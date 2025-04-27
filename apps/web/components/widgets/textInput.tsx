// components/widgets/TextInput.tsx
export function TextInput({ value = '', placeholder = '', onChange }: any) {
    return (
        <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border rounded p-2"
        />
    );
}
