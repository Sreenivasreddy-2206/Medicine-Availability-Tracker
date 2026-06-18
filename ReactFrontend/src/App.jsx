import { useState, useEffect, useRef } from 'react';
import { API_URL } from "./config";

// MEDICINE PLACEHOLDERS CYCLING FOR SEARCH BAR
const PLACEHOLDERS = [
  'Paracetamol...',
  'Amoxicillin...',
  'Metformin...',
  'Ibuprofen...',
  'Atorvastatin...',
  'Omeprazole...',
  'Aspirin...',
  'Cetirizine...'
];

// Custom JWT Decoder matching app.js
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function isTokenValid(exp) {
  if (!exp) return false;
  const currentTime = Math.floor(Date.now() / 1000);
  return exp > currentTime;
}

// CLIENT-SIDE DISTANCE CALCULATION (HAVERSINE)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

function App() {
  // Navigation & Auth States
  const [activeView, setActiveView] = useState('landing');
  const [token, setToken] = useState(localStorage.getItem('medsynapse_token') || null);
  const [user, setUser] = useState(null);

  // User coordinates and City Name (Default to Vijayawada, AP coords)
  const [userCoords, setUserCoords] = useState({ lat: 16.506, lng: 80.648 });
  const [cityName, setCityName] = useState('Vijayawada, AP');
  const [gpsStatus, setGpsStatus] = useState('Detecting your location...');

  // Search Results
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [miniSearchQuery, setMiniSearchQuery] = useState('');
  const [searchMetaLocation, setSearchMetaLocation] = useState('Detecting your distance...');
  const [searchTitle, setSearchTitle] = useState('Results for "..."');
  const [isSearching, setIsSearching] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // User Auth UI States
  const [authTab, setAuthTab] = useState('signin'); // 'signin' vs 'signup'
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Admin Auth UI States
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isOtpSending, setIsOtpSending] = useState(false);

  // Admin Dashboard States
  const [adminActiveTab, setAdminActiveTab] = useState('users');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminPharmacies, setAdminPharmacies] = useState([]);
  const [adminMedicines, setAdminMedicines] = useState([]);
  const [adminMetrics, setAdminMetrics] = useState({ users: 0, pharmacies: 0, medicines: 0 });
  const [isAdminTableLoading, setIsAdminTableLoading] = useState(false);
  const [isSeedingPharmacies, setIsSeedingPharmacies] = useState(false);
  const [isSeedingMedicines, setIsSeedingMedicines] = useState(false);

  // User Dropdown State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Search Placeholder cycling State
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search for a medicine...');

  // Custom Toast State
  const [toasts, setToasts] = useState([]);

  // Leaflet map ref & instance tracking
  const mapInstanceRef = useRef(null);
  const carouselRef = useRef(null);

  // Helper: Show Toast
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, isOut: false }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isOut: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 4000);
  };

  // Check Token on Startup
  useEffect(() => {
    if (token) {
      const payload = parseJwt(token);
      if (payload && isTokenValid(payload.exp)) {
        setUser(payload);
        if (payload.role === 'admin') {
          setActiveView('admin-dashboard');
        } else {
          setActiveView('user-dashboard');
        }
      } else {
        handleLogout(false);
      }
    } else {
      setActiveView('landing');
    }
  }, [token]);

  // Geolocation & Reverse Geocoding
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserCoords({ lat, lng });

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            );
            const data = await res.json();
            if (data && data.address) {
              const city =
                data.address.city ||
                data.address.town ||
                data.address.suburb ||
                data.address.village ||
                'Nearby';
              const state = data.address.state ? `, ${data.address.state}` : '';
              const cName = `${city}${state}`;
              setCityName(cName);
              setGpsStatus(`Logged at ${cName}`);
            }
          } catch (err) {
            console.error('OSM Reverse Geocoding failed:', err);
            setCityName('Current Location');
            setGpsStatus('Logged at Current Location');
          }
        },
        (error) => {
          console.warn('Geolocation permission denied/failed. Using defaults.', error);
          setGpsStatus('Using default: Vijayawada, AP');
        }
      );
    } else {
      setGpsStatus('Geolocation unsupported.');
    }
  }, []);

  // 3D Card mouse tracking tilt
  useEffect(() => {
    const handleMouseMove = (e) => {
      const cards = document.querySelectorAll('[data-tilt]');
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardX = rect.left + rect.width / 2;
        const cardY = rect.top + rect.height / 2;

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const maxRotate = 15;
        const dx = (mouseX - cardX) / (window.innerWidth / 2);
        const dy = (mouseY - cardY) / (window.innerHeight / 2);

        const rotateX = (-dy * maxRotate).toFixed(2);
        const rotateY = (dx * maxRotate).toFixed(2);

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;

        const glow = card.querySelector('.card-glow');
        if (glow) {
          const px = ((mouseX - rect.left) / rect.width) * 100;
          const py = ((mouseY - rect.top) / rect.height) * 100;
          glow.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255, 255, 255, 0.15) 0%, transparent 60%)`;
        }
      });
    };

    const handleMouseOut = (e) => {
      const card = e.target.closest('[data-tilt]');
      if (card) {
        const rect = card.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
          const glow = card.querySelector('.card-glow');
          if (glow) {
            glow.style.background = `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08) 0%, transparent 60%)`;
          }
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseout', handleMouseOut);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  // Search input placeholder cycle (user dashboard only)
  useEffect(() => {
    if (activeView !== 'user-dashboard') return;
    let idx = 0;
    const interval = setInterval(() => {
      setSearchPlaceholder(`Search for ${PLACEHOLDERS[idx]}`);
      idx = (idx + 1) % PLACEHOLDERS.length;
    }, 2500);
    return () => clearInterval(interval);
  }, [activeView]);

  // Handle Admin OTP countdown cooldown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Leaflet map initialization logic
  useEffect(() => {
    if (activeView !== 'search-results') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const container = document.getElementById('results-map');
      if (!container || !window.L) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const L = window.L;
      const map = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView([userCoords.lat, userCoords.lng], 13);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // User coord pin
      const userIcon = L.divIcon({
        html: `<div style="background-color: var(--accent-blue); width: 14px; height: 14px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0, 136, 255, 0.8);"></div>`,
        className: 'custom-map-pin',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>Your Current Location</b>')
        .openPopup();

      mapInstanceRef.current = map;

      if (!searchResults || searchResults.length === 0) return;

      const bounds = L.latLngBounds([[userCoords.lat, userCoords.lng]]);

      searchResults.forEach((item) => {
        const pharm = item.pharmacyId;
        if (!pharm || !pharm.latitude || !pharm.longitude) return;

        let markerColor = 'var(--primary)'; // Green
        let shadowColor = 'rgba(0, 255, 127, 0.6)';
        if (item.quantity <= 0) {
          markerColor = '#FF3B30'; // Red
          shadowColor = 'rgba(255, 59, 48, 0.6)';
        } else if (item.quantity <= 15) {
          markerColor = '#FFB300'; // Yellow
          shadowColor = 'rgba(255, 179, 0, 0.6)';
        }

        const pinIcon = L.divIcon({
          html: `<div style="background-color: ${markerColor}; width: 16px; height: 16px; border: 2px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 0 12px ${shadowColor};"></div>`,
          className: 'custom-pharmacy-pin',
          iconSize: [16, 16],
          iconAnchor: [8, 16]
        });

        L.marker([pharm.latitude, pharm.longitude], { icon: pinIcon })
          .addTo(map)
          .bindPopup(`
            <div style="color: #050d0a; font-family: 'Inter', sans-serif; min-width: 150px;">
              <h4 style="margin: 0 0 4px; font-weight:600; font-size:0.9rem;">${pharm.pharmacyName}</h4>
              <p style="margin: 0 0 8px; font-size:0.75rem; color:#666;">${pharm.address}</p>
              <strong style="color:${markerColor}">${item.medicineName}</strong> - ${item.quantity} strips in stock
            </div>
          `);

        bounds.extend([pharm.latitude, pharm.longitude]);
      });

      map.fitBounds(bounds, { padding: [40, 40] });
    }, 150);

    return () => clearTimeout(timer);
  }, [activeView, searchResults, userCoords]);

  // Load Admin metrics and table data on view or tab load
  useEffect(() => {
    if (activeView === 'admin-dashboard') {
      loadAdminMetrics();
      loadAdminTabData();
    }
  }, [activeView, adminActiveTab]);

  // Fetch alternatives when results are empty on results page
  useEffect(() => {
    if (activeView === 'search-results' && searchResults.length === 0) {
      loadAlternatives();
    }
  }, [activeView, searchResults]);

  // API Call: User registration
  const handleUserSignUp = async (e) => {
    e.preventDefault();
    if (signUpPassword !== signUpConfirm) {
      showToast('Passwords do not match!', 'error');
      return;
    }

    setIsAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signUpName,
          email: signUpEmail,
          password: signUpPassword,
          role: 'user'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Registration failed');

      showToast('Registration Successful! Please Sign In.');
      setSignUpName('');
      setSignUpEmail('');
      setSignUpPassword('');
      setSignUpConfirm('');
      setAuthTab('signin');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // API Call: User Login
  const handleUserSignIn = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signInEmail, password: signInPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Invalid credentials');

      const payload = parseJwt(data.token);
      if (payload.role !== 'user') {
        throw new Error('Access Denied: Standard user account required.');
      }

      localStorage.setItem('medsynapse_token', data.token);
      setToken(data.token);
      setUser(payload);
      showToast('Welcome back to MedSynapse!');
      setActiveView('user-dashboard');
      setSignInEmail('');
      setSignInPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // API Call: Request admin OTP
  const handleRequestAdminOtp = async (e) => {
    e.preventDefault();
    if (!adminEmail) {
      showToast('Please enter your Admin Email to request an OTP code.', 'error');
      return;
    }

    setIsOtpSending(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to dispatch OTP verification');

      showToast('Verification code has been successfully dispatched to your email address!', 'blue');
      setOtpCooldown(60);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsOtpSending(false);
    }
  };

  // API Call: Admin Sign In
  const handleAdminSignIn = async (e) => {
    e.preventDefault();
    if (!adminOtp) {
      showToast('OTP verification code is required to sign in.', 'error');
      return;
    }

    setIsAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          otp: adminOtp
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Authentication failed');

      const payload = parseJwt(data.token);
      if (payload.role !== 'admin') {
        throw new Error('Access Denied: Administrative role required.');
      }

      localStorage.setItem('medsynapse_token', data.token);
      setToken(data.token);
      setUser(payload);
      showToast('Admin access authenticated successfully.', 'blue');
      setActiveView('admin-dashboard');
      setAdminEmail('');
      setAdminPassword('');
      setAdminOtp('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Logout handler
  const handleLogout = (notify = true) => {
    localStorage.removeItem('medsynapse_token');
    setToken(null);
    setUser(null);
    setSearchResults([]);
    setSearchQuery('');
    setMiniSearchQuery('');
    if (notify) showToast('Logged out successfully');
    setActiveView('landing');
  };

  // Search engine execution
  const executeSearch = async (query) => {
    if (!query) return;
    setIsSearching(true);
    setSearchTitle(`Results for "${query}"`);
    setSearchMetaLocation(`Checking local stock near ${cityName}...`);
    setActiveView('search-results');
    setExpandedCardId(null);

    try {
      const res = await fetch(`${API_URL}/medicine/search/${encodeURIComponent(query)}`);
      const medicines = await res.json();
      if (!res.ok) throw new Error(medicines.error || 'Search failed');

      // Add distance property client side
      const mapped = medicines.map((med) => {
        const dist = med.pharmacyId
          ? parseFloat(
              getDistance(
                userCoords.lat,
                userCoords.lng,
                med.pharmacyId.latitude,
                med.pharmacyId.longitude
              )
            )
          : 999;
        return { ...med, distance: dist };
      });
      // Sort by proximity
      mapped.sort((a, b) => a.distance - b.distance);

      setSearchResults(mapped);
      setSearchMetaLocation(`Showing availability matching "${query}" near ${cityName}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Search Nearby Stores inside 5km
  const triggerNearbySearch = async () => {
    setIsSearching(true);
    setSearchTitle(`Stores near ${cityName}`);
    setSearchMetaLocation('Scanning pharmacies in 5km radius...');
    setActiveView('search-results');
    setExpandedCardId(null);

    try {
      const res = await fetch(`${API_URL}/pharmacy/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}`);
      const pharmacies = await res.json();
      if (!res.ok) throw new Error('Nearby query failed');

      // Fetch medicines to show nearby inventory
      const medRes = await fetch(`${API_URL}/medicine/`);
      const allMedicines = await medRes.json();

      const results = [];
      pharmacies.forEach((pharm) => {
        const medsAtPharm = allMedicines.filter(
          (m) => m.pharmacyId && m.pharmacyId._id === pharm.pharmacyId
        );
        medsAtPharm.forEach((m) => {
          results.push({
            _id: m._id,
            medicineName: m.medicineName,
            manufacturer: m.manufacturer,
            price: m.price,
            quantity: m.quantity,
            expiryDate: m.expiryDate,
            distance: parseFloat(pharm.distanceKm),
            pharmacyId: {
              _id: pharm.pharmacyId,
              pharmacyName: pharm.pharmacyName,
              address: pharm.address,
              phone: pharm.phone,
              latitude: pharm.latitude,
              longitude: pharm.longitude
            }
          });
        });
      });

      results.sort((a, b) => a.distance - b.distance);
      setSearchResults(results);
      setSearchMetaLocation(`Showing ${results.length} medicine records found in nearby pharmacies`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Search for generic substitutes / alternatives
  const loadAlternatives = async () => {
    setLoadingAlternatives(true);
    try {
      const res = await fetch(`${API_URL}/medicine`);
      const all = await res.json();
      // Filter in stock ones
      const available = all.filter((m) => m.quantity > 5);
      setAlternatives(available.slice(0, 8));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  // Carousel slider handler
  const handleScrollCarousel = (dir) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir * 200, behavior: 'smooth' });
    }
  };

  // Admin Module: Metrics loading
  const loadAdminMetrics = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [uRes, pRes, mRes] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { headers }),
        fetch(`${API_URL}/admin/pharmacies`, { headers }),
        fetch(`${API_URL}/medicine`)
      ]);
      const [users, pharmacies, medicines] = await Promise.all([
        uRes.json(),
        pRes.json(),
        mRes.json()
      ]);

      setAdminMetrics({
        users: Array.isArray(users) ? users.length : 0,
        pharmacies: Array.isArray(pharmacies) ? pharmacies.length : 0,
        medicines: Array.isArray(medicines) ? medicines.length : 0
      });
    } catch (err) {
      console.error('Failed loading metrics', err);
    }
  };

  // Admin Module: Tab details loading
  const loadAdminTabData = async () => {
    if (!token) return;
    setIsAdminTableLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (adminActiveTab === 'users') {
        const res = await fetch(`${API_URL}/admin/users`, { headers });
        const data = await res.json();
        setAdminUsers(Array.isArray(data) ? data : []);
      } else if (adminActiveTab === 'pharmacies') {
        const res = await fetch(`${API_URL}/admin/pharmacies`, { headers });
        const data = await res.json();
        setAdminPharmacies(Array.isArray(data) ? data : []);
      } else if (adminActiveTab === 'medicines') {
        const res = await fetch(`${API_URL}/admin/medicines`, { headers });
        const data = await res.json();
        setAdminMedicines(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsAdminTableLoading(false);
    }
  };

  // Admin Module: Delete record trigger
  const handleAdminDelete = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      let endpoint = '';
      if (type === 'user') endpoint = `${API_URL}/admin/user/${id}`;
      if (type === 'pharmacy') endpoint = `${API_URL}/admin/pharmacy/${id}`;
      if (type === 'medicine') endpoint = `${API_URL}/medicine/${id}`;

      const res = await fetch(endpoint, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Delete operation failed');

      showToast(data.msg || 'Item deleted successfully!');
      loadAdminMetrics();
      loadAdminTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Admin Seeding: Seed Pharmacies only (with local coordinate variations)
  const handleSeedPharmacies = async () => {
    setIsSeedingPharmacies(true);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      const offset = () => (Math.random() - 0.5) * 0.04; // Spread within ~2-4km
      const pharmaciesData = [
        {
          pharmacyName: 'LifeCare Pharmacy',
          address: '7-12 Apollo Square Road, Landmark Tower',
          phone: '+91 866-5550102',
          latitude: userCoords.lat + offset(),
          longitude: userCoords.lng + offset()
        },
        {
          pharmacyName: 'Apollo Pharmacy Store',
          address: 'M.G. Road Cross, Opp. Metro Station',
          phone: '+91 866-5550293',
          latitude: userCoords.lat + offset(),
          longitude: userCoords.lng + offset()
        },
        {
          pharmacyName: 'MedPlus Drug & General Store',
          address: 'Subbarao Colony Main Street',
          phone: '+91 866-5550481',
          latitude: userCoords.lat + offset(),
          longitude: userCoords.lng + offset()
        },
        {
          pharmacyName: 'Wellness Forever 24x7',
          address: 'Station Road, beside Railway Station Plaza',
          phone: '+91 866-5559902',
          latitude: userCoords.lat + offset(),
          longitude: userCoords.lng + offset()
        }
      ];

      const seeded = [];
      for (const p of pharmaciesData) {
        const res = await fetch(`${API_URL}/pharmacy`, {
          method: 'POST',
          headers,
          body: JSON.stringify(p)
        });
        const data = await res.json();
        if (res.ok && data.pharmacy) seeded.push(data.pharmacy);
      }

      if (seeded.length === 0) {
        throw new Error('Failed to seed pharmacies or pharmacies already present.');
      }

      showToast(`Successfully seeded ${seeded.length} pharmacies!`);
      loadAdminMetrics();
      loadAdminTabData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSeedingPharmacies(false);
    }
  };

  // Admin Seeding: Seed Medicines only
  const handleSeedMedicines = async () => {
    setIsSeedingMedicines(true);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      const resPharm = await fetch(`${API_URL}/admin/pharmacies`, { headers });
      const pharmacies = await resPharm.json();

      if (!Array.isArray(pharmacies) || pharmacies.length === 0) {
        throw new Error('No pharmacies found. Please seed pharmacies first before seeding medicines!');
      }

      const medicineDefinitions = [
        { name: 'Paracetamol 650mg', mfg: 'Dolo Industries', price: 30, qOffset: 8 },
        { name: 'Amoxicillin 500mg', mfg: 'Abbott Pharma', price: 120, qOffset: 0 },
        { name: 'Metformin 500mg', mfg: 'Glycomet Labs', price: 45, qOffset: 12 },
        { name: 'Ibuprofen 400mg', mfg: 'Combiflam Ltd', price: 20, qOffset: 30 },
        { name: 'Atorvastatin 10mg', mfg: 'Pfizer India', price: 180, qOffset: 6 },
        { name: 'Omeprazole 20mg', mfg: "Dr. Reddy's Labs", price: 60, qOffset: 45 },
        { name: 'Cetirizine 10mg', mfg: 'Cipla Biotech', price: 18, qOffset: 25 },
        { name: 'Azithromycin 500mg', mfg: 'Azee Med', price: 110, qOffset: 14 }
      ];

      let count = 0;
      for (const pharm of pharmacies) {
        for (const med of medicineDefinitions) {
          let qty = 0;
          if (med.qOffset > 0) {
            qty = Math.floor(Math.random() * 40) + med.qOffset;
          }

          const medBody = {
            medicineName: med.name,
            manufacturer: med.mfg,
            price: med.price,
            quantity: qty,
            expiryDate: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000 * (1 + Math.random())
            ).toISOString(),
            pharmacyId: pharm._id
          };

          const res = await fetch(`${API_URL}/medicine`, {
            method: 'POST',
            headers,
            body: JSON.stringify(medBody)
          });
          if (res.ok) count++;
        }
      }

      showToast(`Successfully seeded ${count} medicines linked to your pharmacies!`);
      loadAdminMetrics();
      loadAdminTabData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSeedingMedicines(false);
    }
  };

  // Close dropdown menu when clicking layout elements
  useEffect(() => {
    const clickHandler = (e) => {
      const avatarBtn = document.getElementById('user-avatar-btn');
      if (avatarBtn && !avatarBtn.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, []);

  return (
    <>
      {/* Background overlay video/images theme */}
      <div className="video-container">
        <video autoPlay muted loop playsInline id="bg-video">
          <source
            src="https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c022f733f3d362147b3da1b07c2a7fcf&profile_id=139&oauth2_token_id=57447761"
            type="video/mp4"
          />
          <source src="https://vjs.zencdn.net/v/oceans.mp4" type="video/mp4" />
        </video>
        <div
          className={`dark-overlay ${
            activeView === 'admin-auth' || activeView === 'admin-dashboard'
              ? 'admin-theme'
              : ''
          }`}
          id="bg-overlay"
        ></div>
      </div>

      {/* 3D Floating Shapes background layer */}
      <div className="shapes-container" id="shapes-container">
        <img
          src="/assets/glowing_3d_pill.png"
          className="floating-3d-asset pill-1"
          alt="3D Pill"
          style={{ left: '10%', top: '20%', animationDelay: '0s' }}
        />
        <img
          src="/assets/glowing_3d_pin.png"
          className="floating-3d-asset pin-1"
          alt="3D Location Pin"
          style={{ left: '80%', top: '15%', animationDelay: '2s' }}
        />
        <img
          src="/assets/glowing_3d_pill.png"
          className="floating-3d-asset pill-2"
          alt="3D Pill"
          style={{ left: '70%', top: '75%', animationDelay: '4s' }}
        />
        <img
          src="/assets/glowing_3d_pin.png"
          className="floating-3d-asset pin-2"
          alt="3D Location Pin"
          style={{ left: '15%', top: '80%', animationDelay: '6s' }}
        />
      </div>

      {/* Main Container Wrapper */}
      <main className="app-container">
        {/* ==================== 1. LANDING PAGE ==================== */}
        {activeView === 'landing' && (
          <section id="landing-page" className="view active-view">
            <div className="hero-section">
              <div className="logo-container">
                <img
                  src="/assets/medsynapse_logo.png"
                  className="logo-img"
                  alt="MedSynapse Logo"
                />
              </div>
              <p className="hero-subtitle">Find your medicine. Instantly. Near you.</p>

              <div className="cta-buttons-container">
                <button
                  className="cta-btn user-cta"
                  id="user-auth-btn"
                  onClick={() => {
                    setAuthTab('signin');
                    setActiveView('user-auth');
                  }}
                >
                  <span className="btn-dot green-dot"></span>
                  User Login
                </button>
                <button
                  className="cta-btn admin-cta"
                  id="admin-auth-btn"
                  onClick={() => setActiveView('admin-auth')}
                >
                  <span className="btn-dot blue-dot"></span>
                  Admin Login
                </button>
              </div>

              <p className="signup-prompt">
                New here?{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setAuthTab('signup');
                    setActiveView('user-auth');
                  }}
                >
                  Sign Up
                </a>
              </p>
            </div>

            {/* 3D Card tilt Row */}
            <div className="feature-row">
              <div className="tilt-card-wrapper">
                <div className="tilt-card glass-card" data-tilt>
                  <div className="card-glow"></div>
                  <div className="card-content">
                    <div className="card-icon-wrapper">
                      <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <h3>Search Any Medicine</h3>
                    <p>
                      Find availability and real-time inventory of critical therapeutics in nearby
                      pharmacies.
                    </p>
                  </div>
                </div>
              </div>

              <div className="tilt-card-wrapper">
                <div className="tilt-card glass-card" data-tilt>
                  <div className="card-glow"></div>
                  <div className="card-content">
                    <div className="card-icon-wrapper">
                      <i className="fa-solid fa-location-crosshairs"></i>
                    </div>
                    <h3>Live Location Detection</h3>
                    <p>
                      Locate pharmacies matching your target medicine within walking or driving
                      distance instantly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="tilt-card-wrapper">
                <div className="tilt-card glass-card" data-tilt>
                  <div className="card-glow"></div>
                  <div className="card-content">
                    <div className="card-icon-wrapper">
                      <i className="fa-solid fa-arrows-rotate"></i>
                    </div>
                    <h3>Smart Alternatives</h3>
                    <p>
                      Out of stock? Access generic substitutes and equivalent brand names
                      immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 2. USER AUTH PAGE (Sign In / Sign Up) ==================== */}
        {activeView === 'user-auth' && (
          <section id="user-auth-page" className="view active-view">
            <div className="auth-card-wrapper">
              <div className="auth-shapes">
                <img
                  src="/assets/glowing_3d_pill.png"
                  className="floating-3d-asset torus-1"
                  alt="3D Pill"
                />
                <img
                  src="/assets/glowing_3d_pin.png"
                  className="floating-3d-asset torus-2"
                  alt="3D Location Pin"
                />
              </div>

              <div className="auth-card glass-card">
                <div className="auth-tabs">
                  <button
                    id="tab-signin"
                    className={`auth-tab-btn ${authTab === 'signin' ? 'active' : ''}`}
                    onClick={() => setAuthTab('signin')}
                  >
                    Sign In
                  </button>
                  <button
                    id="tab-signup"
                    className={`auth-tab-btn ${authTab === 'signup' ? 'active' : ''}`}
                    onClick={() => setAuthTab('signup')}
                  >
                    Sign Up
                  </button>
                  <div
                    className="tab-underline"
                    style={{ transform: authTab === 'signup' ? 'translateX(100%)' : 'none' }}
                  ></div>
                </div>

                {/* Sign In Form */}
                {authTab === 'signin' && (
                  <form
                    id="signin-form"
                    className="auth-form active-form"
                    onSubmit={handleUserSignIn}
                  >
                    <div className="input-group">
                      <input
                        type="email"
                        id="signin-email"
                        required
                        placeholder=" "
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                      />
                      <label htmlFor="signin-email">Email Address</label>
                    </div>

                    <div className="input-group">
                      <input
                        type="password"
                        id="signin-password"
                        required
                        placeholder=" "
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                      />
                      <label htmlFor="signin-password">Password</label>
                    </div>

                    <div className="form-links">
                      <a
                        href="#"
                        className="forgot-pass"
                        onClick={(e) => {
                          e.preventDefault();
                          showToast(
                            'Password reset email link sent to your registered address.',
                            'blue'
                          );
                        }}
                      >
                        Forgot Password?
                      </a>
                    </div>

                    <button
                      type="submit"
                      className={`submit-btn green-submit ${isAuthLoading ? 'loading' : ''}`}
                    >
                      <span className="btn-text">Sign In</span>
                      <span className="spinner">
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                      </span>
                    </button>
                  </form>
                )}

                {/* Sign Up Form */}
                {authTab === 'signup' && (
                  <form
                    id="signup-form"
                    className="auth-form active-form"
                    onSubmit={handleUserSignUp}
                  >
                    <div className="input-group">
                      <input
                        type="text"
                        id="signup-name"
                        required
                        placeholder=" "
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                      />
                      <label htmlFor="signup-name">Full Name</label>
                    </div>

                    <div className="input-group">
                      <input
                        type="email"
                        id="signup-email"
                        required
                        placeholder=" "
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                      />
                      <label htmlFor="signup-email">Email Address</label>
                    </div>

                    <div className="input-group">
                      <input
                        type="password"
                        id="signup-password"
                        required
                        placeholder=" "
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                      />
                      <label htmlFor="signup-password">Password</label>
                    </div>

                    <div className="input-group">
                      <input
                        type="password"
                        id="signup-confirm"
                        required
                        placeholder=" "
                        value={signUpConfirm}
                        onChange={(e) => setSignUpConfirm(e.target.value)}
                      />
                      <label htmlFor="signup-confirm">Confirm Password</label>
                    </div>

                    <button
                      type="submit"
                      className={`submit-btn green-submit ${isAuthLoading ? 'loading' : ''}`}
                    >
                      <span className="btn-text">Create Account</span>
                      <span className="spinner">
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                      </span>
                    </button>
                  </form>
                )}

                <p className="auth-footer-link">
                  Back to{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveView('landing');
                    }}
                  >
                    Home Page
                  </a>
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 3. ADMIN AUTH PAGE ==================== */}
        {activeView === 'admin-auth' && (
          <section id="admin-auth-page" className="view active-view">
            <div className="auth-card-wrapper">
              <div className="admin-shapes">
                <img
                  src="/assets/glowing_3d_shield.png"
                  className="floating-3d-asset admin-shield-1"
                  alt="3D Shield"
                />
                <img
                  src="/assets/glowing_3d_pin.png"
                  className="floating-3d-asset admin-pin-1"
                  alt="3D Pin"
                />
              </div>

              <div className="auth-card glass-card admin-card">
                <div className="admin-header">
                  <i className="fa-solid fa-shield-halved admin-logo-icon"></i>
                  <h2>Admin Portal</h2>
                  <p>Secure administrative access</p>
                </div>

                <form
                  id="admin-signin-form"
                  className="auth-form active-form"
                  onSubmit={handleAdminSignIn}
                >
                  <div className="input-group">
                    <input
                      type="email"
                      id="admin-email"
                      required
                      placeholder=" "
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                    <label htmlFor="admin-email">Admin Email</label>
                  </div>

                  <div className="input-group">
                    <input
                      type="password"
                      id="admin-password"
                      required
                      placeholder=" "
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                    <label htmlFor="admin-password">Password</label>
                  </div>

                  <div className="input-group-row">
                    <div className="input-group" style={{ flexGrow: 1 }}>
                      <input
                        type="text"
                        id="admin-otp"
                        required
                        placeholder=" "
                        maxLength="6"
                        value={adminOtp}
                        onChange={(e) => setAdminOtp(e.target.value)}
                      />
                      <label htmlFor="admin-otp">2FA Security Code / OTP</label>
                    </div>
                    <button
                      type="button"
                      className="send-otp-btn"
                      id="admin-send-otp-btn"
                      disabled={otpCooldown > 0 || isOtpSending}
                      onClick={handleRequestAdminOtp}
                    >
                      {isOtpSending ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : otpCooldown > 0 ? (
                        `Resend (${otpCooldown}s)`
                      ) : (
                        'Get OTP'
                      )}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className={`submit-btn blue-submit ${isAuthLoading ? 'loading' : ''}`}
                  >
                    <span className="btn-text">Verify & Sign In</span>
                    <span className="spinner">
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                    </span>
                  </button>
                </form>

                <p className="auth-footer-link">
                  Back to{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveView('landing');
                    }}
                  >
                    Home Page
                  </a>
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 4. USER DASHBOARD ==================== */}
        {activeView === 'user-dashboard' && (
          <section id="user-dashboard" className="view active-view">
            <nav className="navbar glass-panel">
              <div className="nav-logo" onClick={() => setActiveView('user-dashboard')}>
                <img
                  src="/assets/medsynapse_logo.png"
                  className="logo-img-nav"
                  alt="MedSynapse Logo"
                />
              </div>
              <div className="nav-location">
                <i className="fa-solid fa-location-dot location-icon"></i>
                <span id="nav-city-text">{cityName}</span>
              </div>
              <div className="nav-user">
                <span id="nav-username">{user ? user.username : 'User'}</span>
                <div
                  className="user-avatar"
                  id="user-avatar-btn"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <i className="fa-solid fa-user-doctor"></i>
                  <div className={`avatar-dropdown ${isUserMenuOpen ? 'active' : ''}`}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLogout();
                      }}
                    >
                      <i className="fa-solid fa-right-from-bracket"></i> Sign Out
                    </a>
                  </div>
                </div>
              </div>
            </nav>

            <div className="dashboard-body">
              <div className="search-banner">
                <h2>Find Medicine Near You Instantly</h2>

                <form
                  className="search-bar-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    executeSearch(searchQuery);
                  }}
                >
                  <div className="search-input-wrapper">
                    <i className="fa-solid fa-magnifying-glass search-inner-icon"></i>
                    <input
                      type="text"
                      id="dashboard-search-input"
                      placeholder={searchPlaceholder}
                      required
                      autoComplete="off"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="search-action-btn">
                      <span>Find Now</span>
                    </button>
                  </div>
                </form>

                <div className="search-location-indicator">
                  <span id="gps-status">
                    {gpsStatus.includes('Detecting') ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fa-solid fa-location-dot"></i>
                    )}{' '}
                    {gpsStatus}
                  </span>
                </div>
              </div>

              {/* 6-card dashboard grid */}
              <div className="dashboard-grid">
                <div className="tilt-card-wrapper">
                  <div
                    className="tilt-card dashboard-feature-card"
                    data-tilt
                    onClick={() => document.getElementById('dashboard-search-input')?.focus()}
                  >
                    <div className="card-glow"></div>
                    <div className="card-content">
                      <div className="feature-icon bg-green">
                        <i className="fa-solid fa-magnifying-glass"></i>
                      </div>
                      <h4>Search Medicine</h4>
                      <p>Find any medicine by its brand name or molecule in real-time.</p>
                    </div>
                  </div>
                </div>

                <div className="tilt-card-wrapper">
                  <div
                    className="tilt-card dashboard-feature-card"
                    data-tilt
                    onClick={triggerNearbySearch}
                  >
                    <div className="card-glow"></div>
                    <div className="card-content">
                      <div className="feature-icon bg-green">
                        <i className="fa-solid fa-location-dot"></i>
                      </div>
                      <h4>Nearby Stores</h4>
                      <p>Find pharmacies operating within a 5 km radius of your location.</p>
                    </div>
                  </div>
                </div>

                <div className="tilt-card-wrapper">
                  <div
                    className="tilt-card dashboard-feature-card"
                    data-tilt
                    onClick={() =>
                      showToast(
                        'Generic Substitutes feature is available. Try searching for a medicine to see live stock updates!',
                        'blue'
                      )
                    }
                  >
                    <div className="card-glow"></div>
                    <div className="card-content">
                      <div className="feature-icon bg-green">
                        <i className="fa-solid fa-arrows-rotate"></i>
                      </div>
                      <h4>Alternatives</h4>
                      <p>Lookup generic equivalents and chemical compounds if out of stock.</p>
                    </div>
                  </div>
                </div>

                <div className="tilt-card-wrapper">
                  <div
                    className="tilt-card dashboard-feature-card"
                    data-tilt
                    onClick={() =>
                      showToast(
                        'Real-time Quantity Checking feature is available. Try searching for a medicine to see live stock updates!',
                        'blue'
                      )
                    }
                  >
                    <div className="card-glow"></div>
                    <div className="card-content">
                      <div className="feature-icon bg-green">
                        <i className="fa-solid fa-box-archive"></i>
                      </div>
                      <h4>Stock Status</h4>
                      <p>Check the exact units available inside every registered local pharmacy.</p>
                    </div>
                  </div>
                </div>

                <div className="tilt-card-wrapper">
                  <div
                    className="tilt-card dashboard-feature-card"
                    data-tilt
                    onClick={() =>
                      showToast(
                        'Manufacturer Filtering feature is available. Try searching for a medicine to see live stock updates!',
                        'blue'
                      )
                    }
                  >
                    <div className="card-glow"></div>
                    <div className="card-content">
                      <div className="feature-icon bg-green">
                        <i className="fa-solid fa-prescription-bottle-medical"></i>
                      </div>
                      <h4>By Company</h4>
                      <p>Filter availability details by specific manufacturing pharmaceutical labs.</p>
                    </div>
                  </div>
                </div>

                <div className="tilt-card-wrapper">
                  <div
                    className="tilt-card dashboard-feature-card"
                    data-tilt
                    onClick={() =>
                      showToast(
                        'Restocking Alerts feature is available. Try searching for a medicine to see live stock updates!',
                        'blue'
                      )
                    }
                  >
                    <div className="card-glow"></div>
                    <div className="card-content">
                      <div className="feature-icon bg-green">
                        <i className="fa-solid fa-bell"></i>
                      </div>
                      <h4>Stock Alerts</h4>
                      <p>Get email notifications when highly sought-after drugs are restocked.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 5. MEDICINE SEARCH & RESULTS PAGE ==================== */}
        {activeView === 'search-results' && (
          <section id="search-results-page" className="view active-view">
            <nav className="navbar glass-panel">
              <div className="nav-logo" onClick={() => setActiveView('user-dashboard')}>
                <img
                  src="/assets/medsynapse_logo.png"
                  className="logo-img-nav"
                  alt="MedSynapse Logo"
                />
              </div>
              <div className="nav-search-mini">
                <form
                  className="mini-search-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    executeSearch(miniSearchQuery);
                  }}
                >
                  <input
                    type="text"
                    id="mini-search-input"
                    placeholder="Search medicine..."
                    required
                    autoComplete="off"
                    value={miniSearchQuery}
                    onChange={(e) => setMiniSearchQuery(e.target.value)}
                  />
                  <button type="submit">
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </button>
                </form>
              </div>
              <div className="nav-user">
                <span id="results-username">{user ? user.username : 'User'}</span>
                <div
                  className="user-avatar"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  id="user-avatar-btn"
                >
                  <i className="fa-solid fa-user-doctor"></i>
                  <div className={`avatar-dropdown ${isUserMenuOpen ? 'active' : ''}`}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLogout();
                      }}
                    >
                      <i className="fa-solid fa-right-from-bracket"></i> Sign Out
                    </a>
                  </div>
                </div>
              </div>
            </nav>

            <div className="results-body">
              <div className="results-header-info">
                <h2 id="search-query-title">{searchTitle}</h2>
                <p id="search-meta-location">
                  {isSearching ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> {searchMetaLocation}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-location-crosshairs"></i> {searchMetaLocation}
                    </>
                  )}
                </p>
              </div>

              {/* Interactive map Container */}
              <div className="map-strip-container">
                <div id="results-map"></div>
              </div>

              <div className="results-container">
                {/* Loader State */}
                {isSearching ? (
                  <div className="results-list" id="results-list">
                    <div className="shimmer-card">
                      <div className="shimmer-line line-1"></div>
                      <div className="shimmer-line line-2"></div>
                      <div className="shimmer-line line-3"></div>
                    </div>
                    <div className="shimmer-card">
                      <div className="shimmer-line line-1"></div>
                      <div className="shimmer-line line-2"></div>
                      <div className="shimmer-line line-3"></div>
                    </div>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="results-list" id="results-list">
                    {searchResults.map((item, index) => {
                      const pharm = item.pharmacyId || {
                        pharmacyName: 'Unknown Store',
                        address: 'N/A',
                        phone: 'N/A',
                        latitude: 0,
                        longitude: 0
                      };
                      const distanceText =
                        item.distance !== undefined && item.distance < 999
                          ? `${item.distance} km`
                          : 'N/A';

                      let stockClass = 'stock-out';
                      let stockLabel = 'Out of Stock';
                      let qtyText = '0 strips';

                      if (item.quantity > 15) {
                        stockClass = 'stock-in';
                        stockLabel = 'In Stock';
                        qtyText = `${item.quantity} strips`;
                      } else if (item.quantity > 0) {
                        stockClass = 'stock-low';
                        stockLabel = 'Low Stock';
                        qtyText = `${item.quantity} strips left`;
                      }

                      const expDate = new Date(item.expiryDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short'
                      });

                      const isExpanded = expandedCardId === item._id;

                      return (
                        <div
                          key={item._id}
                          className={`result-card card-entrance ${isExpanded ? 'expanded' : ''}`}
                          style={{ animationDelay: `${index * 0.1}s` }}
                          onClick={() => {
                            setExpandedCardId(isExpanded ? null : item._id);
                          }}
                        >
                          <div className="card-primary-row">
                            <span className="store-name">{pharm.pharmacyName}</span>
                            <span className="distance-badge">{distanceText}</span>
                          </div>
                          <div className="card-medicine-row">
                            <div>
                              <span className="med-name">{item.medicineName}</span>
                              <span className="med-manufacturer">by {item.manufacturer}</span>
                            </div>
                            <span className="med-price">
                              ₹{item.price}{' '}
                              <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>
                                / strip
                              </span>
                            </span>
                          </div>
                          <div className="stock-status-wrapper">
                            <div className="stock-labels">
                              <span>
                                Status:{' '}
                                <strong
                                  style={{
                                    color:
                                      item.quantity > 15
                                        ? 'var(--primary)'
                                        : item.quantity > 0
                                        ? '#FFE082'
                                        : '#FF3B30'
                                  }}
                                >
                                  {stockLabel}
                                </strong>
                              </span>
                              <span>{qtyText}</span>
                            </div>
                            <div className="stock-track">
                              <div className={`stock-bar ${stockClass}`}></div>
                            </div>
                          </div>

                          {/* Expandable detail section */}
                          <div className="card-details-expandable">
                            <div className="details-grid">
                              <div className="detail-item">
                                <span className="detail-label">Address</span>
                                <span className="detail-val">{pharm.address}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Phone Contact</span>
                                <span className="detail-val">{pharm.phone}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Expiry Date</span>
                                <span className="detail-val">{expDate}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Manufacturer Batch</span>
                                <span className="detail-val">
                                  BATCH-{item._id.substring(item._id.length - 6).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <button
                              className="get-directions-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `https://www.google.com/maps/dir/?api=1&destination=${pharm.latitude},${pharm.longitude}`,
                                  '_blank'
                                );
                              }}
                            >
                              <i className="fa-solid fa-diamond-turn-right"></i>
                              Get Directions
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty state */
                  <div className="no-results-card glass-card" id="no-results-card">
                    <i className="fa-solid fa-triangle-exclamation warning-icon"></i>
                    <h3>This medicine isn't available nearby</h3>
                    <p>
                      We couldn't find exact stock matching your query. Explore available generic
                      substitutes below:
                    </p>

                    <div className="alternatives-carousel-wrapper">
                      <button
                        className="carousel-nav-btn prev"
                        onClick={() => handleScrollCarousel(-1)}
                      >
                        <i className="fa-solid fa-chevron-left"></i>
                      </button>
                      <div
                        className="alternatives-carousel"
                        id="alternatives-carousel"
                        ref={carouselRef}
                      >
                        {loadingAlternatives ? (
                          <span style={{ color: 'var(--text-secondary)', width: '100%', textAlign: 'center' }}>
                            Finding alternatives...
                          </span>
                        ) : alternatives.length > 0 ? (
                          alternatives.map((item) => (
                            <div
                              key={item._id}
                              className="alt-card"
                              onClick={() => {
                                setMiniSearchQuery(item.medicineName);
                                executeSearch(item.medicineName);
                              }}
                            >
                              <h5>{item.medicineName}</h5>
                              <span className="alt-mfg">{item.manufacturer}</span>
                              <span className="alt-price">₹{item.price}</span>
                              <span className="alt-qty-badge">{item.quantity} units</span>
                            </div>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', width: '100%', textAlign: 'center' }}>
                            No direct substitute matches available.
                          </span>
                        )}
                      </div>
                      <button
                        className="carousel-nav-btn next"
                        onClick={() => handleScrollCarousel(1)}
                      >
                        <i className="fa-solid fa-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ==================== 6. ADMIN DASHBOARD ==================== */}
        {activeView === 'admin-dashboard' && (
          <section id="admin-dashboard" className="view active-view">
            <nav className="navbar glass-panel admin-nav">
              <div className="nav-logo" onClick={() => setActiveView('admin-dashboard')}>
                <img
                  src="/assets/medsynapse_logo.png"
                  className="logo-img-nav"
                  alt="MedSynapse Logo"
                />
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--accent-blue)',
                    background: 'rgba(0, 136, 255, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginLeft: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Admin
                </span>
              </div>
              <div className="nav-admin-actions">
                <button
                  className="action-btn seed-btn"
                  id="seed-pharmacies-btn"
                  disabled={isSeedingPharmacies}
                  onClick={handleSeedPharmacies}
                >
                  {isSeedingPharmacies ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Seeding...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-prescription-bottle-medical"></i> Seed Pharmacies
                    </>
                  )}
                </button>
                <button
                  className="action-btn seed-btn"
                  id="seed-medicines-btn"
                  disabled={isSeedingMedicines}
                  onClick={handleSeedMedicines}
                >
                  {isSeedingMedicines ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Seeding...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-pills"></i> Seed Medicines
                    </>
                  )}
                </button>
                <button className="action-btn logout-btn" onClick={() => handleLogout()}>
                  <i className="fa-solid fa-right-from-bracket"></i> Logout
                </button>
              </div>
            </nav>

            <div className="admin-body">
              <div className="admin-welcome">
                <h2>System Control Panel</h2>
                <p>Manage users, pharmacies, inventory levels, and geographic coordinates.</p>
              </div>

              {/* Metrics cards row */}
              <div className="admin-metrics">
                <div className="metric-card glass-card">
                  <h3>Registered Users</h3>
                  <span className="metric-val" id="metric-users">
                    {adminMetrics.users}
                  </span>
                </div>
                <div className="metric-card glass-card">
                  <h3>Registered Pharmacies</h3>
                  <span className="metric-val" id="metric-pharmacies">
                    {adminMetrics.pharmacies}
                  </span>
                </div>
                <div className="metric-card glass-card">
                  <h3>Medicine Records</h3>
                  <span className="metric-val" id="metric-medicines">
                    {adminMetrics.medicines}
                  </span>
                </div>
              </div>

              {/* Tabbed controllers list */}
              <div className="admin-control-tabs">
                <div className="admin-tab-headers">
                  <button
                    className={`admin-tab-h ${adminActiveTab === 'users' ? 'active' : ''}`}
                    onClick={() => setAdminActiveTab('users')}
                  >
                    <i className="fa-solid fa-users"></i> Users
                  </button>
                  <button
                    className={`admin-tab-h ${adminActiveTab === 'pharmacies' ? 'active' : ''}`}
                    onClick={() => setAdminActiveTab('pharmacies')}
                  >
                    <i className="fa-solid fa-prescription-bottle-medical"></i> Pharmacies
                  </button>
                  <button
                    className={`admin-tab-h ${adminActiveTab === 'medicines' ? 'active' : ''}`}
                    onClick={() => setAdminActiveTab('medicines')}
                  >
                    <i className="fa-solid fa-pills"></i> Medicines
                  </button>
                </div>

                <div className="admin-tab-content glass-card">
                  <div id="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr id="admin-table-head">
                          {adminActiveTab === 'users' && (
                            <>
                              <th>Username</th>
                              <th>Email Address</th>
                              <th>System Role</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </>
                          )}
                          {adminActiveTab === 'pharmacies' && (
                            <>
                              <th>Pharmacy Name</th>
                              <th>Address</th>
                              <th>Phone</th>
                              <th>Coordinates</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </>
                          )}
                          {adminActiveTab === 'medicines' && (
                            <>
                              <th>Medicine Name</th>
                              <th>Manufacturer</th>
                              <th>Unit Price</th>
                              <th>Quantity Stock</th>
                              <th>Pharmacy Assignment</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody id="admin-table-body">
                        {isAdminTableLoading ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                              <i className="fa-solid fa-spinner fa-spin"></i> Loading...
                            </td>
                          </tr>
                        ) : adminActiveTab === 'users' ? (
                          adminUsers.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                                No registered users found.
                              </td>
                            </tr>
                          ) : (
                            adminUsers.map((u) => (
                              <tr key={u._id}>
                                <td>{u.username}</td>
                                <td>{u.email}</td>
                                <td>
                                  <span
                                    style={{
                                      background: 'rgba(255,255,255,0.06)',
                                      padding: '4px 8px',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    {u.role}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="delete-row-btn"
                                    onClick={() => handleAdminDelete('user', u._id)}
                                    disabled={u.role === 'admin'}
                                    style={
                                      u.role === 'admin'
                                        ? { opacity: 0.4, cursor: 'not-allowed' }
                                        : {}
                                    }
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )
                        ) : adminActiveTab === 'pharmacies' ? (
                          adminPharmacies.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                                No pharmacies recorded. Click 'Seed Pharmacies'.
                              </td>
                            </tr>
                          ) : (
                            adminPharmacies.map((p) => (
                              <tr key={p._id}>
                                <td>
                                  <strong>{p.pharmacyName}</strong>
                                </td>
                                <td>{p.address}</td>
                                <td>{p.phone}</td>
                                <td>
                                  <code>
                                    {p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}
                                  </code>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="delete-row-btn"
                                    onClick={() => handleAdminDelete('pharmacy', p._id)}
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )
                        ) : adminActiveTab === 'medicines' ? (
                          adminMedicines.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                                No medicines found. Click 'Seed Medicines'.
                              </td>
                            </tr>
                          ) : (
                            adminMedicines.map((m) => (
                              <tr key={m._id}>
                                <td>
                                  <strong>{m.medicineName}</strong>
                                </td>
                                <td>{m.manufacturer}</td>
                                <td>₹{m.price}</td>
                                <td>{m.quantity} strips</td>
                                <td>{m.pharmacyId ? m.pharmacyId.pharmacyName : 'N/A'}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="delete-row-btn"
                                    onClick={() => handleAdminDelete('medicine', m._id)}
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Toast Notification Container Overlay */}
      <div id="toast-container" className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.isOut ? 'toast-out' : ''} ${
              toast.type === 'error'
                ? 'toast-error'
                : toast.type === 'blue'
                ? 'toast-blue'
                : ''
            }`}
          >
            {toast.type === 'error' ? (
              <i className="fa-solid fa-circle-xmark"></i>
            ) : toast.type === 'blue' ? (
              <i className="fa-solid fa-circle-info"></i>
            ) : (
              <i className="fa-solid fa-circle-check"></i>
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default App;