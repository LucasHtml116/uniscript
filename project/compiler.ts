export class UniscriptCompiler {
    private blocks: Map<string, any> = new Map();

    compile(sourceCode: string): string {
        this.blocks.clear();
        const blockRegex = /<!uniscript\s+([a-zA-Z0-9_]+),\s+([a-zA-Z0-9_]+),\s+content\s*=\s*<\s*([\s\S]*?)\s*>>;/g;
        let match;
        while ((match = blockRegex.exec(sourceCode)) !== null) {
            this.blocks.set(match[1], { name: match[1], type: match[2], content: match[3] });
        }

        const mainBlock = this.blocks.get('main');
        if (!mainBlock) throw new Error("Compilation Error: 'main' block not found.");

        if (mainBlock.type === 'html') {
            return mainBlock.content;
        }

        return this.processUniscriptFlow(mainBlock);
    }

    private processUniscriptFlow(mainBlock: any): string {
        const content = mainBlock.content;

        const getMeta = (key: string) => {
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

        const locationMap = new Map<string, string>();
        const useRegex = /use\s+"([^"]+)"\s+on\s+"([^"]+)"/g;
        let useMatch;
        while ((useMatch = useRegex.exec(content)) !== null) {
            locationMap.set(useMatch[1], useMatch[2]);
        }

        const executionMatch = content.match(/config\s+execution\s*=\s*{([\s\S]*?)}/);
        const sequence: string[] = [];
        if (executionMatch) {
            const execBody = executionMatch[1];
            const start = execBody.match(/start\s*:\s*"([^"]+)"/);
            if (start) sequence.push(start[1]);
            const thens = execBody.matchAll(/then\s*:\s*"([^"]+)"/g);
            for (const t of thens) { sequence.push(t[1]); }
            const end = execBody.match(/end\s*:\s*"([^"]+)"/);
            if (end) sequence.push(end[1]);
        }

        let headContent = `<meta charset="UTF-8">\n<title>${title}</title>\n`;
        let bodyContent = "";

        if (target === "mobile") {
            headContent += `<style>body { width: 360px; height: 640px; margin: auto; border: 1px solid #30363d; overflow: auto; position: relative; }</style>\n`;
        }

        if (globalVarsScript) {
            headContent += `<script>\n${globalVarsScript}</script>\n`;
        }

        const hasPython = sequence.some(name => this.blocks.get(name)?.type === 'py');
        if (hasPython) {
            headContent += `<script src="https://cdn.jsdelivr.net/npm/brython@3/brython.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/brython@3/brython_stdlib.js"></script>\n`;
        }

        sequence.forEach(blockName => {
            const block = this.blocks.get(blockName);
            if (!block) return;

            let result = "";
            if (block.type === 'html') {
                result = block.content.replace(/id\s*=\s*(['"])([^'"]+)\1/g, `id="${block.name}_$2"`);
            } 
            else if (block.type === 'css') {
                let css = block.content;
                css = css.replace(/import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g, "");
                
                const importPairs: any[] = [];
                const impReg = /import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g;
                let im; while((im = impReg.exec(block.content)) !== null) importPairs.push({id: im[1], from: im[2]});
                
                importPairs.forEach(p => {
                    css = css.replace(new RegExp(`#${p.id}\\b`, 'g'), `#${p.from}_${p.id}`);
                });
                result = `<style>\n${css}\n</style>\n`;
            } 
            else if (block.type === 'js' || block.type === 'ts') {
                let code = block.content.trim();
                if (code.startsWith(">")) code = code.replace(/^>+/, "").trim();
                code = code.replace(/import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g, `var $1 = document.getElementById("$2_$1")`);
                
                if (block.type === 'ts') {
                    code = `const info = { lang: "TS" };\n` + code;
                    code = (window as any).Babel.transform(code, { presets: ['typescript'], filename: 't.ts' }).code;
                }
                result = `<script>\n${code}\n</script>\n`;
            }
            else if (block.type === 'py') {
                let pyCode = block.content.trim();
                if (pyCode.startsWith(">")) pyCode = pyCode.replace(/^>+/, "").trim();
                let pythonHeader = "from browser import document, window, alert\n";
                pyCode = pyCode.replace(/import\s+"([^"]+)"\s+from\s+"([^"]+)"\;?/g, (m: string, id: string, from: string) => `${id} = document["${from}_${id}"]`);
                result = `<script type="text/python">\n${pythonHeader}${pyCode}\n</script>\n`;
            }

            if (locationMap.get(blockName) === "head") {
                headContent += result;
            } else {
                bodyContent += result;
            }
        });

        return `<!DOCTYPE html><html><head>${headContent}</head><body ${hasPython ? 'onload="brython()"' : ''}>${bodyContent}</body></html>`;
    }
}
