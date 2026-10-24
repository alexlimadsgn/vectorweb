import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { BaseShape, AnimatableProperty, Keyframe } from '../types';
import { getExportRegion, preloadImages, renderFrame } from './renderFrame';

export interface Mp4ExportOptions {
  fps: number;
  scale: number;       // 1 = frame size, 2 = double resolution…
  quality: 'low' | 'medium' | 'high';
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const BITS_PER_PIXEL = { low: 0.05, medium: 0.1, high: 0.2 };

// H.264 profiles from most to least capable; the first one the browser accepts wins
const CODECS = ['avc1.640034', 'avc1.64002A', 'avc1.4D0034', 'avc1.42003E', 'avc1.42001F'];

export const isMp4ExportSupported = () => typeof window !== 'undefined' && 'VideoEncoder' in window;

export async function exportMp4(
  shapes: BaseShape[],
  animations: Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>,
  duration: number,
  options: Mp4ExportOptions
): Promise<Blob> {
  if (!isMp4ExportSupported()) {
    throw new Error('Este navegador não suporta WebCodecs. Use Chrome, Edge ou Safari recente.');
  }

  const region = getExportRegion(shapes);
  // H.264 requires even dimensions
  const width = Math.max(2, Math.round((region.width * options.scale) / 2) * 2);
  const height = Math.max(2, Math.round((region.height * options.scale) / 2) * 2);
  const bitrate = Math.round(width * height * options.fps * BITS_PER_PIXEL[options.quality]);

  let config: VideoEncoderConfig | null = null;
  for (const codec of CODECS) {
    const candidate: VideoEncoderConfig = { codec, width, height, bitrate, framerate: options.fps, avc: { format: 'avc' } };
    const support = await VideoEncoder.isConfigSupported(candidate).catch(() => null);
    if (support?.supported) {
      config = candidate;
      break;
    }
  }
  if (!config) throw new Error(`Resolução ${width}×${height} não suportada pelo codificador H.264 deste navegador.`);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: options.fps },
    fastStart: 'in-memory',
  });

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => { encodeError = e instanceof Error ? e : new Error(String(e)); },
  });
  encoder.configure(config);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const images = await preloadImages(shapes);

  const totalFrames = Math.max(1, Math.round(duration * options.fps));
  const frameDurationUs = 1_000_000 / options.fps;
  const scaleX = width / region.width;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (options.signal?.aborted) throw new DOMException('Exportação cancelada', 'AbortError');
      if (encodeError) throw encodeError;

      renderFrame(ctx, shapes, animations, i / options.fps, region, scaleX, images);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameDurationUs), duration: Math.round(frameDurationUs) });
      encoder.encode(frame, { keyFrame: i % (options.fps * 2) === 0 });
      frame.close();

      // Backpressure: let the encoder drain and keep the UI responsive
      while (encoder.encodeQueueSize > 4) {
        await new Promise(r => setTimeout(r, 0));
      }
      if (i % 5 === 0) {
        options.onProgress?.(i / totalFrames);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    options.onProgress?.(1);
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}
