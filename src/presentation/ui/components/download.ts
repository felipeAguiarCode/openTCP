// Download local de um JSON gerado na página (listas de deck): sem rede; o arquivo vai para a pasta de downloads.
export function downloadJson(name: string, data: unknown): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
