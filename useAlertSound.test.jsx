import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { playAlertTone, useAlertSound } from './useAlertSound';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps the visual fallback when Web Audio is unsupported', async () => {
  vi.stubGlobal('AudioContext', undefined); vi.stubGlobal('webkitAudioContext', undefined);
  const { result } = renderHook(() => useAlertSound());
  await act(async () => result.current.enable());
  expect(result.current.enabled).toBe(false);
  expect(result.current.message).toContain('Visual alert banners still work');
});
it('does not play a tone through a suspended context', () => {
  const context = { state: 'suspended', createOscillator: vi.fn() };
  expect(playAlertTone(context)).toBe(false);
  expect(context.createOscillator).not.toHaveBeenCalled();
});
it('unlocks from the enable gesture, plays subsequent tones, and closes on mute', async () => {
  const oscillator = { frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  const audio = { state: 'running', currentTime: 1, destination: {}, resume: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue(), createOscillator: vi.fn(() => oscillator), createGain: vi.fn(() => gain) };
  vi.stubGlobal('AudioContext', class { constructor() { return audio; } });
  const { result } = renderHook(() => useAlertSound());
  expect(audio.createOscillator).not.toHaveBeenCalled();
  await act(async () => result.current.enable());
  expect(result.current.enabled).toBe(true);
  act(() => result.current.play());
  expect(oscillator.start).toHaveBeenCalledTimes(2);
  act(() => result.current.mute());
  expect(audio.close).toHaveBeenCalledOnce();
  act(() => result.current.play()); expect(oscillator.start).toHaveBeenCalledTimes(2);
});
