import "./client.ts";
import { startPing } from "./messaging.ts";
import "./ui/root.tsx";
import "./controls.ts";
import "./systems/lookup.ts";
import "./systems/autoSelect.ts";
import "./systems/three.ts";
import "./systems/action.ts";
import "./systems/sounds.ts";
import "./systems/blueprints.ts";
import "./systems/fire.ts";
import "./systems/swing.ts";
import "./systems/projectile.ts";
import "./systems/buffModels.ts";
import "./systems/buffParticles.ts";
import "./systems/kaboom.ts";
import "./systems/easing.ts";
import "./systems/indicators.ts";
import "./systems/mirrors.ts";
import "./systems/playerEntityReferences.ts";
import "./systems/teams.ts";
import "./systems/fog.ts";
import "./systems/floatingText.ts";
import "@/shared/systems/kd.ts";
import "./graphics/cursor.ts";

// Start the ping system
startPing();
