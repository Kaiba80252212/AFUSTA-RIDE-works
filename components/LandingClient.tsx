'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Home,
  ShieldCheck,
  Zap,
  MapPin,
  CreditCard,
  CarFront,
  ArrowRight,
  CalendarCheck,
  ChevronDown,
  Menu,
  X,
  CheckCircle2,
  Loader2,
  Users,
  Clock,
  Phone,
  Mail,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { AuthModal } from './AuthModal';
import { QuickThemeButton } from './ThemeProvider';
import { MEDIA_ASSETS } from '@/lib/media';
import {
  CAMPUS_STOPS,
  RIDE_TYPE_CONFIG,
  RideType,
  calculateEtaMinutes,
  calculateFare,
  formatNaira,
  getPopularCampusRoutes,
} from '@/lib/campus-transit';
import {
  PortalUserRole,
  resolveBookingCtaHref,
  resolvePortalHref,
} from '@/lib/navigation';

interface PublicSummary {
  activeTricycles: number;
  campusStopsCount: number;
}

const FAQS = [
  {
    q: 'How do I book an AFUSTA campus tricycle?',
    a: 'Select your pickup point and destination in the Book a Ride panel above or inside the Student Dashboard, choose Normal, Shared, or Express ride type, and tap Find Ride to dispatch the nearest verified driver.',
  },
  {
    q: 'What are the standard tricycle fares across AFUSTA campus?',
    a: 'Standard Normal Ride fares range between ₦150 and ₦300 depending on distance (for example, Main Gate to Central Library is ₦200). Shared rides offer 35% savings for students on common routes.',
  },
  {
    q: 'Can I pay without physical cash?',
    a: 'Yes. You can fund your AFUSTA Ride Wallet and pay seamlessly upon booking, or choose Cash on Arrival if you prefer paying the driver directly.',
  },
  {
    q: 'How are drivers verified for student safety?',
    a: 'Every driver is registered with the AFUSTA Campus Transport Directorate, assigned a tracked fleet code (e.g. AFU-102-KE), and verified before receiving ride requests.',
  },
  {
    q: 'What are the daily campus operating hours?',
    a: 'Verified tricycles operate daily from 6:00 AM to 10:30 PM, covering Main Gate, Senate Building, Central Library, Academic Faculties, Hostels, and the Medical Center.',
  },
];

export function LandingClient({
  initialUserRole = null,
}: {
  initialUserRole?: PortalUserRole;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'login' | 'signup';
    promptNotice?: string | null;
    onSuccessRedirect?: string;
  }>({
    open: false,
    mode: 'login',
  });

  const [fromStopId, setFromStopId] = useState('main-gate');
  const [toStopId, setToStopId] = useState('library');
  const [rideType, setRideType] = useState<RideType>('normal');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    ref: string;
    driverName: string;
    plateNumber: string;
    fare: number;
  } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [summary, setSummary] = useState<PublicSummary>({
    activeTricycles: 2,
    campusStopsCount: CAMPUS_STOPS.length,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCategory, setContactCategory] = useState('Student Ride Support');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactStatus, setContactStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/public/summary', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.activeTricycles === 'number') {
          setSummary({
            activeTricycles: d.activeTricycles,
            campusStopsCount: d.campusStopsCount || CAMPUS_STOPS.length,
          });
        }
      })
      .catch(() => {});
  }, []);

  const sameStops = fromStopId === toStopId;
  const estimatedFare = sameStops ? 0 : calculateFare(fromStopId, toStopId, rideType);
  const estimatedEta = sameStops ? 0 : calculateEtaMinutes(fromStopId, toStopId);
  const popularRoutes = getPopularCampusRoutes();
  const bookRideHref = resolveBookingCtaHref({
    authenticatedRole: initialUserRole,
    fromStopId,
    toStopId,
    rideType,
  });
  const studentPortalHref = resolvePortalHref(initialUserRole, 'STUDENT');
  const driverPortalHref = resolvePortalHref(initialUserRole, 'DRIVER');

  async function handleQuickFindRide(e: React.FormEvent) {
    e.preventDefault();
    setBookingError(null);
    setBookingResult(null);

    if (sameStops) {
      setBookingError('Pickup and destination must be different stops.');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromStopId,
          toStopId,
          rideType,
          paymentMethod: 'wallet',
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setAuthModal({
          open: true,
          mode: 'login',
          promptNotice: 'Sign in with your Student account to confirm and dispatch this ride.',
          onSuccessRedirect: `/student?tab=book&from=${fromStopId}&to=${toStopId}&type=${rideType}`,
        });
        return;
      }
      if (res.status === 403) {
        throw new Error('Only registered Student accounts can dispatch rides.');
      }
      if (!res.ok) throw new Error(data.error || 'Unable to book ride');
      setBookingResult({
        ref: data.ride.bookingRef,
        driverName: data.ride.driverName,
        plateNumber: data.ride.plateNumber,
        fare: data.ride.fare,
      });
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactStatus(null);
    setContactSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          category: contactCategory,
          message: contactMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setContactStatus({
        type: 'success',
        text: 'Thank you. Your inquiry has been logged with the AFUSTA Transport Directorate.',
      });
      setContactName('');
      setContactEmail('');
      setContactMessage('');
    } catch (err) {
      setContactStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send message',
      });
    } finally {
      setContactSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] dark:bg-[#0E1621] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* HERO SECTION WITH INTEGRATED HEADER & GLASS BOOKING CARD (MATCHING REFERENCE) */}
      <section className="relative w-full bg-[#0A1612] text-white overflow-hidden">
        {/* Campus Main Gate + Green Tricycle Background Photo */}
        <div className="absolute inset-0">
          <Image
            src={MEDIA_ASSETS.heroCampusGate}
            alt="AFUSTA Main Campus Gate with green and white campus tricycle"
            fill
            priority
            sizes="100vw"
            referrerPolicy="no-referrer"
            className="object-cover object-center"
          />
          {/* Solid flat dark translucent scrim — strictly zero CSS gradients */}
          <div className="absolute inset-0 bg-black/55" />
        </div>

        {/* Top Navigation Bar */}
        <header className="relative z-20 bg-[#0B1713]/75 backdrop-blur-md border-b border-white/15">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-20 items-center justify-between gap-8">
            {/* Zone 1: Brand */}
            <Link href="/" prefetch={false} className="shrink-0">
              <BrandLogo variant="dark" size="md" />
            </Link>

            {/* Zone 2: Single-line Navigation Links */}
            <nav
              aria-label="Primary navigation"
              className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-200"
            >
              <a
                href="#top"
                className="inline-flex items-center gap-1.5 text-white font-semibold border-b-2 border-emerald-500 pb-1 whitespace-nowrap shrink-0"
              >
                <Home className="h-4 w-4 text-emerald-400" />
                <span>Home</span>
              </a>
              <a
                href="#about"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                About
              </a>
              <a
                href="#services"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Services
              </a>
              <a
                href="#how-it-works"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                How It Works
              </a>
              <a
                href="#faqs"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                FAQs
              </a>
              <a
                href="#contact"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Contact
              </a>
            </nav>

            {/* Zone 3: Theme + Login / Sign Up Actions */}
            <div className="hidden lg:flex items-center gap-2.5 shrink-0">
              <QuickThemeButton syncServer={false} variant="overlay" />
              {initialUserRole ? (
                <a
                  href={initialUserRole === 'DRIVER' ? '/driver' : '/student'}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(22,163,74,0.35)]"
                >
                  <span>
                    {initialUserRole === 'DRIVER' ? 'Driver Dashboard' : 'Student Dashboard'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAuthModal({ open: true, mode: 'login' })}
                    className="rounded-xl border border-white/40 bg-black/30 backdrop-blur-md px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModal({ open: true, mode: 'signup' })}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(22,163,74,0.35)]"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden rounded-xl border border-white/25 bg-black/40 p-2 text-white"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile Menu Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-2 rounded-2xl bg-[#0B1713]/95 backdrop-blur-xl border border-white/20 p-4 space-y-2">
              {[
                { label: 'Home', href: '#top' },
                { label: 'About', href: '#about' },
                { label: 'Services', href: '#services' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'FAQs', href: '#faqs' },
                { label: 'Contact', href: '#contact' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 border-t border-white/15 space-y-2">
                <QuickThemeButton syncServer={false} variant="overlay" className="w-full justify-center" />
                {initialUserRole ? (
                  <a
                    href={initialUserRole === 'DRIVER' ? '/driver' : '/student'}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white"
                  >
                    <span>
                      {initialUserRole === 'DRIVER' ? 'Driver Dashboard' : 'Student Dashboard'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthModal({ open: true, mode: 'login' });
                      }}
                      className="rounded-xl border border-white/30 py-2 text-sm font-semibold text-white"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthModal({ open: true, mode: 'signup' });
                      }}
                      className="rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white"
                    >
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </header>

        {/* Hero Main Content Split */}
        <div
          id="top"
          className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:py-16"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Headline & CTAs */}
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight leading-[1.1] text-balance">
                Your Campus Ride,
                <br />
                <span className="text-[#22C55E]">Just a Click Away</span>
              </h1>

              <p className="max-w-xl text-base sm:text-lg text-slate-100 leading-relaxed">
                Book tricycles within AFUSTA campus, track your ride in real-time, and travel safely, conveniently and affordably.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <a
                  href={bookRideHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm sm:text-base font-semibold text-white hover:bg-emerald-700 transition-colors shadow-[0_8px_24px_rgba(22,163,74,0.35)] whitespace-nowrap"
                >
                  <CalendarCheck className="h-4 w-4" />
                  <span>Book a Ride</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#about"
                  className="inline-flex items-center justify-center rounded-xl border border-white/45 bg-black/35 backdrop-blur-md px-6 py-3 text-sm sm:text-base font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap"
                >
                  Learn More
                </a>
              </div>
            </div>

            {/* Right Floating White Glassmorphism "Book a Ride" Card (matching reference) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <form
                onSubmit={handleQuickFindRide}
                className="w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-xl border border-white p-6 text-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <span className="relative h-8 w-8 overflow-hidden rounded-lg border border-emerald-500/40 bg-[#0B1713] shrink-0">
                      <Image
                        src={MEDIA_ASSETS.logo}
                        alt="AFUSTA Ride Icon"
                        fill
                        sizes="32px"
                        referrerPolicy="no-referrer"
                        className="object-cover"
                      />
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">Book a Ride</h2>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                    {summary.activeTricycles} Active Nearby
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div>
                    <label
                      htmlFor="hero-from"
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      From
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                      <select
                        id="hero-from"
                        value={fromStopId}
                        onChange={(e) => {
                          setFromStopId(e.target.value);
                          setBookingResult(null);
                          setBookingError(null);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                      >
                        {CAMPUS_STOPS.map((stop) => (
                          <option key={stop.id} value={stop.id}>
                            {stop.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="hero-to"
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      To
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                      <select
                        id="hero-to"
                        value={toStopId}
                        onChange={(e) => {
                          setToStopId(e.target.value);
                          setBookingResult(null);
                          setBookingError(null);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                      >
                        {CAMPUS_STOPS.map((stop) => (
                          <option key={stop.id} value={stop.id}>
                            {stop.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="hero-type"
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      Ride Type
                    </label>
                    <div className="relative">
                      <CarFront className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                      <select
                        id="hero-type"
                        value={rideType}
                        onChange={(e) => {
                          setRideType(e.target.value as RideType);
                          setBookingResult(null);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                      >
                        {Object.entries(RIDE_TYPE_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>
                            {cfg.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Live Fare Summary Row */}
                  {!sameStops && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs">
                      <span className="text-slate-600 font-medium">
                        Est. Arrival: <strong className="text-slate-900 tabular-nums">~{estimatedEta} min</strong>
                      </span>
                      <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                        {formatNaira(estimatedFare)}
                      </span>
                    </div>
                  )}

                  {bookingError && (
                    <p role="alert" className="text-xs font-semibold text-red-600">
                      {bookingError}
                    </p>
                  )}

                  {bookingResult && (
                    <div
                      role="status"
                      className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Ride {bookingResult.ref} Dispatched</span>
                        </span>
                        <span className="tabular-nums">{formatNaira(bookingResult.fare)}</span>
                      </div>
                      <p className="text-emerald-800">
                        Driver: {bookingResult.driverName} ({bookingResult.plateNumber})
                      </p>
                      <button
                        type="button"
                        onClick={() => window.location.assign('/student')}
                        className="font-semibold text-emerald-700 underline hover:text-emerald-900"
                      >
                        Track live in Student Dashboard →
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={bookingLoading || sameStops}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-[0_6px_18px_rgba(22,163,74,0.25)]"
                  >
                    {bookingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Find Ride</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom 4-Column Glass Feature Strip (matching reference) */}
        <div className="relative z-10 bg-[#0B1713]/80 backdrop-blur-xl border-t border-white/15">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/15">
              <div className="flex items-center gap-3.5 py-4 px-2 lg:px-6">
                <ShieldCheck className="h-7 w-7 text-[#22C55E] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Safe &amp; Reliable</p>
                  <p className="text-xs text-slate-300">Verified Drivers</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 py-4 px-2 lg:px-6">
                <Zap className="h-7 w-7 text-[#22C55E] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Quick Booking</p>
                  <p className="text-xs text-slate-300">In Seconds</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 py-4 px-2 lg:px-6">
                <MapPin className="h-7 w-7 text-[#22C55E] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Campus Wide</p>
                  <p className="text-xs text-slate-300">All Routes Covered</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 py-4 px-2 lg:px-6">
                <CreditCard className="h-7 w-7 text-[#22C55E] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Cashless Payment</p>
                  <p className="text-xs text-slate-300">Pay with Ease</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: STUDENT & DRIVER PORTALS */}
      <section id="services" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-slate-200 dark:border-[#2B3848]">
          <div>
            <p className="text-xs font-semibold text-[#2481CC] dark:text-[#4EA4F6]">Campus Mobility Platform</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Dedicated Rider &amp; Driver Portals
            </h2>
          </div>
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
            Secure role-authenticated workspaces for AFUSTA students and verified campus tricycle drivers.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Student Portal Card */}
          <div className="glass-surface rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2B3848]">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 overflow-hidden rounded-full border border-emerald-500">
                    <Image
                      src={MEDIA_ASSETS.avatarStudent}
                      alt="AFUSTA Student Rider"
                      fill
                      sizes="44px"
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Student Dashboard</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Instant Dispatch &amp; Cashless Wallet</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Mapped Stops</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {summary.campusStopsCount} Locations
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Base Campus Fare</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">From ₦150</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Book tricycles across all mapped campus landmarks, track assigned drivers live on the campus route map, manage your wallet balance, and review completed trips.
              </p>
            </div>

            <a
              href={studentPortalHref}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <span>
                {initialUserRole === 'STUDENT' ? 'Open Student Dashboard' : 'Student Portal Sign In'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Driver Portal Card */}
          <div className="glass-surface rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2B3848]">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 overflow-hidden rounded-full border border-emerald-500">
                    <Image
                      src={MEDIA_ASSETS.avatarDriver}
                      alt="Verified AFUSTA Driver"
                      fill
                      sizes="44px"
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Driver Dashboard</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Verified Tricycle Fleet Operations</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active Fleet Online</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {summary.activeTricycles} Units
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Operating Window</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">6AM – 10:30PM</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Toggle live campus availability, accept or decline incoming student ride requests, manage pickup and drop-off statuses, and track daily earnings.
              </p>
            </div>

            <a
              href={driverPortalHref}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
            >
              <span>
                {initialUserRole === 'DRIVER' ? 'Open Driver Dashboard' : 'Driver Portal Sign In'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 2: ABOUT & CAMPUS ROUTE FARE TABLE */}
      <section id="about" className="bg-white dark:bg-[#17212B] border-y border-slate-200 dark:border-[#2B3848] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-semibold text-[#2481CC] dark:text-[#4EA4F6]">Case Study · AFUSTA Campus</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              Structured, Cashless Mobility Across Every Academic Zone
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              AFUSTA Ride replaces unpredictable roadside boarding and fare disputes with transparent campus tariffs, verified driver assignments, and real-time trip tracking from Main Gate to hostels and lecture theatres.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3.5">
                <MapPin className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] mb-1" />
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {summary.campusStopsCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Campus Stops</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3.5">
                <Users className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] mb-1" />
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {summary.activeTricycles}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Active Tricycles</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3.5">
                <Clock className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] mb-1" />
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">~5 min</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Avg. Pickup Wait</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 glass-surface rounded-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2B3848]">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Approved AFUSTA Campus Tariffs</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any route to load it into the quick booking form
                </p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2B3848] text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-4">Route</th>
                    <th className="py-2.5 pr-4 text-right">Distance / ETA</th>
                    <th className="py-2.5 pr-4 text-right">Shared</th>
                    <th className="py-2.5 pr-4 text-right">Normal</th>
                    <th className="py-2.5 text-right">Express</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2B3848] text-sm">
                  {popularRoutes.map((route) => (
                    <tr
                      key={`${route.from.id}-${route.to.id}`}
                      className="hover:bg-sky-50/50 dark:hover:bg-[#1E2936] transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => {
                            setFromStopId(route.from.id);
                            setToStopId(route.to.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-left font-semibold text-slate-900 dark:text-slate-100 hover:text-[#2481CC] dark:hover:text-[#4EA4F6]"
                        >
                          {route.from.shortName} → {route.to.shortName}
                        </button>
                      </td>
                      <td className="py-3 pr-4 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {route.distanceKm} km · {route.etaMinutes}m
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNaira(route.sharedFare)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatNaira(route.normalFare)}
                      </td>
                      <td className="py-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNaira(route.expressFare)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[#2481CC] dark:text-[#4EA4F6]">Simple Workflow</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            How AFUSTA Ride Works
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              step: '01. Select Campus Stops',
              desc: 'Pick your pickup stand and destination across 10 mapped AFUSTA landmarks.',
            },
            {
              step: '02. Review Fixed Fare',
              desc: 'See exact Naira pricing for Shared, Normal, or Express rides before confirming.',
            },
            {
              step: '03. Match Verified Driver',
              desc: 'Nearest available campus tricycle accepts your request with plate number details.',
            },
            {
              step: '04. Ride & Pay Cashless',
              desc: 'Track arrival live on the campus route map and settle automatically via Wallet.',
            },
          ].map((item) => (
            <div key={item.step} className="glass-surface rounded-2xl p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{item.step}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: FAQs */}
      <section id="faqs" className="bg-white dark:bg-[#17212B] border-y border-slate-200 dark:border-[#2B3848] py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-center">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-slate-50/50 dark:bg-[#1E2936] overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-[#232E3C] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 5: CONTACT & FOOTER */}
      <section id="contact" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-semibold text-[#2481CC] dark:text-[#4EA4F6]">Transport Directorate</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Contact AFUSTA Transport Support
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Need assistance with wallet funding, lost campus items, or driver registration? Reach the Campus Mobility Desk directly.
            </p>
            <div className="pt-2 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
              <p className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                <span>Transport Office, Senate Annex, AFUSTA Main Campus</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                <span className="tabular-nums">+234 800 238 7820</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                <span>transport@afusta.edu.ng</span>
              </p>
            </div>
          </div>

          <form
            onSubmit={handleContactSubmit}
            className="lg:col-span-7 glass-surface rounded-2xl p-6 space-y-4"
          >
            {contactStatus && (
              <div
                role={contactStatus.type === 'error' ? 'alert' : 'status'}
                className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                  contactStatus.type === 'success'
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'
                }`}
              >
                {contactStatus.text}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="c-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your Name
                </label>
                <input
                  id="c-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Mubarak Abubakar"
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="c-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  id="c-email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="student@afusta.edu.ng"
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="c-cat" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Inquiry Category
              </label>
              <select
                id="c-cat"
                value={contactCategory}
                onChange={(e) => setContactCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
              >
                <option value="Student Ride Support">Student Ride Support</option>
                <option value="Driver Onboarding">Driver Onboarding</option>
                <option value="Wallet & Billing">Wallet &amp; Billing</option>
                <option value="Lost & Found">Lost &amp; Found</option>
              </select>
            </div>
            <div>
              <label htmlFor="c-msg" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Message
              </label>
              <textarea
                id="c-msg"
                rows={3}
                required
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe how the campus transport team can help..."
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={contactSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-5 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-50"
            >
              {contactSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Send Message</span>
            </button>
          </form>
        </div>
      </section>

      <footer className="bg-[#0B1713] text-slate-300 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo variant="dark" size="sm" />
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <a href={studentPortalHref} className="hover:text-white">
              {initialUserRole === 'STUDENT' ? 'Student Dashboard' : 'Student Sign In'}
            </a>
            <a href={driverPortalHref} className="hover:text-white">
              {initialUserRole === 'DRIVER' ? 'Driver Dashboard' : 'Driver Sign In'}
            </a>
            <a
              href={initialUserRole ? (initialUserRole === 'DRIVER' ? '/driver' : '/student') : '/signup'}
              className="hover:text-white"
            >
              {initialUserRole ? 'My Portal' : 'Create Account'}
            </a>
          </div>
          <p className="text-xs text-slate-400">
            © 2026 AFUSTA Ride · Campus Tricycle Booking System
          </p>
        </div>
      </footer>

      {authModal.open && (
        <AuthModal
          key={`${authModal.mode}-${authModal.onSuccessRedirect || 'default'}`}
          open={authModal.open}
          initialMode={authModal.mode}
          promptNotice={authModal.promptNotice}
          onSuccessRedirect={authModal.onSuccessRedirect}
          onClose={() => setAuthModal((prev) => ({ ...prev, open: false, promptNotice: null }))}
        />
      )}
    </div>
  );
}
