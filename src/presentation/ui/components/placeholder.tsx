import type { JSX } from 'preact';
import { route } from '../app/router.ts';
import { EmptyState, PageHeader } from './controls.tsx';

export function Placeholder(): JSX.Element {
  return (
    <>
      <PageHeader title={route.value.def.title} />
      <EmptyState title="Em construção" text={`Tela ${route.value.def.id}`} />
    </>
  );
}
