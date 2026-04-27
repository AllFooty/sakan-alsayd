import { Fragment, type ReactNode } from 'react';

/**
 * Wraps the first case-insensitive occurrence of `search` in `label`
 * with a <mark> highlight. Safe — uses indexOf+slice (no regex, no
 * dangerouslySetInnerHTML), so input is rendered as React children
 * and HTML/regex metacharacters cannot inject.
 */
export function highlight(label: string, search: string): ReactNode {
  if (!search.trim()) return label;
  const needle = search.trim();
  const idx = label.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return label;
  return (
    <Fragment>
      {label.slice(0, idx)}
      <mark className="bg-yellow-100 rounded px-0.5">
        {label.slice(idx, idx + needle.length)}
      </mark>
      {label.slice(idx + needle.length)}
    </Fragment>
  );
}
