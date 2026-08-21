export interface Flower {
  flowerId: string;
  clientId: number | null;
  clientUsername: string;
  flowerName: string;
}

export function emptyFlower(): Flower {
  return {
    flowerId: '',
    clientId: null,
    clientUsername: '',
    flowerName: '',
  };
}
