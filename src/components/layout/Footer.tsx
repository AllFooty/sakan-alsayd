'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Instagram, Twitter, CreditCard, MapPin } from 'lucide-react';
import { socialMedia, bankInfo } from '@/data/contacts';

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const isArabic = locale === 'ar';

  const quickLinks = [
    { href: '#home', label: t('nav.home') },
    { href: '#about', label: t('nav.about') },
    { href: '#services', label: t('nav.services') },
    { href: '#rooms', label: t('nav.rooms') },
    { href: '#locations', label: t('nav.locations') },
    { href: '#contact', label: t('nav.contact') },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-navy text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">
              {isArabic ? 'سكن السيد' : 'Sakan Alsayd'}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {t('footer.description')}
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a
                href={`https://instagram.com/${socialMedia.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-lg hover:bg-coral transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={`https://twitter.com/${socialMedia.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-lg hover:bg-coral transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href={`https://www.tiktok.com/@${socialMedia.tiktok}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-lg hover:bg-coral transition-colors"
                aria-label="TikTok"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.quickLinks')}</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="text-white/70 hover:text-coral transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.contactUs')}</h4>
            <p className="text-white/70 text-sm mb-4">
              {t('footer.contactDescription')}
            </p>
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, '#contact')}
              className="inline-block px-6 py-2 bg-coral hover:bg-coral/90 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {isArabic ? 'اتصلوا بنا' : 'Get in Touch'}
            </a>
          </div>

          {/* Bank Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.bankInfo')}</h4>
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-coral" />
                <span className="text-sm font-medium">
                  {isArabic ? bankInfo.bankNameAr : bankInfo.bankName}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-white/50 text-xs">IBAN</p>
                <p className="text-white/90 text-xs font-mono break-all" dir="ltr">
                  {bankInfo.iban}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-white/50 text-xs">
                  {isArabic ? 'رقم الحساب' : 'Account Number'}
                </p>
                <p className="text-white/90 text-xs font-mono" dir="ltr">
                  {bankInfo.accountNumber}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/50 text-sm">
              &copy; {new Date().getFullYear()} {isArabic ? 'سكن السيد' : 'Sakan Alsayd'}. {t('footer.rights')}.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="#"
                className="text-white/50 hover:text-coral transition-colors text-sm"
              >
                {t('footer.terms')}
              </Link>
              <Link
                href="#"
                className="text-white/50 hover:text-coral transition-colors text-sm"
              >
                {t('footer.privacy')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
