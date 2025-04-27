// components/widgets/DropdownInput.tsx
export function Dropdown({ value = '', options = [], onChange }: any) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  