import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureReport, copyReport } from '../reportCapture';

const { render } = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock('html2canvas-pro', () => ({ default: render }));
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); render.mockReset(); });

describe('cópia do conteúdo completo', () => {
  it('captura o relatório inteiro mesmo quando ele ultrapassa a tela', async () => {
    const blob = new Blob(['report'], { type: 'image/png' });
    let capturedHeight = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width: 491, height: 2200 } as DOMRect));
    render.mockImplementation(async (element, options) => {
      expect(element.parentElement).toBeTruthy();
      capturedHeight = options.height;
      expect(options.width).toBe(1180);
      return { toBlob: (callback: (b: Blob) => void) => callback(blob) };
    });
    const source = document.createElement('div'); document.body.appendChild(source);
    expect(await captureReport(source, 1180)).toBe(blob);
    expect(capturedHeight).toBe(2200);
    expect(document.body.children.length).toBe(1);
  });
  it('copia a imagem sem baixar quando o navegador permite', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', class { constructor(public data: Record<string, Promise<Blob>>) {} });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    render.mockResolvedValue({ toBlob: (callback: (b: Blob) => void) => callback(new Blob(['image'], { type: 'image/png' })) });
    expect(await copyReport(document.createElement('div'), 1526, 'analysis.png')).toBe('copied');
    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0][0][0];
    expect((await item.data['image/png']).type).toBe('image/png');
    vi.unstubAllGlobals();
  });
});