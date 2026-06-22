// Escadas de progressão dos skills prioritários (005 / T-002). Linhas GLOBAIS.
// 5 skills: Front Lever, Planche, Parada de mão, Muscle-up, Pistol.
//
// Cada nível referencia um exercício da biblioteca (exercises.ts) por slug, na
// ordem regressão → meta (índice 0 = mais fácil; último = objetivo). É isso que
// dá segurança ao produto (RNF-001): toda meta tem regressão antes dela.
//
// `npm run verify:content` garante que todo exerciseSlug existe no catálogo.

import type { SeedSkill } from "./types.ts";

export const SKILLS: SeedSkill[] = [
  {
    slug: "front-lever",
    name: "Front Lever",
    levels: [
      { name: "Negativa", exerciseSlug: "front-lever-negative" },
      { name: "Tuck", exerciseSlug: "tuck-front-lever" },
      { name: "Advanced tuck", exerciseSlug: "advanced-tuck-front-lever" },
      { name: "Straddle / One-leg", exerciseSlug: "straddle-front-lever" },
      { name: "Full Front Lever", exerciseSlug: "full-front-lever" },
    ],
  },
  {
    slug: "planche",
    name: "Planche",
    levels: [
      { name: "Planche lean", exerciseSlug: "planche-lean" },
      { name: "Tuck", exerciseSlug: "tuck-planche" },
      { name: "Advanced tuck", exerciseSlug: "advanced-tuck-planche" },
      { name: "Straddle", exerciseSlug: "straddle-planche" },
      { name: "Full Planche", exerciseSlug: "full-planche" },
    ],
  },
  {
    slug: "handstand",
    name: "Parada de Mão",
    levels: [
      { name: "Wall plank", exerciseSlug: "wall-plank-hold" },
      { name: "Peito à parede", exerciseSlug: "chest-to-wall-handstand" },
      { name: "Costas à parede", exerciseSlug: "back-to-wall-handstand" },
      { name: "Parada livre", exerciseSlug: "freestanding-handstand" },
    ],
  },
  {
    slug: "muscle-up",
    name: "Muscle-up",
    levels: [
      { name: "Pull-up alto", exerciseSlug: "high-pull-up" },
      { name: "Dip na barra reta", exerciseSlug: "straight-bar-dip" },
      { name: "Negativa de transição", exerciseSlug: "muscle-up-transition-negative" },
      { name: "Muscle-up", exerciseSlug: "muscle-up" },
    ],
  },
  {
    slug: "pistol",
    name: "Pistol Squat",
    levels: [
      { name: "Pistol assistido", exerciseSlug: "assisted-pistol-squat" },
      { name: "Pistol no caixote", exerciseSlug: "box-pistol-squat" },
      { name: "Pistol completo", exerciseSlug: "pistol-squat" },
    ],
  },
];
