// Estúdio de Cartas — S43 a S47 (editor-de-cartas.md; interface §14.21). As telas delegam aos componentes
// em presentation/ui/studio; rotas e parâmetros vêm do roteador por hash.
import type { JSX } from 'preact';
import { StudioImport } from '../studio/import.tsx';
import { StudioLab } from '../studio/lab.tsx';
import { StudioLibrary } from '../studio/library.tsx';
import { ProjectEditor } from '../studio/project.tsx';
import { StudioRelease } from '../studio/release.tsx';

type Props = { readonly params: Readonly<Record<string, string>>; readonly query: Readonly<Record<string, string>> };

export function StudioLibraryScreen(_props: Props): JSX.Element {
  return <StudioLibrary />;
}

export function StudioProjectScreen({ params }: Props): JSX.Element {
  return <ProjectEditor key={params.projectId} projectId={params.projectId ?? ''} />;
}

export function StudioTestsScreen({ params, query }: Props): JSX.Element {
  return <StudioLab key={params.projectId} projectId={params.projectId ?? ''} attack={query.attack ?? null} />;
}

export function StudioImportScreen(_props: Props): JSX.Element {
  return <StudioImport />;
}

export function StudioReleaseScreen({ params }: Props): JSX.Element {
  return <StudioRelease key={`${params.definitionId}@${params.version}`} definitionId={params.definitionId ?? ''} version={Number(params.version) || 1} />;
}
