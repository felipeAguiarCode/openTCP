// Linhas de cada set do Pocket fora o A1 (que segue em a1/a1-data.generated.ts), por setId do registro.
import type { PocketRow } from '../rows.ts';
import { ROWS as PA } from './pa.generated.ts';
import { ROWS as A1A } from './a1a.generated.ts';
import { ROWS as A2 } from './a2.generated.ts';
import { ROWS as A2A } from './a2a.generated.ts';
import { ROWS as A3 } from './a3.generated.ts';
import { ROWS as A3A } from './a3a.generated.ts';
import { ROWS as A3B } from './a3b.generated.ts';
import { ROWS as A4 } from './a4.generated.ts';
import { ROWS as A4A } from './a4a.generated.ts';
import { ROWS as A4B } from './a4b.generated.ts';
import { ROWS as PB } from './pb.generated.ts';

export const POCKET_ROWS: Readonly<Record<string, readonly PocketRow[]>> = {
  pa: PA, a1a: A1A, a2: A2, a2a: A2A, a3: A3, a3a: A3A, a3b: A3B, a4: A4, a4a: A4A, a4b: A4B, pb: PB,
};
