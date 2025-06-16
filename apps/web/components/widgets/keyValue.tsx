import { ChangeEvent, useState } from "react";

// components/widgets/TextInput.tsx
export function KeyValInput({ value = '', placeholder = '',  onChange }: any) {
    // const [values, setValues] = useState(Array(1).fill(""));

    // const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    // const newValues = [...values];
    // newValues[index] = event.target.value;
    // setValues(newValues);


    const [pairs, setPairs] = useState(Array(2).fill({ key: "", value: "" }));

    const handleChange = (index: number, type: string, event: ChangeEvent<HTMLInputElement>) => {
        const newPairs = [...pairs];
        newPairs[index] = { ...newPairs[index], [type]: event.target.value };
        setPairs(newPairs);
    };

    return (
        <>
        {pairs.map((pair, index) => (
        <div key={index} style={{ marginBottom: "8px" }}>
          <input
            type="text"
            placeholder="Key"
            value={pair.key}
            onChange={(event) => handleChange(index, "key", event)}
            className="w-full border rounded p-2 text-black"

          />
          <input
            type="text"
            placeholder="Value"
            value={pair.value}
            onChange={(event) => handleChange(index, "value", event)}
            className="w-full border rounded p-2 text-black"

          />
        </div>
      ))}


        {/* {values.map((value, index) => (
        <input
          key={index}
          type="text"
          value={value}
          placeholder={placeholder}
        //   onChange={(e) => onChange(e.target.value)}
          onChange={(event) => handleChange(index, event)}
          className="w-full border rounded p-2 text-black"
        />
      ))} */}
        </>
    );
}
