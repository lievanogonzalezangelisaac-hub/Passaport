import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PassportBook } from './components/PassportBook';
import { GuidePortal } from './components/GuidePortal';
import { QRScannerModal } from './components/QRScannerModal';
import { StampDetailModal } from './components/StampDetailModal';
import { EditTravelerModal } from './components/EditTravelerModal';
import { Stamp, TravelerProfile } from './types';
import { INITIAL_TRAVELER, createInitialTraveler, generateRandomPassportNumber, INITIAL_STAMPS } from './utils/sampleData';
import { soundManager } from './utils/audio';
import { Compass, Sparkles, Award, MapPin, CheckCircle2, Edit3 } from 'lucide-react';

const STORAGE_KEYS = {
  STAMPS: 'passport_device_stamps_persistent_v1',
  TRAVELER: 'passport_device_traveler_persistent_v1',
  ROLE: 'passport_device_role_persistent_v1'
};

export default function App() {
  // Load stamps from device persistent storage (localStorage)
  const [stamps, setStamps] = useState<Stamp[]>(() => {
    try {
      // 1. Check persistent localStorage
      const saved = localStorage.getItem(STORAGE_KEYS.STAMPS);
      if (saved) {
        const parsed: Stamp[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      // 2. Migration fallback from earlier session storage
      const sessionSaved = sessionStorage.getItem('passport_stamps_session_v1');
      if (sessionSaved) {
        const parsed: Stamp[] = JSON.parse(sessionSaved);
        if (Array.isArray(parsed)) {
          localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error loading saved stamps:", e);
    }
    return [];
  });

  // Load traveler profile from device persistent storage (localStorage)
  const [traveler, setTraveler] = useState<TravelerProfile>(() => {
    try {
      // 1. Check persistent localStorage
      const saved = localStorage.getItem(STORAGE_KEYS.TRAVELER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.passportNumber) {
            parsed.passportNumber = generateRandomPassportNumber();
          }
          parsed.nationality = 'MEXICAN';
          parsed.nationalityCode = 'MEX';
          if (parsed.language === 'English' || parsed.language === 'Inglés') {
            parsed.language = 'English';
          } else {
            parsed.language = 'Spanish';
          }
          return parsed;
        }
      }

      // 2. Migration fallback from earlier session storage
      const sessionSaved = sessionStorage.getItem('passport_traveler_session_v1');
      if (sessionSaved) {
        const parsed = JSON.parse(sessionSaved);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.passportNumber) {
            parsed.passportNumber = generateRandomPassportNumber();
          }
          parsed.nationality = 'MEXICAN';
          parsed.nationalityCode = 'MEX';
          if (parsed.language === 'English' || parsed.language === 'Inglés') {
            parsed.language = 'English';
          } else {
            parsed.language = 'Spanish';
          }
          localStorage.setItem(STORAGE_KEYS.TRAVELER, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error loading saved traveler:", e);
    }

    // New visitor on this device: generate clean initial profile with unique passport number
    const initial = createInitialTraveler();
    try {
      localStorage.setItem(STORAGE_KEYS.TRAVELER, JSON.stringify(initial));
    } catch {
      // Ignore
    }
    return initial;
  });

  // Load active view role from persistent storage
  const [currentRole, setCurrentRole] = useState<'traveler' | 'guide'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
      if (saved === 'guide' || saved === 'traveler') return saved;
      const sessionSaved = sessionStorage.getItem('passport_user_role_v1');
      if (sessionSaved === 'guide' || sessionSaved === 'traveler') return sessionSaved;
    } catch {
      // Ignore
    }
    return 'traveler';
  });

  const [selectedStamp, setSelectedStamp] = useState<Stamp | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [lastGeneratedStamp, setLastGeneratedStamp] = useState<Stamp | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state to persistent localStorage automatically whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(stamps));
    } catch (e) {
      console.error("Error saving stamps to localStorage:", e);
    }
  }, [stamps]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRAVELER, JSON.stringify(traveler));
    } catch (e) {
      console.error("Error saving traveler to localStorage:", e);
    }
  }, [traveler]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE, currentRole);
    } catch (e) {
      console.error("Error saving role to localStorage:", e);
    }
  }, [currentRole]);

  // Listen to multi-tab storage events to keep device tabs in sync smoothly without full page reloads
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TRAVELER && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setTraveler(parsed);
        } catch {}
      } else if (e.key === STORAGE_KEYS.STAMPS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setStamps(parsed);
        } catch {}
      } else if (e.key === STORAGE_KEYS.ROLE && e.newValue) {
        if (e.newValue === 'traveler' || e.newValue === 'guide') {
          setCurrentRole(e.newValue);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add a new stamp into the traveler's passport
  const handleStampAcquired = (newStamp: Stamp) => {
    // Determine page placement: 2 stamps per page starting at page 1
    const targetPage = Math.floor(stamps.length / 2) + 1;
    const finalStamp: Stamp = {
      ...newStamp,
      id: newStamp.id || `stamp-${Date.now()}`,
      pageNumber: Math.min(targetPage, 8),
      stampedAtTimestamp: Date.now()
    };

    setStamps(prev => [finalStamp, ...prev]);
    showToast(`New official stamp from ${finalStamp.country} recorded on Page ${finalStamp.pageNumber}!`);
  };

  // When guide issues stamp directly
  const handleIssueDirectlyFromGuide = (stamp: Stamp) => {
    setLastGeneratedStamp(stamp);
    handleStampAcquired(stamp);
    // Switch to traveler mode automatically so they see their stamped passport
    setCurrentRole('traveler');
  };

  // Reset demo data
  const handleResetData = () => {
    const confirmMsg = currentRole === 'traveler'
      ? "Reset passport stamps back to original sample collection?"
      : "¿Deseas reiniciar los sellos a los valores originales de muestra?";
    if (confirm(confirmMsg)) {
      setStamps(INITIAL_STAMPS);
      setTraveler(INITIAL_TRAVELER);
      showToast(currentRole === 'traveler' ? "Passport restored with initial sample stamps." : "Pasaporte restaurado con los sellos iniciales.");
    }
  };

  // Unique countries count
  const uniqueCountries = new Set(stamps.map(s => s.countryCode || s.country)).size;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Top Header with Role Switcher */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        stampsCount={stamps.length}
        countriesCount={uniqueCountries}
        onResetData={handleResetData}
        onOpenScanner={() => setIsScannerOpen(true)}
        onEditProfile={() => setIsEditProfileOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start sm:justify-center items-center px-1 py-1.5 sm:p-6 max-w-7xl mx-auto w-full">
        
        {currentRole === 'traveler' ? (
          /* VIAJANTE (TRAVELER) VIEW: 100% IN ENGLISH */
          <div className="w-full flex flex-col items-center">
            {/* Realistic Passport Book (Mobile Fullscreen / Desktop Spread) */}
            <PassportBook
              traveler={traveler}
              stamps={stamps}
              onSelectStamp={setSelectedStamp}
              onOpenScanner={() => setIsScannerOpen(true)}
              onEditProfile={() => setIsEditProfileOpen(true)}
            />
          </div>
        ) : (
          /* GUÍA VIEW: Generate Activity Stamp & QR Code (100% IN SPANISH) */
          <GuidePortal
            onIssueStampDirectly={handleIssueDirectlyFromGuide}
            onSwitchToTraveler={() => setCurrentRole('traveler')}
          />
        )}
      </main>

      {/* Modals */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onStampAcquired={handleStampAcquired}
        lastGeneratedStamp={lastGeneratedStamp}
      />

      <StampDetailModal
        stamp={selectedStamp}
        onClose={() => setSelectedStamp(null)}
      />

      <EditTravelerModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        profile={traveler}
        onSave={(updated) => {
          setTraveler(updated);
          showToast("Passport details updated successfully!");
        }}
      />

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-amber-500 text-stone-950 font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs border border-amber-300 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
