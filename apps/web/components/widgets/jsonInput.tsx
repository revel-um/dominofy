// components/widgets/JsonInput.tsx
export function JsonInput({ value = {}, onChange }: any) {
  return (
    <textarea
      value={JSON.stringify(value, null, 2)}
      onChange={(e) => {
        try {
          const parsed = JSON.parse(e.target.value);
          onChange(parsed);
        } catch {
          // do nothing or handle invalid JSON input
        }
      }}
      className="w-full border rounded p-2 font-mono"
      rows={10}
    />
  );
}
