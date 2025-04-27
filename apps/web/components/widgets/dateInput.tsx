// components/widgets/DateInput.tsx
export function DateInput({ value = '', onChange }: any) {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2"
      />
    );
  }
  