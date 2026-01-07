import { UniscriptCompiler } from "./compiler";
import { ErrorManager } from "./errors";

(window as any).UniscriptApp = {
    UniscriptCompiler,
    ErrorManager
};