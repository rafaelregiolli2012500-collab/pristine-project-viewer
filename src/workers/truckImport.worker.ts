import { parseTruckBase } from '@/lib/truckTimeline';
self.onmessage = (event: MessageEvent<{ text: string }>) => {
  try { self.postMessage({ result: parseTruckBase(event.data.text) }); }
  catch { self.postMessage({ error: 'Não foi possível processar a base de caminhões.' }); }
};
