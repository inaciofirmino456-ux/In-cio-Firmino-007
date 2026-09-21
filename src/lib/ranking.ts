export interface RankItem { id: string; totalPaidCents: number; createdAt: number; }

export function sortRanking<T extends RankItem>(items: T[]) {
  return [...items].sort((a,b) => b.totalPaidCents-a.totalPaidCents || a.createdAt-b.createdAt);
}

export function claimPrice(currentTopCents: number, incrementCents = 500) {
  return currentTopCents > 0 ? currentTopCents + incrementCents : 100;
}

export function rebidChargeCents(currentTotalCents: number, requestedTotalCents: number) {
  if (requestedTotalCents < currentTotalCents + 100) throw new Error('rebid must exceed current total by at least $1');
  return requestedTotalCents - currentTotalCents;
}
