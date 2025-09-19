import { lobbyContext } from "../contexts.ts";

export const isPractice = () => !!lobbyContext.current.round?.practice;
export const isEditor = () => !!lobbyContext.current.round?.editor;
