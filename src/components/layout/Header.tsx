'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import LanguageSwitcher from './LanguageSwitcher';

type NavItem = {
  href: string;
  key: string;
  isPage?: boolean;
};

const navItems: NavItem[] = [
  { href: '/', key: 'home', isPage: true },
  { href: '#about', key: 'about' },
  { href: '#services', key: 'services' },
  { href: '#locations', key: 'locations' },
  { href: '/testimonials', key: 'testimonials', isPage: true },
  { href: '#contact', key: 'contact' },
];

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Check if we're on the home page
  const isHomePage = pathname === `/${locale}` || pathname === `/${locale}/`;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);

    if (element) {
      // Element exists on current page, scroll to it
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    } else if (!isHomePage) {
      // Element doesn't exist, navigate to home page with hash
      setIsMobileMenuOpen(false);
      router.push(`/${locale}${href}`);
    }
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-navy/5'
          : 'bg-transparent'
      )}
    >
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2">
            {!logoError ? (
              <div className="relative h-12 w-32">
                <Image
                  src="/images/logo.svg"
                  alt="Sakan Alsayd"
                  fill
                  className="object-contain"
                  priority
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <span className="text-2xl font-bold text-navy">
                {locale === 'ar' ? 'سكن السيد' : 'Sakan Alsayd'}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navItems.map((item) =>
              item.isPage ? (
                <Link
                  key={item.key}
                  href={`/${locale}${item.href}`}
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    isScrolled
                      ? 'text-navy hover:text-coral'
                      : 'text-navy hover:text-coral'
                  )}
                >
                  {t(item.key)}
                </Link>
              ) : (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    isScrolled
                      ? 'text-navy hover:text-coral'
                      : 'text-navy hover:text-coral'
                  )}
                >
                  {t(item.key)}
                </a>
              )
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <LanguageSwitcher />
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const contactSection = document.getElementById('contact');
                contactSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {t('bookNow')}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-4 lg:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-navy"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div
          className={cn(
            'lg:hidden overflow-hidden transition-all duration-300',
            isMobileMenuOpen ? 'max-h-96 pb-4' : 'max-h-0'
          )}
        >
          <div className="flex flex-col gap-4 bg-white rounded-2xl p-4 shadow-lg">
            {navItems.map((item) =>
              item.isPage ? (
                <Link
                  key={item.key}
                  href={`/${locale}${item.href}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-navy font-medium py-2 px-4 rounded-xl hover:bg-cream transition-colors"
                >
                  {t(item.key)}
                </Link>
              ) : (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className="text-navy font-medium py-2 px-4 rounded-xl hover:bg-cream transition-colors"
                >
                  {t(item.key)}
                </a>
              )
            )}
            <Button
              variant="primary"
              className="mt-2"
              onClick={() => {
                const contactSection = document.getElementById('contact');
                contactSection?.scrollIntoView({ behavior: 'smooth' });
                setIsMobileMenuOpen(false);
              }}
            >
              {t('bookNow')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
