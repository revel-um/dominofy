// components/widgets/DropdownInput.tsx
export function Dropdown({ value = '', options = [], onChange }: any) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2 text-black"
      >
        {options.map((opt: string) => (
          <option key={"widget"+opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  