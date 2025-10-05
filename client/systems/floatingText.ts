import { addSystem } from "@/shared/context.ts";
import { CanvasTexture, Scene, Sprite, SpriteMaterial } from "three";
import { Entity } from "../ecs.ts";
import { theme } from "../ui/theme.ts";

const floatingTextSprites = new Map<Entity, Sprite>();
export const floatingTextScene = new Scene();

const createTextTexture = (text: string, color: string) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true })!;

  // Set canvas size
  canvas.width = 256;
  canvas.height = 64;

  // Clear canvas with transparent background
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Configure text
  context.font = `bold 32px ${theme.fontFamily.sans}`;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(0, 0, 0, 0.8)";
  context.shadowBlur = 4;
  context.shadowOffsetX = 2;
  context.shadowOffsetY = 2;

  // Word wrap if needed
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = context.measureText(testLine);
    if (metrics.width > canvas.width - 20 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else currentLine = testLine;
  }
  if (currentLine) lines.push(currentLine);

  // Draw text lines
  const lineHeight = 36;
  const startY = (canvas.height - (lines.length * lineHeight)) / 2 +
    lineHeight / 2;
  lines.forEach((line, i) => {
    context.fillText(line, canvas.width / 2, startY + i * lineHeight);
  });

  return new CanvasTexture(canvas);
};

addSystem(() => ({
  props: ["isFloatingText"],
  onAdd: (entity) => {
    if (!entity.name) return;
    if (!entity.position) return;
    if ((entity as Entity).hiddenByFog) return;

    const color = entity.vertexColor ?? 0xFFFFFF;
    const texture = createTextTexture(
      entity.name,
      `#${color.toString(16).padStart(6, "0")}`,
    );
    const material = new SpriteMaterial({ map: texture, transparent: true });
    const sprite = new Sprite(material);

    sprite.position.set(entity.position.x, entity.position.y, 0.3);
    sprite.scale.set(2, 0.5, 1);

    floatingTextScene.add(sprite);
    floatingTextSprites.set(entity, sprite);
  },
  updateEntity: (entity, delta) => {
    if (!entity.movementSpeed) return;

    const sprite = floatingTextSprites.get(entity);
    if (!sprite) return;

    sprite.position.y += delta * entity.movementSpeed;
    if (typeof entity.progress === "number") {
      sprite.material.opacity = 1 - entity.progress ** 2;
    }
  },
  onRemove: (entity) => {
    const sprite = floatingTextSprites.get(entity);
    if (sprite) {
      sprite.removeFromParent();
      sprite.material.map?.dispose();
      sprite.material.dispose();
      floatingTextSprites.delete(entity);
    }
  },
}));
