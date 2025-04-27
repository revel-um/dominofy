// components/widgets/FileInput.tsx
export function FileInput({ onChange }: any) {
    return (
        <input
            type="file"
            onChange={(e) => onChange(e.target.files?.[0])}
            className="w-full border rounded p-2"
        />
    );
}
