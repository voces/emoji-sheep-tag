import { styled } from "styled-components";
import { useEffect, useState } from "react";
import {
  deleteLocalMap,
  exportLocalMapToFile,
  getLocalMap,
  importLocalMapFromFile,
  listLocalMaps,
  type LocalMapMetadata,
  saveLocalMap,
} from "../../../storage/localMaps.ts";
import { Button } from "@/components/forms/Button.tsx";
import { HStack } from "@/components/layout/Layout.tsx";
import { Dialog } from "@/components/layout/Dialog.tsx";
import { addChatMessage } from "@/vars/chat.ts";
import {
  formatValidationError,
  validatePackedMap,
} from "@/shared/map/validation.ts";
import { SettingsPanelContainer, SettingsPanelTitle } from "./commonStyles.tsx";

const MapsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const MapItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 2px;
`;

const MapInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MapName = styled.span`
  font-size: 14px;
`;

const MapMeta = styled.span`
  font-size: 12px;
  opacity: 0.6;
`;

const MapActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.lg};
  opacity: 0.6;
  font-size: 14px;
`;

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

export const Maps = () => {
  const [localMaps, setLocalMaps] = useState<LocalMapMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapToDelete, setMapToDelete] = useState<
    {
      id: string;
      name: string;
    } | null
  >(null);

  const refreshMaps = () => {
    setLoading(true);
    listLocalMaps().then((maps) => {
      setLocalMaps(maps);
      setLoading(false);
    }).catch((err) => {
      console.error("Failed to load local maps:", err);
      addChatMessage("Failed to load local maps");
      setLocalMaps([]);
      setLoading(false);
    });
  };

  useEffect(() => {
    refreshMaps();
  }, []);

  const handleDelete = (id: string, name: string) => {
    setMapToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!mapToDelete) return;

    try {
      await deleteLocalMap(mapToDelete.id);
      addChatMessage(`Map "${mapToDelete.name}" deleted successfully!`);
      setMapToDelete(null);
      refreshMaps();
    } catch (err) {
      console.error("Failed to delete map:", err);
      addChatMessage(
        `Failed to delete map: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }
  };

  const cancelDelete = () => {
    setMapToDelete(null);
  };

  const handleExport = async (id: string, name: string) => {
    const map = await getLocalMap(id);
    if (!map) {
      addChatMessage(`Map "${name}" not found`);
      return;
    }

    exportLocalMapToFile(name, map.data);
    addChatMessage(`Map "${name}" exported successfully!`);
  };

  const handleImport = async () => {
    try {
      const { name, data } = await importLocalMapFromFile();

      const validation = validatePackedMap(data);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(formatValidationError)
          .join(", ");
        addChatMessage(`Map validation failed: ${errorMessages}`);
        return;
      }

      const id = `${
        name.replace(/[^a-z0-9]/gi, "-").toLowerCase()
      }-${Date.now()}`;
      await saveLocalMap(id, name, data);
      addChatMessage(`Map "${name}" imported successfully!`);
      refreshMaps();
    } catch (err) {
      if (err instanceof Error && err.message === "No file selected") {
        return;
      }
      console.error("Failed to import map:", err);
      addChatMessage(
        `Failed to import map: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }
  };

  return (
    <SettingsPanelContainer>
      <SettingsPanelTitle>Custom Maps</SettingsPanelTitle>

      <Button onClick={handleImport}>
        Import Map from File
      </Button>

      {loading
        ? <EmptyState>Loading maps...</EmptyState>
        : localMaps.length === 0
        ? (
          <EmptyState>
            No custom maps saved. Use the editor to create and save maps.
          </EmptyState>
        )
        : (
          <MapsList>
            {localMaps.map((map) => (
              <MapItem key={map.id}>
                <MapInfo>
                  <MapName>{map.name}</MapName>
                  <MapMeta>
                    By {map.author} • {formatTimestamp(map.timestamp)}
                  </MapMeta>
                </MapInfo>
                <MapActions>
                  <Button onClick={() => handleExport(map.id, map.name)}>
                    Export
                  </Button>
                  <Button onClick={() => handleDelete(map.id, map.name)}>
                    Delete
                  </Button>
                </MapActions>
              </MapItem>
            ))}
          </MapsList>
        )}

      {mapToDelete && (
        <Dialog>
          <SettingsPanelContainer>
            <div>
              Delete "{mapToDelete.name}"? This cannot be undone.
            </div>
            <HStack $justifyContent="flex-end">
              <Button onClick={confirmDelete}>
                Delete
              </Button>
              <Button onClick={cancelDelete}>
                Cancel
              </Button>
            </HStack>
          </SettingsPanelContainer>
        </Dialog>
      )}
    </SettingsPanelContainer>
  );
};
