import { useCallback, useEffect, useRef, useState } from "react";

/** Gapless playback of PCM chunks as they arrive, with pause, seek and full-buffer access for export. */
export function useStreamingAudio() {
  const ctx = useRef<AudioContext | null>(null);
  const chunks = useRef<Float32Array[]>([]);
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const sampleRate = useRef(44100);
  const nextAt = useRef(0); // ctx time the next chunk starts
  const origin = useRef(0); // ctx time that corresponds to audio t=0
  const seeked = useRef(false); // after a seek, new chunks are not auto-scheduled
  const finished = useRef(true);
  const raf = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const totalRef = useRef(0);

  const silence = () => {
    sources.current.forEach((s) => { try { s.stop(); } catch { /* already ended */ } });
    sources.current = [];
  };

  const schedule = (data: Float32Array, at: number, offset = 0) => {
    const c = ctx.current!;
    const buf = c.createBuffer(1, data.length, sampleRate.current);
    buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(at, offset);
    sources.current.push(src);
    src.onended = () => (sources.current = sources.current.filter((s) => s !== src));
    return buf.duration - offset;
  };

  // progress ticker while playing
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const t = ctx.current!.currentTime - origin.current;
      if (finished.current && t >= totalRef.current) {
        setCurrent(totalRef.current);
        setPlaying(false);
        return;
      }
      setCurrent(Math.min(t, totalRef.current));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  useEffect(() => () => void ctx.current?.close(), []);

  /** Begin a new stream (call inside a user gesture so the AudioContext may start). */
  const start = useCallback(async () => {
    silence();
    ctx.current ??= new AudioContext();
    if (ctx.current.state === "suspended") await ctx.current.resume();
    chunks.current = [];
    totalRef.current = 0;
    seeked.current = false;
    finished.current = false;
    nextAt.current = origin.current = ctx.current.currentTime + 0.1;
    setTotal(0);
    setCurrent(0);
    setPlaying(true);
  }, []);

  const push = useCallback((data: Float32Array, rate: number) => {
    sampleRate.current = rate;
    chunks.current.push(data);
    totalRef.current += data.length / rate;
    setTotal(totalRef.current);
    if (!seeked.current) nextAt.current += schedule(data, nextAt.current);
  }, []);

  const finish = useCallback(() => { finished.current = true; }, []);

  const seek = useCallback((fraction: number) => {
    const c = ctx.current;
    if (!c || !chunks.current.length) return;
    const to = totalRef.current * fraction;
    seeked.current = true;
    silence();
    origin.current = c.currentTime - to;
    let pos = 0;
    let at = c.currentTime;
    for (const chunk of chunks.current) {
      const dur = chunk.length / sampleRate.current;
      if (pos + dur > to) at += schedule(chunk, at, Math.max(0, to - pos));
      pos += dur;
    }
    c.resume();
    setCurrent(to);
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    const c = ctx.current;
    if (!c) return;
    if (playing) { c.suspend(); setPlaying(false); return; }
    c.resume();
    // ended earlier (or sources drained): replay from where we were, or the start if at the end
    if (finished.current && !sources.current.length) seek(totalRef.current && current < totalRef.current ? current / totalRef.current : 0);
    else setPlaying(true);
  }, [playing, current, seek]);

  return { playing, current, total, chunks, sampleRate, start, push, finish, seek, toggle };
}
