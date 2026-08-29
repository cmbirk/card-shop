// Memorabilia in the Colts Room — data, so Chris (the AI) can talk about each piece
// and the scene can lay them out. Positions are world metres inside ANNEX.

export interface ShowcaseItem {
  id: string;
  kind: 'jersey' | 'pennant' | 'football' | 'tickets' | 'seat' | 'photo';
  name: string;
  blurb: string; // what Chris says about it
  position: [number, number, number];
  rotationY: number;
  /** jersey: number on the back; pennant: text; tickets: lines; photo: image url */
  detail?: string;
}

export const showcase: ShowcaseItem[] = [
  {
    id: 'jersey-18',
    kind: 'jersey',
    name: 'Framed #18 home jersey',
    blurb: "A blue #18 home jersey, framed in a shadowbox on the far wall. Chris wore it to every home game of the 2006 run and swears it's why they won.",
    position: [-8.97, 1.85, -4.3],
    rotationY: Math.PI / 2,
    detail: '18',
  },
  {
    id: 'jersey-88',
    kind: 'jersey',
    name: 'Framed #88 jersey',
    blurb: 'A white #88 road jersey beside the #18. Two halves of the best quarterback-receiver pairing the franchise ever had.',
    position: [-8.97, 1.85, -2.1],
    rotationY: Math.PI / 2,
    detail: '88',
  },
  {
    id: 'pennant-indy',
    kind: 'pennant',
    name: 'INDY pennant',
    blurb: 'A felt INDY pennant over the doorway — the first thing Chris ever hung in the shop.',
    position: [-7, 2.6, -5.17],
    rotationY: 0,
    detail: 'INDY',
  },
  {
    id: 'pennant-horseshoe',
    kind: 'pennant',
    name: 'INDIANAPOLIS pennant',
    blurb: 'The plain blue-and-white pennant next to it came from a garage sale in Broad Ripple for a dollar.',
    position: [-5.8, 2.6, -5.17],
    rotationY: 0,
    detail: 'INDIANAPOLIS',
  },
  {
    id: 'ball-signed',
    kind: 'football',
    name: 'Signed game ball',
    blurb: "A game ball on a walnut stand, signed along the panel. Chris won't say who signed it unless you ask nicely.",
    position: [-8.5, 0.9, -4.75],
    rotationY: 0.6,
  },
  {
    id: 'tickets',
    kind: 'tickets',
    name: 'Framed ticket stubs',
    blurb: 'A frame of ticket stubs on the north wall: the RCA Dome finale, the Lucas Oil opener, and one very cold January playoff game.',
    position: [-6.2, 1.7, -5.17],
    rotationY: 0,
    detail: 'RCA DOME · LAST GAME · 2007|LUCAS OIL · OPENER · 2008|AFC PLAYOFF · JAN 2010',
  },
  {
    id: 'seat',
    kind: 'seat',
    name: 'Stadium seat',
    blurb: 'An actual blue stadium seat, section 3xx, salvaged when the old dome came down. Yes, you can sit in it. No, not with a basket.',
    position: [-5.7, 0, -1.7],
    rotationY: Math.PI - 0.5,
  },
];
