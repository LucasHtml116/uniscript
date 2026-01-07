define("compiler", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.UniscriptCompiler = void 0;
    class UniscriptCompiler {
        constructor() {
            this.blocks = new Map();
        }
        compile(sourceCode) {
            this.blocks.clear();
            const blockRegex = /<!uniscript\s+([a-zA-Z0-9_]+),\s+([a-zA-Z0-9_]+),\s+content\s*=\s*<\s*([\s\S]*?)\s*>>;/g;
            let match;
            while ((match = blockRegex.exec(sourceCode)) !== null) {
                this.blocks.set(match[1], { name: match[1], type: match[2], content: match[3] });
            }
            const mainBlock = this.blocks.get('main');
            if (!mainBlock)
                throw new Error("Compilation Error: 'main' block not found.");
            if (mainBlock.type === 'html') {
                return mainBlock.content;
            }
            return this.processUniscriptFlow(mainBlock);
        }
        processUniscriptFlow(mainBlock) {
            const content = mainBlock.content;
            const getMeta = (key) => {
                const m = content.match(new RegExp(`config\\s+${key}\\s*=\\s*"([^"]+)"`));
                return m ? m[1] : "";
            };
            const target = getMeta("target");
            const title = getMeta("title") || "Uniscript App";
            let globalVarsScript = "";
            const declareRegex = /declare\s+([a-zA-Z0-9_]+)\s*=\s*([\s\S]*?)(?:\n|$)/g;
            let decMatch;
            while ((decMatch = declareRegex.exec(content)) !== null) {
                globalVarsScript += `window.${decMatch[1]} = ${decMatch[2].trim()};\n`;
            }
            const locationMap = new Map();
            const useRegex = /use\s+"([^"]+)"\s+on\s+"([^"]+)"/g;
            let useMatch;
            while ((useMatch = useRegex.exec(content)) !== null) {
                locationMap.set(useMatch[1], useMatch[2]);
            }
            const executionMatch = content.match(/config\s+execution\s*=\s*{([\s\S]*?)}/);
            const sequence = [];
            if (executionMatch) {
                const execBody = executionMatch[1];
                const start = execBody.match(/start\s*:\s*"([^"]+)"/);
                if (start)
                    sequence.push(start[1]);
                const thens = execBody.matchAll(/then\s*:\s*"([^"]+)"/g);
                for (const t of thens) {
                    sequence.push(t[1]);
                }
                const end = execBody.match(/end\s*:\s*"([^"]+)"/);
                if (end)
                    sequence.push(end[1]);
            }
            let headContent = `<meta charset="UTF-8">\n<title>${title}</title>\n`;
            let bodyContent = "";
            if (target === "mobile") {
                headContent += `<style>body { width: 360px; height: 640px; margin: auto; border: 1px solid #30363d; overflow: auto; position: relative; }</style>\n`;
            }
            if (globalVarsScript) {
                headContent += `<script>\n${globalVarsScript}</script>\n`;
            }
            const hasPython = sequence.some(name => { var _a; return ((_a = this.blocks.get(name)) === null || _a === void 0 ? void 0 : _a.type) === 'py'; });
            if (hasPython) {
                headContent += `<script src="https://cdn.jsdelivr.net/npm/brython@3/brython.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/brython@3/brython_stdlib.js"></script>\n`;
            }
            sequence.forEach(blockName => {
                const block = this.blocks.get(blockName);
                if (!block)
                    return;
                let result = "";
                if (block.type === 'html') {
                    result = block.content.replace(/id\s*=\s*(['"])([^'"]+)\1/g, `id="${block.name}_$2"`);
                }
                else if (block.type === 'css') {
                    let css = block.content;
                    css = css.replace(/import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g, "");
                    const importPairs = [];
                    const impReg = /import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g;
                    let im;
                    while ((im = impReg.exec(block.content)) !== null)
                        importPairs.push({ id: im[1], from: im[2] });
                    importPairs.forEach(p => {
                        css = css.replace(new RegExp(`#${p.id}\\b`, 'g'), `#${p.from}_${p.id}`);
                    });
                    result = `<style>\n${css}\n</style>\n`;
                }
                else if (block.type === 'js' || block.type === 'ts') {
                    let code = block.content.trim();
                    if (code.startsWith(">"))
                        code = code.replace(/^>+/, "").trim();
                    code = code.replace(/import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g, `var $1 = document.getElementById("$2_$1")`);
                    if (block.type === 'ts') {
                        code = `const info = { lang: "TS" };\n` + code;
                        code = window.Babel.transform(code, { presets: ['typescript'], filename: 't.ts' }).code;
                    }
                    result = `<script>\n${code}\n</script>\n`;
                }
                else if (block.type === 'py') {
                    let pyCode = block.content.trim();
                    if (pyCode.startsWith(">"))
                        pyCode = pyCode.replace(/^>+/, "").trim();
                    let pythonHeader = "from browser import document, window, alert\n";
                    pyCode = pyCode.replace(/import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g, (m, id, from) => `${id} = document["${from}_${id}"]`);
                    result = `<script type="text/python">\n${pythonHeader}${pyCode}\n</script>\n`;
                }
                if (locationMap.get(blockName) === "head") {
                    headContent += result;
                }
                else {
                    bodyContent += result;
                }
            });
            return `<!DOCTYPE html><html><head>${headContent}</head><body ${hasPython ? 'onload="brython()"' : ''}>${bodyContent}</body></html>`;
        }
    }
    exports.UniscriptCompiler = UniscriptCompiler;
});
define("errors", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ErrorManager = void 0;
    class ErrorManager {
        constructor(consoleId, iframeContainerId) {
            this.consoleElement = document.getElementById(consoleId);
            this.iframeContainer = document.getElementById(iframeContainerId);
        }
        log(message, type = 'info') {
            const line = document.createElement('div');
            line.style.fontFamily = 'monospace';
            line.style.padding = '2px 5px';
            line.style.borderBottom = '1px solid #333';
            if (type === 'error')
                line.style.color = '#ff6b6b';
            if (type === 'success')
                line.style.color = '#51cf66';
            if (type === 'info')
                line.style.color = '#ced4da';
            const prefix = type === 'error' ? '[US Error] ' : '[US] ';
            line.textContent = prefix + message;
            this.consoleElement.appendChild(line);
            this.consoleElement.scrollTop = this.consoleElement.scrollHeight;
        }
        clear() {
            this.consoleElement.innerHTML = '';
        }
        runCodeInSandbox(htmlCode) {
            this.iframeContainer.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            const errorCatcher = `
            <script>
                window.onerror = function(message, source, lineno, colno, error) {
                    window.parent.postMessage({type: 'error', msg: message, line: lineno}, '*');
                };
                // Bloqueios de segurança simples
                console.log = function(msg) { window.parent.postMessage({type: 'log', msg: msg}, '*'); };
            </script>
        `;
            const finalCode = htmlCode.replace('<head>', '<head>' + errorCatcher);
            this.iframeContainer.appendChild(iframe);
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(finalCode);
            doc.close();
        }
    }
    exports.ErrorManager = ErrorManager;
    window.addEventListener('message', (event) => {
        const logger = window.appLogger;
        if (logger) {
            if (event.data.type === 'error') {
                logger.log(`JS Runtime Error: ${event.data.msg} (Line: ${event.data.line})`, 'error');
            }
            else if (event.data.type === 'log') {
                logger.log(`Console: ${event.data.msg}`, 'info');
            }
        }
    });
});
define("main", ["require", "exports", "compiler", "errors"], function (require, exports, compiler_1, errors_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    window.UniscriptApp = {
        UniscriptCompiler: compiler_1.UniscriptCompiler,
        ErrorManager: errors_1.ErrorManager
    };
});
