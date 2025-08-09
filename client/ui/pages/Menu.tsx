import { loadLocal } from "../../local.ts";
import { connect } from "../../client.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { styled } from "npm:styled-components";
import { Card } from "@/components/layout/Card.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";

const MenuContainer = styled(Card)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

export const Menu = () => (
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
    </VStack>
  </MenuContainer>
);
