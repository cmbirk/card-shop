import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Sport } from '@shared/types';
import { ROOM } from '@shared/data/shopLayout';
import { BAR } from '@shared/data/obstacles';
import { MAT } from '../materials';
import { productMaterials } from '../fixtures/SealedProduct';
import { mulberry32 } from '../../systems/rng';

// The wax wall behind the bar: white floating shelves on the east wall packed with sealed boxes, each
// with a little white price tag hanging off the shelf edge, and a TV above. Decor only (raycast off).
// Everything repeated is instanced: one InstancedMesh per box art and per price tag.

const WALL_X = ROOM.xMax;
const SHELF_D = 0.28;
const SHELF_YS = [0.55, 0.95, 1.35, 1.75];
const Z0 = BAR.z0 - 0.15; // north end (behind the bar's return)
const Z1 = BAR.z1 - 0.05; // south end
const SPORTS: Sport[] = ['baseball', 'basketball', 'football', 'hockey', 'tcg'];
const PRICES = ['$24.99', '$39.99', '$59.99', '$89.99', '$129.99', '$249.99'];
const noHit = () => null;

// unit box with just two material groups (sides+back share one) so each instanced art is 3 draws, not 6
const unitBox = new THREE.BoxGeometry(1, 1, 1);
unitBox.clearGroups();
unitBox.addGroup(0, 24, 0); // ±x, ±y
unitBox.addGroup(24, 6, 1); // +z: the art face
unitBox.addGroup(30, 6, 0); // -z
const tagGeo = new THREE.PlaneGeometry(0.075, 0.042);

function tagMaterial(text: string): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 72;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, 128, 72);
  g.fillStyle = '#16171a';
  g.font = 'bold 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 38);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t });
}

export function WaxWall() {
  const { boxes, tags, tagMats } = useMemo(() => {
    const rand = mulberry32(4242);
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // art faces west
    const boxes = new Map<string, THREE.Matrix4[]>();
    const tags: THREE.Matrix4[][] = PRICES.map(() => []);
    const tagRot = rot.clone();
    for (const y of SHELF_YS) {
      let z = Z0 + 0.1;
      while (z < Z1 - 0.2) {
        const sport = SPORTS[Math.floor(rand() * SPORTS.length)];
        const hobby = rand() < 0.45; // hobby boxes are bigger than blasters
        const [w, h, d] = hobby ? [0.26, 0.19, 0.2] : [0.2, 0.155, 0.095];
        const variant = hobby ? 0 : 1;
        // some boxes stacked two high — only where the pair clears the shelf above (and the TV on top)
        const room = y === SHELF_YS[SHELF_YS.length - 1] ? 0.3 : SHELF_YS[1] - SHELF_YS[0] - 0.025 - 0.005;
        const stack = rand() < 0.35 && 2 * h <= room ? 2 : 1;
        const key = `${sport}-${variant}`;
        for (let k = 0; k < stack; k++) {
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(WALL_X - SHELF_D / 2 - 0.01, y + 0.0125 + h / 2 + k * h, z + w / 2),
            rot,
            new THREE.Vector3(w, h, d),
          );
          if (!boxes.has(key)) boxes.set(key, []);
          boxes.get(key)!.push(m);
        }
        // price tag hanging off the shelf edge under the box
        const p = Math.min(PRICES.length - 1, Math.floor(rand() * 3) + (hobby ? 3 : 0));
        tags[p].push(new THREE.Matrix4().compose(new THREE.Vector3(WALL_X - SHELF_D - 0.004, y - 0.02, z + w / 2), tagRot, new THREE.Vector3(1, 1, 1)));
        z += w + 0.03 + rand() * 0.04;
      }
    }
    const toMesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], list: THREE.Matrix4[]) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.raycast = () => {};
      return im;
    };
    const boxMeshes: THREE.InstancedMesh[] = [];
    for (const [key, list] of boxes) {
      const [sport, v] = key.split('-');
      const mats = productMaterials(sport as Sport, Number(v));
      const im = toMesh(unitBox, [mats[0], mats[4]], list);
      im.castShadow = true;
      boxMeshes.push(im);
    }
    const tagMats = PRICES.map(tagMaterial);
    const tagMeshes = tags.map((list, i) => toMesh(tagGeo, tagMats[i], list));
    return { boxes: boxMeshes, tags: tagMeshes, tagMats };
  }, []);
  useEffect(
    () => () => {
      boxes.forEach((b) => b.dispose());
      tags.forEach((t) => t.dispose());
      tagMats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    },
    [boxes, tags, tagMats],
  );

  const len = Z1 - Z0;
  return (
    <group>
      {/* white wall standards every ~1.2 m */}
      {Array.from({ length: Math.floor(len / 1.2) + 1 }, (_, i) => Z0 + i * (len / Math.floor(len / 1.2))).map((z) => (
        <mesh key={z} material={MAT.trim} position={[WALL_X - 0.008, 1.25, z]} raycast={noHit}>
          <boxGeometry args={[0.016, 1.6, 0.025]} />
        </mesh>
      ))}
      {/* shelves */}
      {SHELF_YS.map((y) => (
        <mesh key={y} material={MAT.trim} position={[WALL_X - SHELF_D / 2, y, (Z0 + Z1) / 2]} raycast={noHit} castShadow>
          <boxGeometry args={[SHELF_D, 0.025, len]} />
        </mesh>
      ))}
      {boxes.map((b) => (
        <primitive key={b.uuid} object={b} />
      ))}
      {tags.map((t) => (
        <primitive key={t.uuid} object={t} />
      ))}
      <WallTV position={[WALL_X - 0.03, 2.55, BAR.z1 - 1.0]} />
    </group>
  );
}

/** Wall-mounted TV showing a generic game broadcast (a static canvas, lit a touch above white). */
function WallTV({ position }: { position: [number, number, number] }) {
  const screen = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 288;
    const g = c.getContext('2d')!;
    // field
    const grad = g.createLinearGradient(0, 0, 0, 288);
    grad.addColorStop(0, '#2f7d3a');
    grad.addColorStop(1, '#1f5a28');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 288);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 3;
    for (let x = 16; x < 512; x += 48) {
      g.beginPath();
      g.moveTo(x, 40);
      g.lineTo(x - 30, 288);
      g.stroke();
    }
    // players as dots
    for (let i = 0; i < 22; i++) {
      g.fillStyle = i < 11 ? '#f2f2f2' : '#c8102e';
      g.beginPath();
      g.arc(120 + ((i * 97) % 300), 110 + ((i * 53) % 130), 6, 0, Math.PI * 2);
      g.fill();
    }
    // score bug + ticker
    g.fillStyle = 'rgba(12,14,20,0.88)';
    g.fillRect(0, 0, 512, 34);
    g.fillRect(0, 258, 512, 30);
    g.fillStyle = '#ffffff';
    g.font = 'bold 20px system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('HOME 21   AWAY 17   Q3 8:42', 14, 18);
    g.font = '15px system-ui, sans-serif';
    g.fillStyle = '#ffd97a';
    g.fillText('TRADE NIGHT FRIDAY 6PM  ·  NEW RELEASES THIS WEEK  ·  WE BUY COLLECTIONS', 14, 274);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.25, 1.25, 1.25) });
  }, []);
  useEffect(() => () => { screen.map?.dispose(); screen.dispose(); }, [screen]);
  return (
    <group position={position} rotation-y={-Math.PI / 2}>
      <mesh material={MAT.dark} raycast={noHit}>
        <boxGeometry args={[1.28, 0.74, 0.05]} />
      </mesh>
      <mesh material={screen} position-z={0.026} raycast={noHit}>
        <planeGeometry args={[1.22, 0.686]} />
      </mesh>
    </group>
  );
}
