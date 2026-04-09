interface CsvColumn {
  key: string;
  header: string;
}

export function generateCsv(data: Record<string, unknown>[], columns: CsvColumn[]): string {
  const escapeCell = (value: unknown): string => {
    const str = value == null ? '' : String(value);
    // If the value contains commas, quotes, or newlines, wrap in quotes and escape existing quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = columns.map((col) => escapeCell(col.header)).join(',');

  const dataRows = data.map((row) =>
    columns.map((col) => escapeCell(row[col.key])).join(',')
  );

  // Add BOM for Excel compatibility with Arabic text
  // Add sep=, directive so Excel uses comma delimiter regardless of locale settings
  return '\uFEFF' + ['sep=,', headerRow, ...dataRows].join('\r\n');
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
