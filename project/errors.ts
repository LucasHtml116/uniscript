export class ErrorManager {
    private consoleElement: HTMLElement;
    private iframeContainer: HTMLElement;

    constructor(consoleId: string, iframeContainerId: string) {
        this.consoleElement = document.getElementById(consoleId)!;
        this.iframeContainer = document.getElementById(iframeContainerId)!;
    }

    log(message: string, type: 'info' | 'error' | 'success' = 'info') {
        const line = document.createElement('div');
        line.style.fontFamily = 'monospace';
        line.style.padding = '2px 5px';
        line.style.borderBottom = '1px solid #333';
        
        if (type === 'error') line.style.color = '#ff6b6b';
        if (type === 'success') line.style.color = '#51cf66';
        if (type === 'info') line.style.color = '#ced4da';

        const prefix = type === 'error' ? '[US Error] ' : '[US] ';
        line.textContent = prefix + message;
        this.consoleElement.appendChild(line);
        this.consoleElement.scrollTop = this.consoleElement.scrollHeight;
    }

    clear() {
        this.consoleElement.innerHTML = '';
    }

    runCodeInSandbox(htmlCode: string) {
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
        
        const doc = iframe.contentWindow!.document;
        doc.open();
        doc.write(finalCode);
        doc.close();
    }
}

window.addEventListener('message', (event) => {
    const logger = (window as any).appLogger;
    if (logger) {
        if (event.data.type === 'error') {
            logger.log(`JS Runtime Error: ${event.data.msg} (Line: ${event.data.line})`, 'error');
        } else if (event.data.type === 'log') {
            logger.log(`Console: ${event.data.msg}`, 'info');
        }
    }
});