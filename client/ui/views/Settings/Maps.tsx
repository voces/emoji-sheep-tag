import { styled } from "styled-components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Trash2, Upload } from "lucide-react";
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
import { addChatMessage } from "@/vars/chat.ts";
import { validatePackedMap } from "@/shared/map/validation.ts";
import { translateValidationError } from "@/util/mapValidationMessages.ts";
import { Tag } from "@/components/Tag.tsx";
import { SettingsPanelContainer, SettingsPanelTitle } from "./commonStyles.tsx";

const MapsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ImportButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: 10px 14px;
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  &.hover:not([disabled]) {
    border-color: ${({ theme }) => theme.border.hi};
  }
`;

const MapList = styled.div`
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

const MapRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
  font-size: ${({ theme }) => theme.text.sm};

  &:last-child {
    border-bottom: none;
  }

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
  }
`;

const MapInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MapTagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
`;

const MapName = styled.span`
  color: ${({ theme }) => theme.ink.hi};
`;

const MapMeta = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
`;

const MapActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
`;

const ActionButton = styled(Button)`
  padding: 4px 10px;
  min-height: 28px;
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.text.sm};
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &.hover:not([disabled]) {
    border-color: ${({ theme }) => theme.border.hi};
  }
`;

const DangerButton = styled(ActionButton)`
  color: ${({ theme }) => theme.danger.DEFAULT};

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.danger.bg};
  }
`;

const ConfirmRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: 10px 14px;
  min-height: 56px;
  background: ${({ theme }) => theme.danger.bg};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
  font-size: ${({ theme }) => theme.text.sm};

  &:last-child {
    border-bottom: none;
  }
`;

const ConfirmLabel = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.danger.DEFAULT};
  font-weight: 500;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.space[6]};
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text.sm};
  line-height: 1.55;
`;

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

export const Maps = () => {
  const { t } = useTranslation();
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
      if (err instanceof Error && err.message === "IndexedDB not available") {
        setLocalMaps([]);
        setLoading(false);
        return;
      }
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
        const errorMessages = validation.errors.map(translateValidationError)
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
      <MapsHeader>
        <SettingsPanelTitle>{t("settings.mapsTitle")}</SettingsPanelTitle>
        <ImportButton onClick={handleImport}>
          <Upload size={14} />
          {t("settings.importMap")}
        </ImportButton>
      </MapsHeader>

      {loading
        ? <EmptyState>{t("settings.loadingMaps")}</EmptyState>
        : localMaps.length === 0
        ? <EmptyState>{t("settings.noMaps")}</EmptyState>
        : (
          <MapList>
            {localMaps.map((map) =>
              mapToDelete?.id === map.id
                ? (
                  <ConfirmRow key={map.id}>
                    <ConfirmLabel>
                      {t("settings.confirmDelete", { name: map.name })}
                    </ConfirmLabel>
                    <MapActions>
                      <DangerButton onClick={confirmDelete}>
                        {t("settings.deleteMap")}
                      </DangerButton>
                      <ActionButton onClick={cancelDelete}>
                        {t("settings.cancel")}
                      </ActionButton>
                    </MapActions>
                  </ConfirmRow>
                )
                : (
                  <MapRow key={map.id}>
                    <MapInfo>
                      <MapName>{map.name}</MapName>
                      <MapMeta>
                        {map.author} · {formatTimestamp(map.timestamp)}
                      </MapMeta>
                      {map.tags.length > 0 && (
                        <MapTagList>
                          {map.tags.map((tag) => (
                            <Tag key={tag}>
                              {t(`mapTag.${tag}`, { defaultValue: tag })}
                            </Tag>
                          ))}
                        </MapTagList>
                      )}
                    </MapInfo>
                    <MapActions>
                      <ActionButton
                        onClick={() => handleExport(map.id, map.name)}
                      >
                        <Download size={12} />
                        {t("settings.downloadMap")}
                      </ActionButton>
                      <DangerButton
                        onClick={() => handleDelete(map.id, map.name)}
                      >
                        <Trash2 size={12} />
                        {t("settings.deleteMap")}
                      </DangerButton>
                    </MapActions>
                  </MapRow>
                )
            )}
          </MapList>
        )}
    </SettingsPanelContainer>
  );
};
