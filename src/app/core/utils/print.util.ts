const PRINT_SCRIPT =
  '<script>window.onload=function(){window.print();}<\/script>';

function ensurePrintTrigger(html: string): string {
  if (html.includes('window.print')) {
    return html;
  }
  const closeBody = html.lastIndexOf('</body>');
  if (closeBody === -1) {
    return html + PRINT_SCRIPT;
  }
  return html.slice(0, closeBody) + PRINT_SCRIPT + html.slice(closeBody);
}

export function printHtml(html: string, width = 320, height = 600): boolean {
  const win = window.open('', '_blank', `width=${width},height=${height}`);
  if (!win) {
    return false;
  }
  win.document.write(ensurePrintTrigger(html));
  win.document.close();
  return true;
}

export function openPrintWindow(html: string, width = 320, height = 600): void {
  const win = window.open('', '_blank', `width=${width},height=${height}`);
  if (win) {
    win.document.write(ensurePrintTrigger(html));
    win.document.close();
  }
}
