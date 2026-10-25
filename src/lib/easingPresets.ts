import { Keyframe, SpringConfig } from '../types';
import { applyEasing } from './animationUtils';

export interface EasingPreset {
  id: string;
  label: string;
  easing: string;
  bezier?: [number, number, number, number];
  spring?: SpringConfig;
}

/** Curves offered in the easing grid (values understood by applyEasing / GSAP). */
export const EASING_PRESETS: EasingPreset[] = [
  { id: 'smooth', label: 'Suave', easing: 'smooth' },
  { id: 'natural', label: 'Natural', easing: 'natural' },
  { id: 'slow-down', label: 'Desacelerar', easing: 'slow-down' },
  { id: 'accelerate', label: 'Acelerar', easing: 'accelerate' },
  { id: 'linear', label: 'Linear', easing: 'linear' },
  { id: 'power4.out', label: 'Freio forte', easing: 'power4.out' },
  { id: 'expo.out', label: 'Exponencial', easing: 'expo.out' },
  { id: 'circ.out', label: 'Circular', easing: 'circ.out' },
  { id: 'sine.inOut', label: 'Senoidal', easing: 'sine.inOut' },
  { id: 'overshoot', label: 'Recuo', easing: 'overshoot' },
  { id: 'elastic', label: 'Elástico', easing: 'elastic.out(1, 0.3)' },
  { id: 'bounce', label: 'Quicar', easing: 'bounce.out' },
  { id: 'spring', label: 'Mola', easing: 'spring', spring: { stiffness: 180, damping: 12, mass: 1, velocity: 0 } },
  { id: 'steps', label: 'Passos', easing: 'steps(6)' },
];

/** Value of a curve at progress t (0..1), same math the animation uses. */
export const evaluateCurve = (p: Pick<Keyframe, 'easing' | 'bezier' | 'spring'>, t: number) =>
  applyEasing(t, { id: '', time: 0, value: 0, ...p });

/** Preset matching a keyframe's curve, or null when it's a custom bezier/spring. */
export const findEasingPreset = (kf: Pick<Keyframe, 'easing' | 'spring'>) => {
  const easing = kf.easing || 'ease-in-out';
  if (easing === 'cubic-bezier') return null;
  if (easing === 'spring') {
    const preset = EASING_PRESETS.find(p => p.easing === 'spring');
    const s = kf.spring;
    const same = s && preset?.spring && (Object.keys(s) as (keyof SpringConfig)[]).every(k => s[k] === preset.spring![k]);
    return same ? preset! : null;
  }
  // Other names for exactly the same curve (see normalizeEasingName)
  const aliases: Record<string, string> = {
    'ease-in-out': 'smooth', 'power2.inOut': 'smooth', 'power1.inOut': 'natural',
    'power3.out': 'slow-down', 'power3.in': 'accelerate', none: 'linear', 'back.out(1.7)': 'overshoot',
  };
  const id = aliases[easing] || easing;
  return EASING_PRESETS.find(p => p.id === id || p.easing === id) || null;
};
