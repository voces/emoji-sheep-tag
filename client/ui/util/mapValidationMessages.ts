import i18next from "i18next";
import type { MapValidationError } from "@/shared/map/validation.ts";

export const translateValidationError = (error: MapValidationError): string => {
  switch (error.type) {
    case "invalid_structure":
      return i18next.t("mapValidation.invalidStructure", {
        message: error.message,
      });
    case "width_too_small":
      return i18next.t("mapValidation.widthTooSmall", {
        actual: error.actual,
        min: error.min,
      });
    case "width_too_large":
      return i18next.t("mapValidation.widthTooLarge", {
        actual: error.actual,
        max: error.max,
      });
    case "height_too_small":
      return i18next.t("mapValidation.heightTooSmall", {
        actual: error.actual,
        min: error.min,
      });
    case "height_too_large":
      return i18next.t("mapValidation.heightTooLarge", {
        actual: error.actual,
        max: error.max,
      });
    case "entity_count_exceeded":
      return i18next.t("mapValidation.entityCountExceeded", {
        actual: error.actual,
        max: error.max,
      });
    case "terrain_size_mismatch":
      return i18next.t("mapValidation.terrainSizeMismatch", {
        expected: error.expected,
        actual: error.actual,
      });
    case "no_tags":
      return i18next.t("mapValidation.noTags");
  }
};
