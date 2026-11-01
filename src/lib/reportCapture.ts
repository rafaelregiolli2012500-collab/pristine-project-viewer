import html2canvas from 'html2canvas-pro';

/** Capture only a report, at its readable full width, independent of viewport/scroll. */
export async function captureReport(element: HTMLElement, minimumWidth: number): Promise<Blob> {
  await document.fonts?.ready;
  const clone = element.cloneNode(true) as HTMLElement;
  const width = Math.max(minimumWidth, element.scrollWidth, Math.ceil(element.getBoundingClientRect().width));
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;z-index:-9999;pointer-events:none;';
  host.style.width = `${width}px`;
  clone.style.width = `${width}px`;
  clone.style.minWidth = `${width}px`;
  clone.style.maxWidth = 'none';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  host.appendChild(clone);
  document.body.appendChild(host);
  try {
    const canvas = await html2canvas(clone, {
      scale: 2, useCORS: true, logging: false,
      width, height: Math.ceil(Math.max(clone.scrollHeight, clone.getBoundingClientRect().height)),
      windowWidth: Math.max(width, document.documentElement.clientWidth),
      scrollX: 0, scrollY: 0,
    });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem')), 'image/png');
    });
  } finally {
    host.remove();
  }
}

/** Preserve user activation in browsers that allow a promised clipboard image. */
export async function copyReport(element: HTMLElement, minimumWidth: number, filename: string): Promise<'copied' | 'downloaded'> {
  const pending = captureReport(element, minimumWidth);
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pending })]);
    return 'copied';
  } catch {
    const blob = await pending;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
}