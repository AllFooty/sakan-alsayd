import { THEME_INIT_SCRIPT } from '@/components/providers/ThemeProvider';

export default function AdminSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {children}
    </>
  );
}
