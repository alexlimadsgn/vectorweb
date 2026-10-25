import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Flex, Text, Portal } from "@chakra-ui/react";
import { AnimatableProperty, Keyframe, SpringConfig } from "../types";
import { applyBezierEasing, simulateSpring, DEFAULT_BEZIER, DEFAULT_SPRING } from "../lib/animationUtils";

interface EasingPreset { name: string; label: string; easing: string; bezier?: [number,number,number,number]; spring?: SpringConfig; }

const PRESETS: EasingPreset[] = [
  { name: "linear",     label: "Linear",     easing: "linear",     bezier: [0, 0, 1, 1] },
  { name: "smooth",     label: "Smooth",     easing: "smooth",     bezier: [0.42, 0, 0.58, 1] },
  { name: "natural",    label: "Natural",    easing: "natural",    bezier: [0.25, 0.1, 0.25, 1] },
  { name: "slow-down",  label: "Slow Down",  easing: "slow-down",  bezier: [0, 0, 0.2, 1] },
  { name: "accelerate", label: "Accelerate", easing: "accelerate", bezier: [0.4, 0, 1, 1] },
  { name: "elastic",    label: "Elastic",    easing: "spring",     spring: { stiffness: 180, damping: 8, mass: 1, velocity: 0 } },
  { name: "bounce",     label: "Bounce",     easing: "spring",     spring: { stiffness: 300, damping: 10, mass: 1, velocity: 0 } },
  { name: "overshoot",  label: "Overshoot",  easing: "overshoot",  bezier: [0.34, 1.56, 0.64, 1] },
];

function CurvePreview({ bezier, spring, size = 64, active = false }: { bezier?: [number,number,number,number]; spring?: SpringConfig; size?: number; active?: boolean; }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);
    const pad = 8, w = size - pad * 2, h = size - pad * 2;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.5; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, pad + h);
    ctx.moveTo(pad, pad + h); ctx.lineTo(pad + w, pad + h); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const x = i / 80;
      const y = spring ? simulateSpring(x, spring) : applyBezierEasing(x, bezier || DEFAULT_BEZIER);
      const px = pad + x * w, py = pad + h - Math.max(-0.5, Math.min(1.5, y)) * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = active ? "#FFFFFF" : "#818CF8"; ctx.lineWidth = 1.5; ctx.stroke();
  }, [bezier, spring, size, active]);
  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

function BezierEditor({ value, onChange }: { value: [number,number,number,number]; onChange: (v: [number,number,number,number]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<"p1"|"p2"|null>(null);
  const [x1, y1, x2, y2] = value;
  const SIZE = 200, PAD = 20, W = 160, H = 160;
  const toCanvas = useCallback((nx: number, ny: number) => ({ cx: PAD + nx * W, cy: PAD + H - ny * H }), []);
  const toNorm = useCallback((cx: number, cy: number) => ({ nx: Math.max(0, Math.min(1, (cx - PAD) / W)), ny: (PAD + H - cy) / H }), []);
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.scale(dpr, dpr);
    ctx.fillStyle = "#0D0C11"; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = "#2A2832"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      ctx.beginPath(); ctx.moveTo(PAD + t * W, PAD); ctx.lineTo(PAD + t * W, PAD + H);
      ctx.moveTo(PAD, PAD + t * H); ctx.lineTo(PAD + W, PAD + t * H); ctx.stroke();
    }
    ctx.strokeStyle = "#3A3848"; ctx.lineWidth = 0.8; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD, PAD + H); ctx.lineTo(PAD + W, PAD); ctx.stroke(); ctx.setLineDash([]);
    const p0 = toCanvas(0, 0), pC1 = toCanvas(x1, y1), pC2 = toCanvas(x2, y2), p3 = toCanvas(1, 1);
    ctx.strokeStyle = "#4A4860"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p0.cx, p0.cy); ctx.lineTo(pC1.cx, pC1.cy);
    ctx.moveTo(p3.cx, p3.cy); ctx.lineTo(pC2.cx, pC2.cy); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const yv = applyBezierEasing(t, [x1, y1, x2, y2]);
      const px = PAD + t * W, py = PAD + H - Math.max(-0.5, Math.min(1.5, yv)) * H;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#818CF8"; ctx.lineWidth = 2; ctx.stroke();
    const dh = (cx: number, cy: number, color: string, lbl: string) => {
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText(lbl, cx, cy - 8);
    };
    dh(pC1.cx, pC1.cy, "#6366F1", "P1"); dh(pC2.cx, pC2.cy, "#A855F7", "P2");
    ctx.restore();
  }, [x1, y1, x2, y2, toCanvas]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    canvas.style.width = `${SIZE}px`; canvas.style.height = `${SIZE}px`;
    draw();
  }, [draw]);
  const onPD = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const pC1 = toCanvas(x1, y1), pC2 = toCanvas(x2, y2);
    if (Math.hypot(mx - pC1.cx, my - pC1.cy) < 12) setDragging("p1");
    else if (Math.hypot(mx - pC2.cx, my - pC2.cy) < 12) setDragging("p2");
  };
  const onPM = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { nx, ny } = toNorm(e.clientX - rect.left, e.clientY - rect.top);
    if (dragging === "p1") onChange([nx, ny, x2, y2]); else onChange([x1, y1, nx, ny]);
  };
  const inputs: [string, number, (v: number) => void][] = [
    ["X1", x1, (v) => onChange([v, y1, x2, y2])],
    ["Y1", y1, (v) => onChange([x1, v, x2, y2])],
    ["X2", x2, (v) => onChange([x1, y1, v, y2])],
    ["Y2", y2, (v) => onChange([x1, y1, x2, v])],
  ];
  return (
    <Box>
      <canvas ref={canvasRef} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={() => setDragging(null)}
        style={{ cursor: dragging ? "grabbing" : "crosshair", display: "block", borderRadius: 6 }} />
      <Flex gap={2} mt={2} fontSize="10px">
        {inputs.map(([lbl, val, set]) => (
          <Box key={lbl} flex={1}>
            <Text color="#918F9F" mb={0.5}>{lbl}</Text>
            <input type="number" step="0.01" min={lbl.includes("X") ? "0" : "-2"} max={lbl.includes("X") ? "1" : "2"}
              value={val.toFixed(2)} onChange={e => set(parseFloat(e.target.value) || 0)}
              style={{ width: "100%", background: "#17161C", border: "1px solid #3F3F46", borderRadius: 4, color: "#E5E2E1", fontSize: 10, padding: "2px 4px", outline: "none" }} />
          </Box>
        ))}
      </Flex>
    </Box>
  );
}

function SpringEditor({ value, onChange }: { value: SpringConfig; onChange: (v: SpringConfig) => void }) {
  const sliders: Array<{ key: keyof SpringConfig; label: string; min: number; max: number; step: number }> = [
    { key: "stiffness", label: "Rigidez",       min: 1,   max: 500, step: 1 },
    { key: "damping",   label: "Amortecimento", min: 0,   max: 100, step: 1 },
    { key: "mass",      label: "Massa",         min: 0.1, max: 10,  step: 0.1 },
    { key: "velocity",  label: "Velocidade",    min: 0,   max: 100, step: 1 },
  ];
  return (
    <Box>
      <Box mb={3} rounded="md" overflow="hidden" border="1px solid #2A2832"><CurvePreview spring={value} size={200} /></Box>
      {sliders.map(s => (
        <Box key={s.key} mb={2}>
          <Flex justify="space-between" fontSize="10px" mb={0.5}>
            <Text color="#918F9F">{s.label}</Text>
            <Text color="#C7C4D6" fontFamily="monospace">{value[s.key].toFixed(s.step < 1 ? 1 : 0)}</Text>
          </Flex>
          <input type="range" min={s.min} max={s.max} step={s.step} value={value[s.key]}
            onChange={e => onChange({ ...value, [s.key]: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "#818CF8", cursor: "pointer" }} />
        </Box>
      ))}
    </Box>
  );
}

export interface EasingEditorProps {
  keyframe: Keyframe; shapeId: string; property: AnimatableProperty;
  anchorRect: DOMRect | null; onClose: () => void;
  onApply: (easing: string, bezier?: [number,number,number,number], spring?: SpringConfig) => void;
}

type Tab = "presets" | "bezier" | "spring";

export default function EasingEditor({ keyframe, anchorRect, onClose, onApply }: EasingEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    // Presets live in the easing grid; this panel is for fine-tuning
    keyframe.easing === "spring" ? "spring" : "bezier"
  );
  const [bezier, setBezier] = useState<[number,number,number,number]>(keyframe.bezier || DEFAULT_BEZIER);
  const [spring, setSpring] = useState<SpringConfig>(keyframe.spring || DEFAULT_SPRING);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose(); };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  const ps: React.CSSProperties = { position: "fixed", zIndex: 9999 };
  if (anchorRect) {
    if (anchorRect.top >= 430) ps.bottom = window.innerHeight - anchorRect.top + 6;
    else ps.top = anchorRect.bottom + 6;
    ps.left = Math.max(8, Math.min(anchorRect.left - 80, window.innerWidth - 276));
  }

  const tabs: Array<{ id: Tab; label: string }> = [{ id: "presets", label: "Presets" }, { id: "bezier", label: "Bezier" }, { id: "spring", label: "Spring" }];

  return (
    <Portal>
      <Box pos="fixed" inset={0} zIndex={9998} onClick={onClose} pointerEvents="auto" />
      <Box ref={panelRef} style={ps} w="260px" bg="#18181B" border="1px solid" borderColor="#3F3F46"
        rounded="xl" boxShadow="0 8px 40px rgba(0,0,0,0.8)" overflow="hidden" pointerEvents="auto">
        <Flex align="center" justify="space-between" px={3} py={2} borderBottom="1px solid" borderColor="#2A2832" bg="#121214">
          <Text fontSize="11px" fontWeight="semibold" color="#E5E2E1">Curva de Animação</Text>
          <Box as="button" onClick={onClose} fontSize="14px" color="#918F9F" lineHeight={1} _hover={{ color: "#E5E2E1" }}>✕</Box>
        </Flex>
        <Flex borderBottom="1px solid" borderColor="#2A2832" bg="#121214">
          {tabs.map(t => (
            <Box key={t.id} as="button" flex={1} py={1.5} fontSize="10px" fontWeight="semibold"
              color={activeTab === t.id ? "#818CF8" : "#918F9F"} borderBottom="2px solid"
              borderColor={activeTab === t.id ? "#818CF8" : "transparent"}
              onClick={() => setActiveTab(t.id)} _hover={{ color: "#E5E2E1" }} transition="all 0.15s">{t.label}</Box>
          ))}
        </Flex>
        <Box p={3} overflowY="auto" maxH="420px">
          {activeTab === "presets" && (
            <Box display="grid" style={{ gridTemplateColumns: "1fr 1fr" }} gap={2}>
              {PRESETS.map(p => {
                const isA = keyframe.easing === p.easing;
                return (
                  <Box key={p.name} as="button" onClick={() => { onApply(p.easing, p.bezier, p.spring); onClose(); }}
                    bg={isA ? "#6366F1" : "#1F1F23"} border="1px solid" borderColor={isA ? "#818CF8" : "#3F3F46"}
                    rounded="lg" p={2} display="flex" flexDir="column" alignItems="center" gap={1}
                    _hover={{ borderColor: "#818CF8", bg: isA ? "#6366F1" : "#27272A" }} transition="all 0.15s">
                    <CurvePreview bezier={p.bezier} spring={p.spring} size={56} active={isA} />
                    <Text fontSize="9px" fontWeight="semibold" color={isA ? "#FFF" : "#C7C4D6"}>{p.label}</Text>
                  </Box>
                );
              })}
            </Box>
          )}
          {activeTab === "bezier" && (
            <Box>
              <BezierEditor value={bezier} onChange={setBezier} />
              <Flex gap={1.5} mt={2} flexWrap="wrap">
                {([ ["Ease In",[0.42,0,1,1]], ["Ease Out",[0,0,0.58,1]], ["InOut",[0.42,0,0.58,1]], ["Linear",[0,0,1,1]] ] as [string,[number,number,number,number]][]).map(([lbl, v]) => (
                  <Box key={lbl} as="button" flex={1} py={1} fontSize="9px" color="#918F9F" bg="#1F1F23"
                    border="1px solid #3F3F46" rounded="md" _hover={{ color: "#818CF8", borderColor: "#818CF8" }}
                    onClick={() => setBezier(v)}>{lbl}</Box>
                ))}
              </Flex>
              <Box as="button" w="100%" mt={2} py={1.5} fontSize="11px" fontWeight="semibold" color="#FFF"
                bg="linear-gradient(90deg,#6366F1,#818CF8)" rounded="lg" _hover={{ opacity: 0.9 }}
                onClick={() => { onApply("cubic-bezier", bezier); onClose(); }}>Aplicar Bezier</Box>
            </Box>
          )}
          {activeTab === "spring" && (
            <Box>
              <SpringEditor value={spring} onChange={setSpring} />
              <Box as="button" w="100%" mt={2} py={1.5} fontSize="11px" fontWeight="semibold" color="#FFF"
                bg="linear-gradient(90deg,#7C3AED,#A855F7)" rounded="lg" _hover={{ opacity: 0.9 }}
                onClick={() => { onApply("spring", undefined, spring); onClose(); }}>Aplicar Spring</Box>
            </Box>
          )}
        </Box>
      </Box>
    </Portal>
  );
}