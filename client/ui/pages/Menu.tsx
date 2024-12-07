import { Card } from "../components/Card.ts";
import { Button } from "../components/Button.ts";
import { loadLocal } from "../../local.ts";
import { Select } from "../components/Select.tsx";
//@deno-types="npm:@types/react"
import { useCallback, useEffect, useState } from "npm:react";
import { connect, setServer } from "../../client.ts";

const serverOptions = [
  { label: "Single player", value: "local" },
  { label: "Server", value: location.host },
];

export const Menu = () => {
  const [value, setValue] = useState<{ label: string; value: string }>(
    navigator.onLine ? serverOptions[1] : serverOptions[0],
  );

  useEffect(() => {
    setServer(value.value);
  }, [value]);

  const handlePlay = useCallback(() => {
    if (value.value === "local") loadLocal();
    connect();
  }, [value]);

  return (
    <Card
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <h1>Emoji Sheep Tag</h1>
      <Select<{ label: string; value: string }>
        options={serverOptions}
        value={value}
        onChange={setValue}
      />
      <Button onClick={handlePlay}>Play</Button>
    </Card>
  );
};
