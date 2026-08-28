import type { Card, InventoryFile } from '@shared/types';
import inventoryJson from '@shared/data/inventory.json';
import realCardsJson from '@shared/data/realCards.json';

export const inventory: Card[] = [
  ...(inventoryJson as InventoryFile).cards,
  ...(realCardsJson as unknown as InventoryFile).cards,
];

export const inventoryById: Map<string, Card> = new Map(inventory.map((c) => [c.id, c]));
