import { loadLocal } from "../../local.ts";
import { connect } from "../../connection.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { openEditor } from "../util/openEditor.ts";
import { styled } from "styled-components";
import { Card } from "@/components/layout/Card.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";

// deno-lint-ignore no-process-global
const isDev = process.env.NODE_ENV === "development";
// deno-lint-ignore no-process-global
const buildTime = new Date(process.env.BUILD_TIME).toLocaleString();

const MenuContainer = styled(Card)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const VersionStamp = styled.span`
  position: fixed;
  bottom: 4px;
  right: 8px;
  font-size: 11px;
  opacity: 0.4;
`;

export const Menu = () => (
  <>
    <MenuContainer>
      <h1>Emoji Sheep Tag</h1>
      <VStack>
        <Button
          type="button"
          onClick={() => {
            loadLocal();
            connect();
          }}
        >
          Offline
        </Button>
        <Button type="button" onClick={connect}>
          Multiplayer
        </Button>
        <Button type="button" onClick={() => showSettingsVar(true)}>
          Settings
        </Button>
        <Button type="button" onClick={openEditor}>
          Editor
        </Button>
      </VStack>
    </MenuContainer>
    {isDev && <VersionStamp>{buildTime}</VersionStamp>}
  </>
);
