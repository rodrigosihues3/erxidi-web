import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Check,
  ShoppingBag,
  Store,
  CreditCard,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  Clock,
  Phone,
  Loader2,
  Zap,
  Calendar,
  AlertCircle,
  Search,
  QrCode,
  Banknote,
  MapPin,
  Plus,
  Star,
  Home,
  Building,
  Navigation,
  ExternalLink,
  Copy,
  Landmark,
  UserCheck,
  Trash2,
  ShieldCheck,
  Timer,
  Info,
  Wallet,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Input from "../../components/ui/Input";
import LocationPickerMap from "../../components/ui/LocationPickerMap";
import { fetchDni, fetchRuc } from "../../services/api/decolectaService";
import {
  createOrder,
  reserveStock,
  releaseStock,
  verifyPreflight,
} from "../../services/api/checkoutService";
import { supabase } from "../../services/supabase";
import {
  initCulqi,
  openCulqi,
  closeCulqi,
  processCulqiCharge,
} from "./services/culqiService";
import {
  defaultDeliveryZones,
  defaultDeliverySlots,
  pickupStoreInfo,
} from "./data/mockDeliveryZones";
import {
  getAllStoreSettings,
  getStoreDeliverySettings,
} from "../admin/services/adminSettings.service";
import {
  isPointInPolygon,
  calculateDistanceKm,
} from "../../utils/geoUtils";
import { calculateDeliveryFee } from "./services/shippingCalculator";
import { triggerOrderConfirmationEmail } from "../../services/api/orderEmailService";

const REQUIRED_MARK = (
  <span
    className="text-rose-500 font-bold ml-1 cursor-help select-none"
    title="Campo obligatorio"
  >
    *
  </span>
);

const OPTIONAL_MARK = (
  <span className="text-xs text-muted-foreground font-normal ml-1.5">
    (Opcional)
  </span>
);

const INPUT_ERROR_CLASS = "border-rose-500 focus:ring-rose-200";

export default function CheckoutView() {
  const navigate = useNavigate();
  const { items, totalUnits, subtotal, clearCart, openCartDrawer } = useCart();
  const { user, profile } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState({ 1: false, 2: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingPreflight, setIsValidatingPreflight] = useState(false);
  const [preflightError, setPreflightError] = useState("");
  const [stockWarning, setStockWarning] = useState(null);
  const [copiedAccount, setCopiedAccount] = useState("");
  const createdOrderRef = useRef(null);

  // Reserva de Stock con TTL (10 minutos)
  const [reservationToken, setReservationToken] = useState(null);
  const [reservationTimeLeft, setReservationTimeLeft] = useState(600);

  // Cuentas y ajustes dinámicos desde Base de Datos
  const [dynamicSettings, setDynamicSettings] = useState({
    identity: {},
    paymentMethods: { bank_accounts: [], digital_wallets: {} },
    emergencyFlags: {},
    businessHours: {},
  });

  const [paymentMethod, setPaymentMethod] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState("yape"); // 'yape' | 'plin' | 'transferencia'

  useEffect(() => {
    setStockWarning(null);
  }, [items]);

  useEffect(() => {
    let isMounted = true;
    getAllStoreSettings()
      .then((res) => {
        if (isMounted) setDynamicSettings(res);
      })
      .catch((err) => console.error("Error al cargar ajustes maestros:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  const isYapeEnabled = dynamicSettings.paymentMethods?.yape_enabled ?? true;
  const isPlinEnabled = dynamicSettings.paymentMethods?.plin_enabled ?? false;
  const hasDigitalWallets = isYapeEnabled || isPlinEnabled || ((dynamicSettings.paymentMethods?.bank_accounts?.length || 0) > 0);

  useEffect(() => {
    if (!dynamicSettings?.paymentMethods) return;
    const yapeOn = dynamicSettings.paymentMethods.yape_enabled ?? true;
    const plinOn = dynamicSettings.paymentMethods.plin_enabled ?? false;

    if (!yapeOn && !plinOn && paymentMethod === "yape_plin") {
      setPaymentMethod("culqi_gateway");
    }

    if (!yapeOn && plinOn && selectedWallet === "yape") {
      setSelectedWallet("plin");
    } else if (yapeOn && !plinOn && selectedWallet === "plin") {
      setSelectedWallet("yape");
    } else if (!yapeOn && !plinOn && (selectedWallet === "yape" || selectedWallet === "plin")) {
      setSelectedWallet("transferencia");
    }
  }, [dynamicSettings, paymentMethod, selectedWallet]);

  const isStoreClosed = Boolean(
    dynamicSettings.emergencyFlags?.store_closed ||
    dynamicSettings.emergencyFlags?.close_store_today
  );
  const isExpressPaused = Boolean(
    dynamicSettings.emergencyFlags?.pause_express ||
    dynamicSettings.emergencyFlags?.pause_express_only
  );
  const isScheduledPaused = Boolean(
    dynamicSettings.emergencyFlags?.pause_scheduled
  );
  const isPickupPaused = Boolean(
    dynamicSettings.emergencyFlags?.pause_pickup
  );

  const isExpressAvailable = useMemo(() => {
    if (!dynamicSettings) return true; // Fallback optimista durante carga inicial

    // 1. Validar bandera de emergencia maestro o express
    if (isStoreClosed || isExpressPaused) {
      return false;
    }

    if (
      !dynamicSettings.businessHours ||
      Object.keys(dynamicSettings.businessHours).length === 0
    ) {
      return true;
    }

    // 2. Validar día y rango horario según zona horaria de Lima (UTC-5)
    try {
      const nowLima = new Date(
        new Date().toLocaleString("en-US", { timeZone: "America/Lima" })
      );
      const dayOfWeek = nowLima.getDay().toString(); // 0 a 6
      const schedule = dynamicSettings.businessHours?.[dayOfWeek];

      if (!schedule || !schedule.enabled) return false;

      const currentMinutes = nowLima.getHours() * 60 + nowLima.getMinutes();
      const [openH, openM] = (schedule.open || "09:00").split(":").map(Number);
      const [cutoffH, cutoffM] = (schedule.express_cutoff || "17:00")
        .split(":")
        .map(Number);

      const openMinutes = openH * 60 + openM;
      const cutoffMinutes = cutoffH * 60 + cutoffM;

      return currentMinutes >= openMinutes && currentMinutes <= cutoffMinutes;
    } catch {
      return false;
    }
  }, [dynamicSettings, isStoreClosed, isExpressPaused]);

  // Temporizador de vigencia de reserva (Paso 3)
  useEffect(() => {
    if (currentStep !== 3 || !reservationToken) return;

    const timer = setInterval(() => {
      setReservationTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPreflightError(
            "El tiempo de reserva de tus prendas (10 min) ha expirado. Por favor, verifica nuevamente tu carrito."
          );
          setCurrentStep(2);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, reservationToken]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // -------------------------------------------------------------
  // PASO 1: Identificación y Contacto
  // -------------------------------------------------------------
  const [dni, setDni] = useState(
    profile?.dni || profile?.document_number || ""
  );
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");

  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [dniFeedback, setDniFeedback] = useState(null);

  useEffect(() => {
    if (user && profile) {
      if (profile.first_name) setFirstName(profile.first_name);
      const fullLastName =
        profile.last_name ||
        [profile.paternal_surname, profile.maternal_surname]
          .filter(Boolean)
          .join(" ");
      if (fullLastName) setLastName(fullLastName);
      if (user.email) setEmail(user.email);
      if (profile.phone) setPhone(profile.phone);
      const savedDni = String(
        profile.dni || profile.document_number || ""
      ).replace(/\D/g, "");
      if (savedDni.length === 8) {
        setDni(savedDni);
        if (profile.first_name && fullLastName) {
          setIsNameLocked(true);
        }
      }
    }
  }, [user, profile]);

  const triggerDniLookup = async (dniToSearch = dni) => {
    const clean = String(dniToSearch || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (clean.length !== 8) {
      setDniFeedback({
        type: "error",
        message: "El DNI debe contener exactamente 8 dígitos numéricos.",
      });
      return;
    }

    setIsSearchingDni(true);
    setDniFeedback(null);

    try {
      const res = await fetchDni(clean);
      if (res.success && res.names) {
        setFirstName(res.names);
        setLastName(
          [res.firstLastName || "", res.secondLastName || ""].join(" ").trim()
        );
        setIsNameLocked(true);
        setDniFeedback({
          type: "success",
          message: "Identidad verificada exitosamente en RENIEC.",
        });
      } else {
        setIsNameLocked(false);
        setDniFeedback({
          type: "info",
          message:
            "DNI no encontrado en RENIEC. Puedes ingresar tus nombres manualmente.",
        });
      }
    } catch {
      setIsNameLocked(false);
      setDniFeedback({
        type: "info",
        message:
          "Servicio RENIEC no disponible. Ingresa tus nombres manualmente.",
      });
    } finally {
      setIsSearchingDni(false);
    }
  };

  const handleDniChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "").slice(0, 8);
    setDni(rawVal);
    setDniFeedback(null);
    if (isNameLocked) {
      setIsNameLocked(false);
      setFirstName("");
      setLastName("");
    }
  };

  const handleClearDni = () => {
    setDni("");
    setDniFeedback(null);
    setIsNameLocked(false);
    setFirstName("");
    setLastName("");
  };

  const isStep1Valid = useMemo(() => {
    const cleanDni = String(dni || "").replace(/\D/g, "");
    const isDniValid = cleanDni.length === 0 || cleanDni.length === 8;
    const isNameValid =
      firstName.trim().length > 1 && lastName.trim().length > 1;
    const cleanEmail = email.trim();
    const isEmailValid =
      cleanEmail.includes("@") &&
      cleanEmail.includes(".") &&
      !cleanEmail.includes(" ");
    const cleanPhone = phone.trim();
    const isPhoneValid = cleanPhone.length === 9 && cleanPhone.startsWith("9");
    return isDniValid && isNameValid && isEmailValid && isPhoneValid;
  }, [dni, firstName, lastName, email, phone]);

  const handleNextFromStep1 = (e) => {
    e.preventDefault();
    if (isStoreClosed) return;
    if (isStep1Valid) {
      setCompletedSteps((prev) => ({ ...prev, 1: true }));
      setCurrentStep(2);
    }
  };

  // -------------------------------------------------------------
  // PASO 2: Método de Entrega, SLA Dinámico y Direcciones
  // -------------------------------------------------------------
  const [deliveryType, setDeliveryType] = useState(
    totalUnits > 30 ? "pickup" : "scheduled"
  );
  const [deliveryZones, setDeliveryZones] = useState(defaultDeliveryZones);
  const [selectedZoneId, setSelectedZoneId] = useState(
    defaultDeliveryZones[0]?.id || 1
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState(
    defaultDeliverySlots[0]
  );

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [selectedAddressMode, setSelectedAddressMode] = useState("saved");
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(false);
  const [newAddressAlias, setNewAddressAlias] = useState("Casa");
  const [deliveryLatitude, setDeliveryLatitude] = useState(null);
  const [deliveryLongitude, setDeliveryLongitude] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [coveragePolygon, setCoveragePolygon] = useState(null);
  const [storeLocationData, setStoreLocationData] = useState(null);
  const [storePricing, setStorePricing] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getStoreDeliverySettings()
      .then((settings) => {
        if (!isMounted) return;
        if (settings.polygon && Array.isArray(settings.polygon)) {
          setCoveragePolygon(settings.polygon);
        }
        if (settings.storeLocation) {
          setStoreLocationData(settings.storeLocation);
        }
        if (settings.pricing) {
          setStorePricing(settings.pricing);
        }
      })
      .catch(() => { });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeCoordinates = useMemo(() => {
    if (selectedAddressMode === "saved" && selectedSavedAddressId) {
      const addr = (savedAddresses || []).find(
        (a) => a.id === selectedSavedAddressId
      );
      if (addr && addr.latitude != null && addr.longitude != null) {
        return [Number(addr.latitude), Number(addr.longitude)];
      }
    }
    if (deliveryLatitude != null && deliveryLongitude != null) {
      return [Number(deliveryLatitude), Number(deliveryLongitude)];
    }
    return null;
  }, [
    selectedAddressMode,
    selectedSavedAddressId,
    savedAddresses,
    deliveryLatitude,
    deliveryLongitude,
  ]);

  const isOutOfCoverage = useMemo(() => {
    if (!activeCoordinates || !coveragePolygon || coveragePolygon.length < 3) {
      return false;
    }
    return !isPointInPolygon(activeCoordinates, coveragePolygon);
  }, [activeCoordinates, coveragePolygon]);

  useEffect(() => {
    async function loadZones() {
      try {
        const { data, error } = await supabase
          .from("delivery_zones")
          .select("*")
          .order("district_name");

        if (!error && data && data.length > 0) {
          setDeliveryZones(data);
        }
      } catch {
        setDeliveryZones(defaultDeliveryZones);
      }
    }
    loadZones();
  }, []);

  useEffect(() => {
    async function loadUserAddresses() {
      if (!user) {
        setSelectedAddressMode("new");
        setSelectedSavedAddressId(null);
        return;
      }

      setIsLoadingAddresses(true);
      try {
        const { data, error } = await supabase
          .from("addresses")
          .select("*, delivery_zones(district_name, delivery_cost)")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setSavedAddresses(data);
          const defaultAddr = data.find((a) => a.is_default) || data[0];
          setSelectedSavedAddressId(defaultAddr.id);
          setSelectedAddressMode("saved");
          setSelectedZoneId(Number(defaultAddr.zone_id));
          setDeliveryAddress(defaultAddr.street_address || "");
          setDeliveryReference(defaultAddr.reference || "");
          setDeliveryLatitude(
            defaultAddr.latitude != null ? Number(defaultAddr.latitude) : null
          );
          setDeliveryLongitude(
            defaultAddr.longitude != null ? Number(defaultAddr.longitude) : null
          );
        } else {
          setSavedAddresses([]);
          setSelectedAddressMode("new");
          setSelectedSavedAddressId(null);
        }
      } catch {
        setSelectedAddressMode("new");
        setSelectedSavedAddressId(null);
      } finally {
        setIsLoadingAddresses(false);
      }
    }

    loadUserAddresses();
  }, [user]);

  const handleSelectSavedAddress = (addr) => {
    setSelectedSavedAddressId(addr.id);
    setSelectedAddressMode("saved");
    setSelectedZoneId(Number(addr.zone_id));
    setDeliveryAddress(addr.street_address || "");
    setDeliveryReference(addr.reference || "");
    setDeliveryLatitude(addr.latitude != null ? Number(addr.latitude) : null);
    setDeliveryLongitude(
      addr.longitude != null ? Number(addr.longitude) : null
    );
  };

  const handleSelectNewAddressMode = () => {
    setSelectedAddressMode("new");
    setSelectedSavedAddressId(null);
    setDeliveryAddress("");
    setDeliveryReference("");
    setDeliveryLatitude(null);
    setDeliveryLongitude(null);
  };

  const selectedZone = useMemo(
    () =>
      deliveryZones.find((z) => Number(z.id) === Number(selectedZoneId)) ||
      deliveryZones[0],
    [deliveryZones, selectedZoneId]
  );

  const deliveryDistanceKm = useMemo(() => {
    if (
      !activeCoordinates ||
      !storeLocationData?.lat ||
      !storeLocationData?.lng
    ) {
      return null;
    }
    return calculateDistanceKm(
      [storeLocationData.lat, storeLocationData.lng],
      activeCoordinates
    );
  }, [activeCoordinates, storeLocationData]);

  // ESQUEMA TARIFARIO ESCALONADO HIPERLOCAL (PROPUESTA 1A)
  const deliveryCost = useMemo(() => {
    if (deliveryType === "pickup") return 0;
    if (deliveryType === "scheduled") return 5.0; // S/ 5.00 plano para programado

    // Express: Tarifa escalonada hiperlocal (<=0.80 km: S/ 3.50), base (<=3.00 km: S/ 7.00), km extra (+S/ 1.00)
    const km = deliveryDistanceKm ?? 2.0;
    const { fee } = calculateDeliveryFee(
      km,
      storePricing || dynamicSettings.deliveryPricing
    );
    return fee;
  }, [deliveryType, deliveryDistanceKm, storePricing, dynamicSettings.deliveryPricing]);

  const totalAmount = subtotal + deliveryCost;

  // SLA DINÁMICO: 15 min alistamiento + Factor de tortuosidad urbano (1.35) a 20 km/h
  const dynamicSla = useMemo(() => {
    const km = deliveryDistanceKm ?? 3.0;
    const roadDistance = km * 1.35;
    const transitMinutes = Math.round((roadDistance / 20) * 60);
    const totalMinutes = 15 + transitMinutes;
    const minRange = Math.max(35, totalMinutes - 10);
    const maxRange = totalMinutes + 15;

    const now = new Date();
    const start = new Date(now.getTime() + minRange * 60000);
    const end = new Date(now.getTime() + maxRange * 60000);

    const formatH = (d) =>
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0");

    return {
      totalEstimated: maxRange,
      label: `Llegada estimada hoy entre las ${formatH(start)} y ${formatH(
        end
      )} hrs (${minRange}-${maxRange} min)`,
      isHighDemand: maxRange > 90,
    };
  }, [deliveryDistanceKm]);

  const handleMapLocationChange = async ({ lat, lng }) => {
    setDeliveryLatitude(lat);
    setDeliveryLongitude(lng);

    try {
      setIsGeocoding(true);
      const url =
        "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
        lat +
        "&lon=" +
        lng +
        "&zoom=18&addressdetails=1";
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.address) {
        const road =
          data.address.road ||
          data.address.pedestrian ||
          data.address.footway ||
          "";
        const houseNumber = data.address.house_number || "";
        const fullStreet = [road, houseNumber].filter(Boolean).join(" ");
        if (fullStreet) {
          setDeliveryAddress(fullStreet);
        }

        const detectedDistrict =
          data.address.suburb ||
          data.address.city_district ||
          data.address.neighbourhood ||
          data.address.town ||
          "";

        if (detectedDistrict && deliveryZones?.length > 0) {
          const matched = deliveryZones.find(
            (z) =>
              detectedDistrict
                .toLowerCase()
                .includes(z.district_name.toLowerCase()) ||
              z.district_name
                .toLowerCase()
                .includes(detectedDistrict.toLowerCase())
          );
          if (matched) {
            setSelectedZoneId(Number(matched.id));
          }
        }
      }
    } catch {
      // Silencioso
    } finally {
      setIsGeocoding(false);
    }
  };

  const searchAddressOnMap = async (queryText) => {
    const clean = (queryText || "").trim();
    if (clean.length < 4) return;
    setIsGeocoding(true);
    try {
      const searchUrl =
        "https://nominatim.openstreetmap.org/search?format=json&q=" +
        encodeURIComponent(clean + ", Lima, Perú") +
        "&limit=1";
      const res = await fetch(searchUrl);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setDeliveryLatitude(lat);
        setDeliveryLongitude(lon);
      }
    } catch {
      // Silencioso
    } finally {
      setIsGeocoding(false);
    }
  };

  // Validación reactiva onBlur (Pasos 1 y 2)
  const [touched, setTouched] = useState({});
  const markTouched = (field) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const fieldErrors = {
    firstName:
      firstName.trim().length < 2
        ? "Ingresa tus nombres (mínimo 2 caracteres)."
        : "",
    lastName:
      lastName.trim().length < 2
        ? "Ingresa tus apellidos (mínimo 2 caracteres)."
        : "",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? ""
      : "Ingresa un correo válido, sin espacios.",
    phone: /^9\d{8}$/.test(phone.trim())
      ? ""
      : "El celular debe tener 9 dígitos y empezar con 9.",
    dni:
      dni.length > 0 && !/^\d{8}$/.test(dni)
        ? "El DNI debe tener exactamente 8 dígitos."
        : "",
    deliveryAddress:
      deliveryType !== "pickup" && deliveryAddress.trim().length < 4
        ? "Ingresa una dirección válida (mínimo 4 caracteres)."
        : "",
    deliveryReference:
      deliveryType !== "pickup" && deliveryReference.trim().length < 3
        ? "Ingresa una referencia válida (mínimo 3 caracteres)."
        : "",
  };

  const errorOf = (field) => (touched[field] ? fieldErrors[field] : "");

  const renderFieldError = (field) => {
    const error = errorOf(field);
    return error ? (
      <p className="text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in duration-150">
        {error}
      </p>
    ) : null;
  };

  const isStep2Valid = useMemo(() => {
    if (isStoreClosed) return false;

    // Regla de capacidad física en moto
    if (totalUnits > 30 && deliveryType !== "pickup") return false;

    if (deliveryType === "pickup") return !isPickupPaused;
    if (deliveryType === "express" && !isExpressAvailable) return false;
    if (deliveryType === "scheduled" && isScheduledPaused) return false;
    if (isOutOfCoverage) return false;
    if (!activeCoordinates) return false;
    if (deliveryAddress.trim().length < 4) return false;
    if (deliveryReference.trim().length < 3) return false;

    return true;
  }, [
    isStoreClosed,
    totalUnits,
    deliveryType,
    isPickupPaused,
    isExpressAvailable,
    isScheduledPaused,
    isOutOfCoverage,
    activeCoordinates,
    deliveryAddress,
    deliveryReference,
  ]);

  useEffect(() => {
    if (isStoreClosed) return;

    // Si supera 30 prendas, forzar a 'pickup' (recojo en tienda) de forma automática
    if (totalUnits > 30 && deliveryType !== "pickup") {
      setDeliveryType("pickup");
      return;
    }

    if (deliveryType === "express" && !isExpressAvailable) {
      if (!isScheduledPaused) {
        setDeliveryType("scheduled");
      } else if (!isPickupPaused) {
        setDeliveryType("pickup");
      }
    } else if (deliveryType === "scheduled" && isScheduledPaused) {
      if (isExpressAvailable) {
        setDeliveryType("express");
      } else if (!isPickupPaused) {
        setDeliveryType("pickup");
      }
    } else if (deliveryType === "pickup" && isPickupPaused) {
      if (!isScheduledPaused) {
        setDeliveryType("scheduled");
      } else if (isExpressAvailable) {
        setDeliveryType("express");
      }
    }
  }, [
    totalUnits,
    deliveryType,
    isStoreClosed,
    isExpressAvailable,
    isScheduledPaused,
    isPickupPaused,
  ]);

  // TRANSICIÓN AL PASO 3: PRE-FLIGHT CHECK, RESERVA ATÓMICA Y ROLLBACK
  const handleNextFromStep2 = async (e) => {
    if (e) e.preventDefault();
    if (isStoreClosed) {
      setPreflightError(
        "Tienda temporalmente cerrada. No estamos recibiendo pedidos en este momento."
      );
      return;
    }
    if (!isStep2Valid || isValidatingPreflight) return;

    setIsValidatingPreflight(true);
    setPreflightError("");
    setStockWarning(null);

    let activeToken =
      reservationToken && reservationTimeLeft > 0 ? reservationToken : null;

    try {
      // 1. Primero: Validar Pre-vuelo sin reservar inventario
      const initialPreflight = await verifyPreflight({
        reservationToken: null,
        deliveryType,
        totalItems: totalUnits,
      });

      if (!initialPreflight?.success) {
        throw new Error(
          initialPreflight?.message ||
          "No se pudo habilitar el despacho bajo las condiciones seleccionadas."
        );
      }

      // 2. Segundo: Reservar Stock (reutilizar token vigente o generar uno nuevo)
      if (!activeToken) {
        const reserveResult = await reserveStock(items, user?.id || null);
        if (!reserveResult?.success || !reserveResult?.reservation_token) {
          if (
            reserveResult?.error_code === "INSUFFICIENT_STOCK" ||
            reserveResult?.variant_id
          ) {
            const problemItem = items.find(
              (i) => Number(i.variantId) === Number(reserveResult.variant_id)
            );
            const itemName = problemItem?.name || "Prenda seleccionada";
            const variantsText = [problemItem?.size, problemItem?.color]
              .filter(Boolean)
              .join("/");
            const garmentLabel = variantsText
              ? `${itemName} - ${variantsText}`
              : itemName;
            const availableStock = Number(reserveResult?.available_stock) || 0;

            if (availableStock <= 0) {
              setStockWarning(
                `Stock no disponible: La prenda ${garmentLabel} acaba de ser adquirida por completo por otros usuarios. Por favor, modifica tu carrito para continuar.`
              );
            } else {
              const requestedUnits = problemItem?.quantity || "las";
              setStockWarning(
                `Stock insuficiente: La prenda ${garmentLabel} acaba de recibir compras y quedan menos de las ${requestedUnits} unidades que elegiste.`
              );
            }
            return;
          }

          throw new Error(
            reserveResult?.message ||
            "Inventario insuficiente para una o más prendas seleccionadas."
          );
        }

        activeToken = reserveResult.reservation_token;
        setReservationToken(activeToken);
        setReservationTimeLeft(600);
      }

      // 3. Tercero: Re-verificación Pre-vuelo con Token
      const preflightResult = await verifyPreflight({
        reservationToken: activeToken,
        deliveryType,
        totalItems: totalUnits,
      });

      if (!preflightResult?.success) {
        throw new Error(
          preflightResult?.message ||
          "No se pudo habilitar el despacho bajo las condiciones seleccionadas."
        );
      }

      setCompletedSteps((prev) => ({ ...prev, 2: true }));
      setCurrentStep(3);
    } catch (err) {
      if (activeToken) {
        await releaseStock(activeToken);
        setReservationToken(null);
      }
      setPreflightError(
        err.message || "Error al verificar las condiciones del pedido."
      );
    } finally {
      setIsValidatingPreflight(false);
    }
  };

  // -------------------------------------------------------------
  // PASO 3: Pago y Comprobante
  // -------------------------------------------------------------
  // const [paymentMethod, setPaymentMethod] = useState("yape_plin");
  // const [selectedWallet, setSelectedWallet] = useState("yape"); // 'yape' | 'plin'
  const [yapeOpNumber, setYapeOpNumber] = useState("");
  const [culqiError, setCulqiError] = useState(null);

  const [receiptType, setReceiptType] = useState("nota_venta");

  const [useCustomBoleta, setUseCustomBoleta] = useState(false);
  const [boletaDni, setBoletaDni] = useState("");
  const [boletaFullName, setBoletaFullName] = useState("");
  const [isSearchingBoletaDni, setIsSearchingBoletaDni] = useState(false);
  const [isBoletaNameLocked, setIsBoletaNameLocked] = useState(false);
  const [boletaDniFeedback, setBoletaDniFeedback] = useState(null);

  const [ruc, setRuc] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fiscalAddress, setFiscalAddress] = useState("");
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [isRucLocked, setIsRucLocked] = useState(false);
  const [rucFeedback, setRucFeedback] = useState(null);

  const hasValidStep1Dni = useMemo(
    () => String(dni || "").replace(/\D/g, "").length === 8,
    [dni]
  );

  const handleSelectReceiptType = (type) => {
    setReceiptType(type);
    if (type === "boleta" && hasValidStep1Dni && !boletaDni) {
      setUseCustomBoleta(true);
      setBoletaDni(String(dni).replace(/\D/g, ""));
      setBoletaFullName(`${firstName} ${lastName}`.trim());
      setIsBoletaNameLocked(isNameLocked);
    }
  };

  const handleToggleElectronicReceipt = (checked) => {
    if (checked) handleSelectReceiptType("boleta");
    else setReceiptType("nota_venta");
  };

  const triggerBoletaDniLookup = async (dniToQuery = boletaDni) => {
    const clean = String(dniToQuery || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (clean.length !== 8) {
      setBoletaDniFeedback({
        type: "error",
        message: "El DNI debe contener exactamente 8 dígitos numéricos.",
      });
      return;
    }

    setIsSearchingBoletaDni(true);
    setBoletaDniFeedback(null);

    try {
      const res = await fetchDni(clean);
      if (res.success && res.names) {
        const full = [
          res.names,
          res.firstLastName || "",
          res.secondLastName || "",
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        setBoletaFullName(full);
        setIsBoletaNameLocked(true);
        setBoletaDniFeedback({
          type: "success",
          message: "Titular de boleta verificado en RENIEC.",
        });
      } else {
        setIsBoletaNameLocked(false);
        setBoletaDniFeedback({
          type: "info",
          message:
            "DNI no encontrado en RENIEC. Ingresa el nombre del titular manualmente.",
        });
      }
    } catch {
      setIsBoletaNameLocked(false);
      setBoletaDniFeedback({
        type: "info",
        message:
          "Servicio no disponible. Ingresa el nombre del titular manualmente.",
      });
    } finally {
      setIsSearchingBoletaDni(false);
    }
  };

  const handleBoletaDniChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "").slice(0, 8);
    setBoletaDni(rawVal);
    setBoletaDniFeedback(null);
    if (isBoletaNameLocked) {
      setIsBoletaNameLocked(false);
      setBoletaFullName("");
    }
  };

  const isValidRucFormat = (val) => {
    const clean = String(val || "").replace(/\D/g, "");
    return (
      clean.length === 11 &&
      (clean.startsWith("10") || clean.startsWith("20"))
    );
  };

  const triggerRucLookup = async (rucToSearch = ruc) => {
    const clean = String(rucToSearch || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    if (!isValidRucFormat(clean)) {
      setRucFeedback({
        type: "error",
        message: "El RUC debe tener 11 dígitos y empezar con 10 o 20.",
      });
      setIsRucLocked(false);
      return;
    }

    setIsSearchingRuc(true);
    setRucFeedback(null);

    try {
      const res = await fetchRuc(clean);
      if (res.success && res.legalName) {
        setCompanyName(res.legalName);
        setFiscalAddress(res.address || "");
        setIsRucLocked(true);
        setRucFeedback({
          type: "success",
          message: "RUC verificado en SUNAT: " + (res.status || "ACTIVO"),
        });
      } else {
        setCompanyName("");
        setFiscalAddress("");
        setIsRucLocked(false);
        setRucFeedback({
          type: "error",
          message:
            "No se encontraron datos válidos en SUNAT para este RUC.",
        });
      }
    } catch {
      setCompanyName("");
      setFiscalAddress("");
      setIsRucLocked(false);
      setRucFeedback({
        type: "error",
        message:
          "No se pudo conectar con SUNAT en este momento. Intenta nuevamente.",
      });
    } finally {
      setIsSearchingRuc(false);
    }
  };

  const handleRucChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 11);
    setRuc(val);
    setRucFeedback(null);
    setIsRucLocked(false);
    setCompanyName("");
    setFiscalAddress("");
  };

  const handleCopy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopiedAccount(label);
    setTimeout(() => setCopiedAccount(""), 2000);
  };
  const handleCopyAccount = handleCopy;
  const copiedState = copiedAccount;

  const orderContextRef = useRef({});
  orderContextRef.current = {
    user,
    firstName,
    lastName,
    email,
    phone,
    deliveryType,
    deliveryAddress,
    deliveryReference,
    selectedZone,
    deliveryCost,
    scheduledTimeSlot,
    subtotal,
    totalAmount,
    receiptType,
    useCustomBoleta,
    boletaDni,
    boletaFullName,
    ruc,
    companyName,
    fiscalAddress,
    dni,
    items,
    selectedAddressMode,
    selectedSavedAddressId,
    saveAddressForFuture,
    newAddressAlias,
    selectedZoneId,
    savedAddresses,
    deliveryLatitude,
    deliveryLongitude,
    reservationToken,
  };

  const maybeSaveNewAddress = async () => {
    const ctx = orderContextRef.current;
    if (
      ctx.user &&
      ctx.deliveryType !== "pickup" &&
      ctx.selectedAddressMode === "new" &&
      ctx.saveAddressForFuture &&
      ctx.deliveryAddress.trim()
    ) {
      try {
        await supabase.from("addresses").insert([
          {
            user_id: ctx.user.id,
            alias: ctx.newAddressAlias.trim() || "Dirección de compra",
            zone_id: Number(ctx.selectedZoneId),
            street_address: ctx.deliveryAddress.trim(),
            reference: ctx.deliveryReference.trim(),
            receiver_name: [ctx.firstName.trim(), ctx.lastName.trim()]
              .join(" ")
              .trim(),
            receiver_phone: ctx.phone.trim(),
            is_default: (ctx.savedAddresses || []).length === 0,
            latitude: ctx.deliveryLatitude || null,
            longitude: ctx.deliveryLongitude || null,
            updated_at: new Date().toISOString(),
          },
        ]);
      } catch {
        // Silencioso
      }
    }
  };

  const buildOrderPayload = (
    gatewayTxId = null,
    paymentStatus = "pending_verification",
    methodOverride = "culqi_gateway"
  ) => {
    const ctx = orderContextRef.current;
    const normalizedMethod =
      methodOverride === "cash_on_delivery" ? "contraentrega" : methodOverride;
    const fullName = [ctx.firstName.trim(), ctx.lastName.trim()]
      .join(" ")
      .trim();
    const refSegment = ctx.deliveryReference.trim()
      ? " (Ref: " + ctx.deliveryReference.trim() + ")"
      : "";
    const finalAddress =
      ctx.deliveryType === "pickup"
        ? pickupStoreInfo.address
        : ctx.deliveryAddress.trim() +
        refSegment +
        " - " +
        (ctx.selectedZone?.district_name || "Lima");

    const isUsingSavedAddress =
      ctx.deliveryType !== "pickup" &&
      ctx.selectedAddressMode === "saved" &&
      Boolean(ctx.selectedSavedAddressId);

    const shippingAddressId = isUsingSavedAddress
      ? ctx.selectedSavedAddressId
      : null;

    const selectedAddress =
      ctx.deliveryType !== "pickup" && ctx.selectedAddressMode === "saved"
        ? (ctx.savedAddresses || []).find(
          (a) => a.id === ctx.selectedSavedAddressId
        )
        : null;

    const resolvedLat =
      ctx.deliveryType === "pickup"
        ? null
        : selectedAddress?.latitude ?? ctx.deliveryLatitude ?? null;

    const resolvedLng =
      ctx.deliveryType === "pickup"
        ? null
        : selectedAddress?.longitude ?? ctx.deliveryLongitude ?? null;

    const targetInvoiceType =
      ctx.receiptType === "nota_venta" ? "none" : ctx.receiptType;

    const invoicePrefix =
      ctx.receiptType === "factura"
        ? "F001"
        : ctx.receiptType === "boleta"
          ? "B001"
          : "NV01";
    const invoiceDocNumber =
      invoicePrefix + "-" + Date.now().toString().slice(-6);

    const step1CleanDni = String(ctx.dni || "").replace(/\D/g, "");
    const step3CleanBoletaDni = String(ctx.boletaDni || "").replace(/\D/g, "");

    let resolvedTaxId = step1CleanDni.length === 8 ? step1CleanDni : "00000000";
    let resolvedLegalName = fullName;
    let resolvedFiscalAddress = "";

    if (ctx.receiptType === "factura") {
      resolvedTaxId = String(ctx.ruc || "").trim();
      resolvedLegalName = String(ctx.companyName || "").trim();
      resolvedFiscalAddress = String(ctx.fiscalAddress || "").trim();
    } else if (ctx.receiptType === "boleta") {
      const isUsingStep3Boleta =
        ctx.useCustomBoleta || step1CleanDni.length !== 8;
      if (isUsingStep3Boleta) {
        if (step3CleanBoletaDni.length === 8) {
          resolvedTaxId = step3CleanBoletaDni;
        }
        if (String(ctx.boletaFullName || "").trim().length > 1) {
          resolvedLegalName = String(ctx.boletaFullName).trim();
        }
      }
      resolvedFiscalAddress =
        ctx.deliveryType === "pickup"
          ? ""
          : ctx.deliveryAddress.trim()
            ? ctx.deliveryAddress.trim() +
            " - " +
            (ctx.selectedZone?.district_name || "Lima")
            : "";
    }

    const invoiceData = {
      type: ctx.receiptType,
      doc_number: invoiceDocNumber,
      tax_id: resolvedTaxId,
      legal_name: resolvedLegalName,
      fiscal_address: resolvedFiscalAddress,
      issued_at: new Date().toISOString(),
    };

    const resolvedSlot =
      ctx.deliveryType === "scheduled"
        ? ctx.scheduledTimeSlot
        : ctx.deliveryType === "express"
          ? "Express Mismo Día"
          : "Horario Comercial 09:00 - 18:00";

    return {
      userId: ctx.user?.id || null,
      customerName: fullName,
      customerEmail: ctx.email.trim(),
      customerPhone: ctx.phone.trim(),
      deliveryType: ctx.deliveryType,
      delivery_type: ctx.deliveryType,
      shipping_type: ctx.deliveryType, // Homologación para vistas de tracking
      deliveryAddress: finalAddress,
      delivery_latitude: resolvedLat,
      deliveryLatitude: resolvedLat,
      delivery_longitude: resolvedLng,
      deliveryLongitude: resolvedLng,
      shipping_address_id: shippingAddressId,
      shippingAddressId,
      deliveryZoneId:
        ctx.deliveryType === "pickup" ? null : ctx.selectedZone?.id || null,
      deliveryCost: ctx.deliveryCost,
      scheduledTimeSlot: resolvedSlot,
      subtotal: ctx.subtotal,
      totalAmount: ctx.totalAmount,
      payment_method: normalizedMethod,
      paymentMethod: normalizedMethod,
      payment_status: paymentStatus,
      paymentStatus,
      payment_gateway_tx_id: gatewayTxId,
      paymentGatewayTxId: gatewayTxId,
      invoice_type: targetInvoiceType,
      invoice_data: invoiceData,
      items: ctx.items,
      reservationToken: ctx.reservationToken,
    };
  };

  const handleCulqiTokenPayment = async (tokenId) => {
    setIsProcessing(true);
    setCulqiError(null);

    const ctx = orderContextRef.current;
    let orderToCharge = createdOrderRef.current;

    try {
      if (!orderToCharge) {
        await maybeSaveNewAddress();
        const orderPayload = buildOrderPayload(
          null,
          "pending_verification",
          "culqi_gateway"
        );
        const result = await createOrder(orderPayload);
        if (!result.success || !result.order) {
          throw new Error(
            result.error || "No se pudo registrar la orden en el sistema."
          );
        }
        orderToCharge = result.order;
        createdOrderRef.current = result.order;
      }

      const chargeData = await processCulqiCharge({
        tokenId,
        amount: ctx.totalAmount,
        email: ctx.email.trim(),
        orderId: orderToCharge.id,
      });

      const chargeId = chargeData?.id || chargeData?.charge_id || tokenId;

      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_gateway_tx_id: chargeId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderToCharge.id);

      const finalOrderObject = {
        ...orderToCharge,
        payment_status: "paid",
        payment_gateway_tx_id: chargeId,
      };

      triggerOrderConfirmationEmail(finalOrderObject, ctx.items);

      await clearCart();
      navigate("/seguimiento/" + orderToCharge.order_number, {
        state: {
          order: finalOrderObject,
        },
      });
    } catch (err) {
      setCulqiError(
        err.message ||
        "Tu tarjeta fue rechazada o ocurrió un inconveniente con la pasarela."
      );
    } finally {
      setIsProcessing(false);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    window.culqi = async () => {
      try {
        if (window.Culqi?.token) {
          const token = window.Culqi.token;
          closeCulqi();
          await handleCulqiTokenPayment(token.id);
        } else if (window.Culqi?.error) {
          closeCulqi();
          const errorMsg =
            window.Culqi.error.user_message ||
            window.Culqi.error.merchant_message ||
            window.Culqi.error.message ||
            "No se pudo completar el pago con Culqi.";
          setCulqiError(errorMsg);
          setIsProcessing(false);
          setIsSubmitting(false);
        }
      } catch (err) {
        setCulqiError(err.message || "Error inesperado al procesar el pago.");
        setIsProcessing(false);
        setIsSubmitting(false);
      }
    };

    return () => {
      window.culqi = null;
    };
  }, []);

  const isCashOnDeliveryAllowed = Boolean(user && user.email_confirmed_at);

  const isStep3Valid = useMemo(() => {
    if (!paymentMethod) return false;

    if (paymentMethod === "yape_plin") {
      const cleanOp = yapeOpNumber.trim();
      if (selectedWallet === "transferencia") {
        if (cleanOp.length < 4) return false;
      } else {
        const digitsOnly = cleanOp.replace(/\D/g, "");
        if (digitsOnly.length < 6 || digitsOnly.length > 8) return false;
      }
    } else if (paymentMethod === "cash_on_delivery") {
      if (!isCashOnDeliveryAllowed) return false;
    }

    if (receiptType === "factura") {
      if (!isValidRucFormat(ruc)) return false;
      if (!isRucLocked || companyName.trim().length < 2) return false;
    } else if (receiptType === "boleta" && useCustomBoleta) {
      const cleanBoletaDni = boletaDni.replace(/\D/g, "");
      if (cleanBoletaDni.length !== 8) return false;
      if (boletaFullName.trim().length < 3) return false;
    } else if (receiptType === "boleta" && !hasValidStep1Dni) {
      const cleanBoletaDni = boletaDni.replace(/\D/g, "");
      if (cleanBoletaDni.length > 0 && cleanBoletaDni.length !== 8) {
        return false;
      }
      if (cleanBoletaDni.length === 8 && boletaFullName.trim().length < 3) {
        return false;
      }
    }

    return true;
  }, [
    paymentMethod,
    selectedWallet,
    yapeOpNumber,
    isCashOnDeliveryAllowed,
    receiptType,
    ruc,
    isRucLocked,
    companyName,
    useCustomBoleta,
    boletaDni,
    boletaFullName,
    hasValidStep1Dni,
  ]);

  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (isSubmitting || isProcessing || isStoreClosed) return;

    if (receiptType === "factura") {
      if (
        !isValidRucFormat(ruc) ||
        !isRucLocked ||
        companyName.trim().length < 2
      ) {
        setRucFeedback({
          type: "error",
          message:
            "Debes validar un RUC de 11 dígitos con el botón de lupa en SUNAT para emitir Factura.",
        });
        return;
      }
    }

    if (paymentMethod === "culqi_gateway") {
      if (!isStep3Valid) return;
      setCulqiError(null);
      try {
        initCulqi({
          title: "ERXIDI - Ropa Interior y Calcetería",
          amountInCents: Math.round(totalAmount * 100),
        });
        openCulqi();
      } catch (err) {
        setCulqiError(err.message || "No se pudo abrir la pasarela Culqi.");
      }
      return;
    }

    if (!isStep3Valid) return;

    setIsSubmitting(true);
    setCulqiError(null);

    try {
      await maybeSaveNewAddress();

      const isCashOnDelivery = paymentMethod === "cash_on_delivery";
      const targetStatus = isCashOnDelivery
        ? "pending"
        : "pending_verification";
      const targetTxId = isCashOnDelivery ? null : yapeOpNumber.trim();

      const orderPayload = buildOrderPayload(
        targetTxId,
        targetStatus,
        paymentMethod
      );

      if (createdOrderRef.current?.id) {
        const { error: updateOrderError } = await supabase
          .from("orders")
          .update({
            payment_method: orderPayload.payment_method,
            payment_status: targetStatus,
            payment_gateway_tx_id: targetTxId,
            invoice_type: orderPayload.invoice_type,
            invoice_data: orderPayload.invoice_data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdOrderRef.current.id);

        if (updateOrderError) {
          throw new Error(updateOrderError.message);
        }

        const updatedOrderObj = {
          ...createdOrderRef.current,
          payment_method: orderPayload.payment_method,
          payment_status: targetStatus,
          payment_gateway_tx_id: targetTxId,
          invoice_type: orderPayload.invoice_type,
          invoice_data: orderPayload.invoice_data,
        };

        triggerOrderConfirmationEmail(
          updatedOrderObj,
          orderContextRef.current.items
        );

        await clearCart();
        navigate("/seguimiento/" + createdOrderRef.current.order_number, {
          state: { order: updatedOrderObj },
        });
        return;
      }

      const result = await createOrder(orderPayload);

      if (!result.success || !result.order) {
        throw new Error(
          result.error || "No se pudo registrar el pedido. Verifica el stock."
        );
      }

      triggerOrderConfirmationEmail(
        result.order,
        orderContextRef.current.items
      );

      await clearCart();
      navigate("/seguimiento/" + result.order.order_number, {
        state: { order: result.order },
      });
    } catch (err) {
      setCulqiError(
        err.message || "Ocurrió un error al registrar tu pedido."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepClick = (step) => {
    if (step === 1) setCurrentStep(1);
    if (step === 2 && completedSteps[1]) setCurrentStep(2);
    if (step === 3 && completedSteps[1] && completedSteps[2]) setCurrentStep(3);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(amount || 0);

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-brand-muted">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-brand-primary">
            Tu carrito está vacío
          </h2>
          <p className="text-xs text-brand-secondary max-w-sm">
            Para iniciar el proceso de checkout, primero añade prendas a tu
            bolsa de compras.
          </p>
        </div>
        <Link to="/catalogo">
          <Button variant="primary" size="md">
            Explorar Catálogo
          </Button>
        </Link>
      </div>
    );
  }

  const renderAddressInputs = (prefixId) => (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={prefixId + "-address"}
          className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5"
        >
          Dirección Exacta{REQUIRED_MARK}
        </label>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Input
              id={prefixId + "-address"}
              placeholder="Calle / Av. y número (presiona la lupa para ubicar en el mapa)"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              onBlur={() => markTouched("deliveryAddress")}
              className={errorOf("deliveryAddress") ? INPUT_ERROR_CLASS : ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchAddressOnMap(
                    deliveryAddress +
                    ", " +
                    (selectedZone?.district_name || "")
                  );
                }
              }}
              required
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isGeocoding || deliveryAddress.trim().length < 4}
            onClick={() =>
              searchAddressOnMap(
                deliveryAddress + ", " + (selectedZone?.district_name || "")
              )
            }
            className="h-10 px-3.5 shrink-0"
            title="Buscar esta dirección en el mapa"
          >
            {isGeocoding ? (
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
            ) : (
              <Search className="w-4 h-4 text-brand-primary" />
            )}
          </Button>
        </div>
        <span className="text-[11px] text-brand-muted mt-1 block">
          Escribe tu dirección y presiona el botón de lupa para fijar el pin en
          el mapa.
        </span>
        {renderFieldError("deliveryAddress")}
      </div>

      <div>
        <Input
          label={<>Referencia de Llegada{REQUIRED_MARK}</>}
          id={prefixId + "-ref"}
          placeholder="Ej. Dpto 402, portón negro frente al parque, timbre 2"
          value={deliveryReference}
          onChange={(e) => setDeliveryReference(e.target.value)}
          onBlur={() => markTouched("deliveryReference")}
          className={
            errorOf("deliveryReference") ? INPUT_ERROR_CLASS : ""
          }
          required
        />
        {renderFieldError("deliveryReference")}
      </div>
    </div>
  );

  const showCustomBoletaForm =
    receiptType === "boleta" && (useCustomBoleta || !hasValidStep1Dni);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Encabezado y Progreso */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link
              to="/catalogo"
              className="p-1 rounded-button text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors"
              title="Volver al catálogo"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-primary">
              Proceso de Compra
            </h1>
          </div>
          <Badge variant="neutral" className="text-xs font-mono">
            Paso {currentStep} de 3
          </Badge>
        </div>

        <nav aria-label="Progreso de Checkout" className="pt-4">
          <ol className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { step: 1, label: "Identificación" },
              { step: 2, label: "Entrega" },
              { step: 3, label: "Pago" },
            ].map(({ step, label }) => {
              const isCurrent = currentStep === step;
              const isCompleted = completedSteps[step];
              const isClickable =
                step === 1 ||
                (step === 2 && completedSteps[1]) ||
                (step === 3 && completedSteps[1] && completedSteps[2]);

              return (
                <li
                  key={step}
                  onClick={() => handleStepClick(step)}
                  className={
                    "p-3 rounded-card border transition-all select-none flex items-center gap-3 " +
                    (isClickable
                      ? "cursor-pointer "
                      : "cursor-not-allowed opacity-50 ") +
                    (isCurrent
                      ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary"
                      : isCompleted
                        ? "border-emerald-300 bg-emerald-50/40 hover:border-brand-primary"
                        : "border-border bg-surface-subtle")
                  }
                >
                  <div
                    className={
                      "w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors " +
                      (isCompleted
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                          ? "bg-brand-primary text-white"
                          : "bg-surface-subtle text-brand-secondary border border-border")
                    }
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : step}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                      Paso {step}
                    </span>
                    <span className="block text-xs font-bold text-brand-primary truncate">
                      {label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Alerta Fija de Tienda Cerrada (Kill Switch Maestro) */}
          {isStoreClosed && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-card flex items-start gap-3 text-rose-900 shadow-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block text-sm font-bold">
                  Tienda temporalmente cerrada. No estamos recibiendo pedidos en este momento.
                </strong>
                <p className="text-xs text-rose-700 leading-relaxed">
                  Hemos suspendido la recepción de compras en todas las modalidades. Por favor, vuelve a intentar más tarde.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 1: Identificación y Contacto */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-base font-bold text-brand-primary">
                  1. Identificación y Contacto
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Ingresa tus datos de contacto para coordinar el despacho.
                  Puedes consultar tu DNI con la lupa para autocompletar tus
                  nombres.
                </p>
              </div>

              {user && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-card flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Datos precargados desde tu cuenta de cliente ERXIDI.
                    </span>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    Cuenta Vinculada
                  </Badge>
                </div>
              )}

              <form onSubmit={handleNextFromStep1} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="checkout-dni"
                      className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                    >
                      DNI{OPTIONAL_MARK}
                    </label>
                    {isSearchingDni && (
                      <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Consultando RENIEC...
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        id="checkout-dni"
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        placeholder="Ingresa 8 dígitos numéricos"
                        value={dni}
                        onChange={handleDniChange}
                        onBlur={() => markTouched("dni")}
                        className={errorOf("dni") ? INPUT_ERROR_CLASS : ""}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (dni.length === 8) {
                              triggerDniLookup();
                            }
                          }
                        }}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => triggerDniLookup()}
                      disabled={isSearchingDni || dni.length !== 8}
                      className="h-10 px-3.5 shrink-0"
                      title="Consultar DNI en RENIEC"
                    >
                      {isSearchingDni ? (
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      ) : (
                        <Search className="w-4 h-4 text-brand-primary" />
                      )}
                    </Button>

                    {(dni.length > 0 || isNameLocked) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={handleClearDni}
                        disabled={isSearchingDni}
                        className="h-10 px-3.5 shrink-0 text-rose-600 hover:bg-rose-50 border-border"
                        title="Borrar DNI y editar nombres manualmente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {dni.length > 0 && dni.length < 8 && !errorOf("dni") && (
                    <span className="text-[11px] text-amber-600 mt-1 block">
                      Completa los 8 dígitos o presiona el botón de papelera
                      para continuar sin DNI.
                    </span>
                  )}

                  {renderFieldError("dni")}

                  {dniFeedback && (
                    <div
                      className={
                        "mt-1.5 text-xs flex items-center gap-1.5 " +
                        (dniFeedback.type === "success"
                          ? "text-emerald-600 font-medium"
                          : "text-amber-600")
                      }
                    >
                      {dniFeedback.type === "success" ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{dniFeedback.message}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Input
                      label={<>Nombres{REQUIRED_MARK}</>}
                      id="checkout-firstname"
                      placeholder="Tus nombres"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onBlur={() => markTouched("firstName")}
                      disabled={isNameLocked}
                      readOnly={isNameLocked}
                      className={
                        isNameLocked
                          ? "bg-slate-100 text-slate-700 cursor-not-allowed"
                          : errorOf("firstName")
                            ? INPUT_ERROR_CLASS
                            : ""
                      }
                      required
                    />
                    {renderFieldError("firstName")}
                  </div>

                  <div>
                    <Input
                      label={<>Apellidos{REQUIRED_MARK}</>}
                      id="checkout-lastname"
                      placeholder="Tus apellidos"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onBlur={() => markTouched("lastName")}
                      disabled={isNameLocked}
                      readOnly={isNameLocked}
                      className={
                        isNameLocked
                          ? "bg-slate-100 text-slate-700 cursor-not-allowed"
                          : errorOf("lastName")
                            ? INPUT_ERROR_CLASS
                            : ""
                      }
                      required
                    />
                    {renderFieldError("lastName")}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Input
                      label={<>Correo Electrónico{REQUIRED_MARK}</>}
                      id="checkout-email"
                      type="email"
                      placeholder="tucorreo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => markTouched("email")}
                      className={errorOf("email") ? INPUT_ERROR_CLASS : ""}
                      required
                    />
                    {renderFieldError("email")}
                  </div>

                  <div>
                    <Input
                      label={<>WhatsApp / Celular{REQUIRED_MARK}</>}
                      id="checkout-phone"
                      type="tel"
                      placeholder="9XXXXXXXX (9 dígitos)"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                      }
                      onBlur={() => markTouched("phone")}
                      className={errorOf("phone") ? INPUT_ERROR_CLASS : ""}
                      required
                    />
                    {renderFieldError("phone") || (
                      <span className="text-[10px] text-brand-muted mt-1 block">
                        Usado para validar el pago y coordinar la entrega.
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!isStep1Valid || isStoreClosed}
                  >
                    Continuar a Entrega
                    <ChevronRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 2: Método de Entrega y Horarios */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-base font-bold text-brand-primary">
                  2. Método de Entrega y Horarios
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Elige la modalidad de entrega y verifica tu ubicación dentro
                  del polígono delimitado.
                </p>
              </div>

              {stockWarning ? (
                <div className="rounded-card border border-amber-200 bg-amber-50/90 p-4 shadow-subtle animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-2.5 text-xs text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium leading-relaxed">
                        {stockWarning}
                      </p>
                      <div className="pt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openCartDrawer?.()}
                          className="text-xs font-semibold border-amber-300 hover:bg-amber-100 text-amber-900"
                        >
                          Gestionar Carrito
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : preflightError ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-card flex items-start gap-2.5 text-xs text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">
                      Inconveniente para continuar:
                    </strong>
                    <span>{preflightError}</span>
                  </div>
                </div>
              ) : null}

              <div className="space-y-6">
                {totalUnits > 30 && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-card flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">
                        Capacidad de despacho en moto excedida ({totalUnits} prendas)
                      </strong>
                      <span>
                        Por restricciones de volumen y seguridad del motorizado, los pedidos superiores a 30 unidades no pueden enviarse por delivery estándar. Tu pedido ha sido asignado automáticamente a <strong>Recojo en Tienda</strong>.
                      </span>
                    </div>
                  </div>
                )}

                {deliveryType !== "pickup" && isOutOfCoverage && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-card flex items-start gap-2.5 text-xs text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">
                        Zona fuera de cobertura a domicilio
                      </strong>
                      <span>
                        La ubicación fijada en el mapa se encuentra fuera de
                        nuestra área delimitada. Ubica el pin dentro del
                        polígono verde o selecciona{" "}
                        <strong>Recojo en Tienda</strong>.
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label
                    onClick={() => !isPickupPaused && setDeliveryType("pickup")}
                    className={
                      "p-3.5 rounded-card border transition-all flex flex-col justify-between select-none " +
                      (isPickupPaused
                        ? "opacity-50 cursor-not-allowed pointer-events-none border-border bg-surface-card"
                        : deliveryType === "pickup"
                          ? "cursor-pointer border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "cursor-pointer border-border bg-surface-card hover:border-border-strong")
                    }
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      disabled={isPickupPaused}
                      checked={deliveryType === "pickup"}
                      onChange={() => !isPickupPaused && setDeliveryType("pickup")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Store className="w-5 h-5 text-accent" />
                        {isPickupPaused ? (
                          <Badge variant="warning" className="text-[10px]">
                            Pausado temporalmente
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Gratis
                          </Badge>
                        )}
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Recojo en Tienda
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Stand Central ERXIDI
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() =>
                      isExpressAvailable &&
                      !isExpressPaused &&
                      totalUnits <= 30 &&
                      setDeliveryType("express")
                    }
                    className={
                      "p-3.5 rounded-card border transition-all flex flex-col justify-between select-none " +
                      (!isExpressAvailable || isExpressPaused || totalUnits > 30
                        ? "opacity-50 cursor-not-allowed pointer-events-none border-border bg-surface-card"
                        : deliveryType === "express"
                          ? "cursor-pointer border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "cursor-pointer border-border bg-surface-card hover:border-border-strong")
                    }
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      value="express"
                      disabled={!isExpressAvailable || isExpressPaused || totalUnits > 30}
                      checked={deliveryType === "express"}
                      onChange={() =>
                        isExpressAvailable &&
                        !isExpressPaused &&
                        totalUnits <= 30 &&
                        setDeliveryType("express")
                      }
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Zap className="w-5 h-5 text-accent" />
                        {totalUnits > 30 ? (
                          <Badge variant="warning" className="text-[10px]">
                            Excede cap. moto (&gt;30)
                          </Badge>
                        ) : isExpressPaused ? (
                          <Badge variant="warning" className="text-[10px]">
                            Pausado temporalmente
                          </Badge>
                        ) : isExpressAvailable ? (
                          <Badge variant="warning" className="text-[10px]">
                            Mismo Día
                          </Badge>
                        ) : (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                            No disponible hoy
                          </span>
                        )}
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Envío Express
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Prioritario (Tarifa por distancia)
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() =>
                      !isScheduledPaused &&
                      totalUnits <= 30 &&
                      setDeliveryType("scheduled")
                    }
                    className={
                      "p-3.5 rounded-card border transition-all flex flex-col justify-between select-none " +
                      (isScheduledPaused || totalUnits > 30
                        ? "opacity-50 cursor-not-allowed pointer-events-none border-border bg-surface-card"
                        : deliveryType === "scheduled"
                          ? "cursor-pointer border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "cursor-pointer border-border bg-surface-card hover:border-border-strong")
                    }
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      disabled={isScheduledPaused || totalUnits > 30}
                      checked={deliveryType === "scheduled"}
                      onChange={() =>
                        !isScheduledPaused &&
                        totalUnits <= 30 &&
                        setDeliveryType("scheduled")
                      }
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Calendar className="w-5 h-5 text-accent" />
                        {totalUnits > 30 ? (
                          <Badge variant="warning" className="text-[10px]">
                            Excede cap. moto (&gt;30)
                          </Badge>
                        ) : isScheduledPaused ? (
                          <Badge variant="warning" className="text-[10px]">
                            Pausado temporalmente
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Económico
                          </Badge>
                        )}
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Envío Programado
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Día siguiente (S/ 5.00 plano)
                      </span>
                    </div>
                  </label>
                </div>

                {/* Banner Informativo de Proximidad (Propuesta 1B) */}
                {deliveryType !== "pickup" &&
                  deliveryDistanceKm !== null &&
                  deliveryDistanceKm <= 1.0 &&
                  !isPickupPaused && (
                    <div className="bg-surface-subtle border border-border p-3 rounded-button flex items-start gap-2.5 text-xs text-brand-secondary animate-in fade-in duration-150">
                      <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                      <span>
                        Te encuentras a menos de 1 km de nuestro punto central. Si lo
                        prefieres, puedes seleccionar <strong>'Recojo en Tienda'</strong> y
                        retirar tu pedido sin costo de envío.
                      </span>
                    </div>
                  )}

                {deliveryType === "pickup" && (
                  <div className="p-4 bg-surface-subtle border border-border rounded-card space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                      <div className="flex items-center gap-2 font-bold text-brand-primary">
                        <Store className="w-4 h-4 text-accent shrink-0" />
                        <span>
                          {storeLocationData?.name || "Tienda ERXIDI Central"}{" "}
                          &bull;{" "}
                          {storeLocationData?.address ||
                            pickupStoreInfo.address}
                        </span>
                      </div>
                      <a
                        href={
                          "https://www.google.com/maps/dir/?api=1&destination=" +
                          (storeLocationData?.lat || -12.1215) +
                          "," +
                          (storeLocationData?.lng || -77.0298)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-button font-semibold text-xs shadow-sm transition-colors self-start sm:self-auto"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Cómo llegar a la tienda</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-brand-secondary">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Horario fijo: Lunes a Sábado de 09:00 a 18:00</span>
                    </div>
                    <div className="flex items-center gap-2 text-brand-secondary">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Coordinación previa: {pickupStoreInfo.phone}</span>
                    </div>
                  </div>
                )}

                {deliveryType !== "pickup" && (
                  <div className="space-y-5 pt-2 border-t border-border">
                    {deliveryType === "express" && (
                      <div
                        className={`p-3 rounded text-xs flex items-center gap-2 ${dynamicSla.isHighDemand
                          ? "bg-amber-50 border border-amber-300 text-amber-900"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-900"
                          }`}
                      >
                        <Zap className="w-4 h-4 text-accent shrink-0" />
                        <span className="font-semibold">
                          {dynamicSla.label}
                        </span>
                      </div>
                    )}

                    {deliveryType === "scheduled" && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5">
                          Ventana Horaria (Día Siguiente)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {defaultDeliverySlots.map((slot) => {
                            const isSelected = scheduledTimeSlot === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setScheduledTimeSlot(slot)}
                                className={
                                  "p-3 rounded-button border text-xs font-semibold flex items-center justify-between transition-colors " +
                                  (isSelected
                                    ? "border-brand-primary bg-surface-subtle text-brand-primary ring-1 ring-brand-primary"
                                    : "border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary")
                                }
                              >
                                <span>{slot}</span>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-accent" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {user && savedAddresses.length > 0 ? (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                            Dirección de Despacho
                          </label>
                          <span className="text-[11px] text-brand-muted">
                            {savedAddresses.length}{" "}
                            {savedAddresses.length === 1
                              ? "dirección guardada"
                              : "direcciones guardadas"}
                          </span>
                        </div>

                        {isLoadingAddresses ? (
                          <div className="p-6 text-center text-xs text-brand-muted flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-accent" />
                            <span>Cargando tus direcciones...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {savedAddresses.map((addr) => {
                              const isSelected =
                                selectedAddressMode === "saved" &&
                                selectedSavedAddressId === addr.id;
                              const zoneInfo = addr.delivery_zones
                                ?.district_name
                                ? {
                                  name: addr.delivery_zones.district_name,
                                  cost: addr.delivery_zones.delivery_cost,
                                }
                                : deliveryZones.find(
                                  (z) =>
                                    Number(z.id) === Number(addr.zone_id)
                                ) || {
                                  name: "Lima",
                                  cost: 10.0,
                                };

                              return (
                                <div
                                  key={addr.id}
                                  onClick={() => handleSelectSavedAddress(addr)}
                                  className={
                                    "p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between text-left select-none " +
                                    (isSelected
                                      ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary shadow-subtle"
                                      : "border-border bg-surface-card hover:border-border-strong")
                                  }
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-1.5 font-bold text-xs text-brand-primary">
                                        {addr.alias
                                          ?.toLowerCase()
                                          .includes("oficina") ? (
                                          <Building className="w-3.5 h-3.5 text-accent" />
                                        ) : (
                                          <Home className="w-3.5 h-3.5 text-accent" />
                                        )}
                                        <span>{addr.alias || "Dirección"}</span>
                                      </div>
                                      {addr.is_default && (
                                        <Badge
                                          variant="success"
                                          className="text-[9px] px-1.5 py-0 gap-0.5"
                                        >
                                          <Star className="w-2.5 h-2.5 fill-current" />
                                          Principal
                                        </Badge>
                                      )}
                                    </div>

                                    <p className="text-xs font-semibold text-brand-primary line-clamp-2">
                                      {addr.street_address}
                                    </p>
                                    <p className="text-[11px] text-brand-secondary mt-0.5">
                                      {zoneInfo.name} &bull; Flete:{" "}
                                      <span className="font-mono font-medium text-brand-primary">
                                        S/ {deliveryCost.toFixed(2)}
                                      </span>
                                    </p>
                                    {addr.reference && (
                                      <p className="text-[10px] text-brand-muted mt-1 italic line-clamp-1">
                                        Ref: {addr.reference}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            <div
                              onClick={handleSelectNewAddressMode}
                              className={
                                "p-3.5 rounded-card border cursor-pointer transition-all flex flex-col items-center justify-center text-center select-none min-h-[110px] " +
                                (selectedAddressMode === "new"
                                  ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                                  : "border-dashed border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/50")
                              }
                            >
                              <div className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center mb-1.5 text-accent">
                                <Plus className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-brand-primary">
                                Enviar a una nueva dirección
                              </span>
                              <span className="text-[10px] text-brand-secondary mt-0.5">
                                Fijar en el mapa con área de cobertura
                              </span>
                            </div>
                          </div>
                        )}

                        {selectedAddressMode === "saved" && (
                          <div className="pt-2">
                            <Input
                              label={<>Referencia de Llegada{REQUIRED_MARK}</>}
                              id="checkout-saved-ref"
                              placeholder="Confirma o detalla la referencia del domicilio"
                              value={deliveryReference}
                              onChange={(e) =>
                                setDeliveryReference(e.target.value)
                              }
                              onBlur={() => markTouched("deliveryReference")}
                              className={
                                errorOf("deliveryReference")
                                  ? INPUT_ERROR_CLASS
                                  : ""
                              }
                              required
                            />
                            {renderFieldError("deliveryReference")}
                          </div>
                        )}

                        {selectedAddressMode === "new" && (
                          <div className="space-y-4 pt-3 border-t border-border bg-surface-subtle/40 p-4 rounded-card border mt-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-bold text-brand-primary">
                                <MapPin className="w-4 h-4 text-accent" />
                                <span>Nueva Dirección de Entrega</span>
                              </div>
                              {isGeocoding && (
                                <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Ubicando...
                                </span>
                              )}
                            </div>

                            <LocationPickerMap
                              latitude={deliveryLatitude}
                              longitude={deliveryLongitude}
                              onChange={handleMapLocationChange}
                              coveragePolygon={coveragePolygon}
                              height="h-72"
                            />

                            {renderAddressInputs("checkout-new")}

                            <div className="pt-2 border-t border-border space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-primary select-none">
                                <input
                                  type="checkbox"
                                  checked={saveAddressForFuture}
                                  onChange={(e) =>
                                    setSaveAddressForFuture(e.target.checked)
                                  }
                                  className="w-4 h-4 text-accent border-border rounded"
                                />
                                <span>
                                  Guardar esta dirección en mi cuenta para
                                  futuras compras
                                </span>
                              </label>

                              {saveAddressForFuture && (
                                <div className="pl-6 max-w-xs">
                                  <Input
                                    label={<>Alias de la dirección{OPTIONAL_MARK}</>}
                                    id="checkout-new-alias"
                                    placeholder="Ej. Casa, Oficina"
                                    value={newAddressAlias}
                                    onChange={(e) =>
                                      setNewAddressAlias(e.target.value)
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                            Ubicación en el Mapa (Área de Cobertura Delimitada)
                          </label>
                          {isGeocoding && (
                            <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Obteniendo dirección...
                            </span>
                          )}
                        </div>

                        <LocationPickerMap
                          latitude={deliveryLatitude}
                          longitude={deliveryLongitude}
                          onChange={handleMapLocationChange}
                          coveragePolygon={coveragePolygon}
                          height="h-72"
                        />

                        {renderAddressInputs("checkout-manual")}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setCurrentStep(1)}
                  >
                    Regresar
                  </Button>

                  <div className="flex flex-col items-end gap-1">
                    {deliveryType !== "pickup" && isOutOfCoverage && (
                      <span className="text-xs text-rose-600 font-semibold text-right">
                        Ubicación fuera del área de cobertura.
                      </span>
                    )}
                    {deliveryType !== "pickup" &&
                      !activeCoordinates &&
                      deliveryAddress.trim().length >= 4 && (
                        <span className="text-xs text-amber-600 font-medium text-right">
                          Presiona el botón de lupa o haz clic en el mapa para
                          fijar las coordenadas.
                        </span>
                      )}
                    {deliveryType !== "pickup" &&
                      activeCoordinates &&
                      deliveryReference.trim().length < 3 && (
                        <span className="text-xs text-amber-600 font-medium text-right">
                          Completa la referencia obligatoria para continuar.
                        </span>
                      )}
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      disabled={!isStep2Valid || isValidatingPreflight || isStoreClosed}
                      isLoading={isValidatingPreflight}
                      onClick={handleNextFromStep2}
                    >
                      {isValidatingPreflight
                        ? "Verificando disponibilidad..."
                        : "Continuar al Pago"}
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 3: Pago y Comprobante (Con Countdown de Reserva) */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-bold text-brand-primary">
                    3. Pago y Comprobante
                  </h2>
                  <p className="text-xs text-brand-secondary mt-0.5">
                    Selecciona tu modalidad de pago y el tipo de comprobante
                    electrónico.
                  </p>
                </div>

                {reservationToken && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shadow-xs">
                    <Timer className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    <span>
                      Reserva activa: {formatTimer(reservationTimeLeft)}
                    </span>
                  </div>
                )}
              </div>

              <form onSubmit={handleConfirmOrder} className="space-y-6">
                {/* Selector de Comprobante */}
                <div className="space-y-3">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Comprobante de Pago
                  </span>

                  <label className="flex items-start gap-3 p-3.5 rounded-card border border-border bg-surface-card cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={receiptType !== "nota_venta"}
                      onChange={(e) =>
                        handleToggleElectronicReceipt(e.target.checked)
                      }
                      className="mt-0.5 w-4 h-4 text-accent border-border rounded"
                    />
                    <span className="text-sm font-semibold text-brand-primary">
                      Solicitar comprobante electrónico (Boleta o Factura)
                    </span>
                  </label>

                  {receiptType === "nota_venta" ? (
                    <div className="p-3 bg-surface-subtle border border-border rounded-card text-xs text-brand-secondary animate-in fade-in duration-150">
                      Sin comprobante electrónico. Se registrará una nota de
                      venta interna para el control y seguimiento de tu pedido.
                    </div>
                  ) : (
                    <div
                      className="flex flex-wrap gap-2 animate-in fade-in duration-150"
                      role="group"
                      aria-label="Tipo de comprobante electrónico"
                    >
                      {[
                        { id: "boleta", title: "Boleta de Venta" },
                        { id: "factura", title: "Factura Electrónica" },
                      ].map((item) => {
                        const active = receiptType === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleSelectReceiptType(item.id)}
                            className={
                              "px-4 h-9 rounded-full border text-xs font-bold transition-colors " +
                              (active
                                ? "border-brand-primary bg-brand-primary text-white"
                                : "border-border bg-surface-card text-brand-secondary hover:border-brand-primary")
                            }
                          >
                            {item.title}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Boleta de Venta */}
                  {receiptType === "boleta" && (
                    <div className="p-4 bg-surface-subtle border border-border rounded-card text-xs space-y-3">
                      {!showCustomBoletaForm ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-brand-secondary font-medium">
                              Titular del comprobante:
                            </span>
                            <span className="font-semibold text-brand-primary">
                              {firstName} {lastName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-brand-secondary font-medium">
                              Documento:
                            </span>
                            <span className="font-mono font-semibold text-brand-primary">
                              DNI {dni}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-border/70 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setUseCustomBoleta(true);
                                setBoletaDni("");
                                setBoletaFullName("");
                                setIsBoletaNameLocked(false);
                                setBoletaDniFeedback(null);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover hover:underline"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Emitir comprobante a nombre de otra persona o
                              registrar DNI
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-brand-primary">
                              {hasValidStep1Dni
                                ? "Datos del tercero para la Boleta"
                                : "Registrar DNI para la Boleta (Opcional)"}
                            </span>
                            {hasValidStep1Dni && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUseCustomBoleta(false);
                                  setBoletaDniFeedback(null);
                                }}
                                className="text-xs font-semibold text-brand-secondary hover:text-brand-primary hover:underline"
                              >
                                Usar mis datos del Paso 1
                              </button>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label
                                htmlFor="boleta-custom-dni"
                                className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                              >
                                DNI del Titular (8 dígitos){REQUIRED_MARK}
                              </label>
                              {isSearchingBoletaDni && (
                                <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Consultando RENIEC...
                                </span>
                              )}
                            </div>

                            <div className="flex gap-2 items-center">
                              <div className="flex-1">
                                <Input
                                  id="boleta-custom-dni"
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={8}
                                  placeholder="Ingresa 8 dígitos numéricos"
                                  value={boletaDni}
                                  onChange={handleBoletaDniChange}
                                  onBlur={() => markTouched("boletaDni")}
                                  className={
                                    touched.boletaDni &&
                                      !/^\d{8}$/.test(boletaDni)
                                      ? INPUT_ERROR_CLASS
                                      : ""
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      if (boletaDni.length === 8) {
                                        triggerBoletaDniLookup();
                                      }
                                    }
                                  }}
                                  required={useCustomBoleta}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="md"
                                onClick={() => triggerBoletaDniLookup()}
                                disabled={
                                  isSearchingBoletaDni ||
                                  boletaDni.length !== 8
                                }
                                className="h-10 px-3.5 shrink-0"
                                title="Buscar DNI en RENIEC"
                              >
                                {isSearchingBoletaDni ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                ) : (
                                  <Search className="w-4 h-4 text-brand-primary" />
                                )}
                              </Button>
                            </div>

                            {touched.boletaDni &&
                              !/^\d{8}$/.test(boletaDni) && (
                                <p className="text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in duration-150">
                                  El DNI debe tener exactamente 8 dígitos.
                                </p>
                              )}

                            {boletaDniFeedback && (
                              <p
                                className={
                                  "mt-1.5 text-xs " +
                                  (boletaDniFeedback.type === "success"
                                    ? "text-emerald-700 font-medium"
                                    : "text-amber-700")
                                }
                              >
                                {boletaDniFeedback.message}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="boleta-custom-name"
                              className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1"
                            >
                              Nombres y Apellidos del Titular{REQUIRED_MARK}
                            </label>
                            <Input
                              id="boleta-custom-name"
                              placeholder={
                                hasValidStep1Dni
                                  ? "Nombre completo del titular de la boleta"
                                  : firstName + " " + lastName
                              }
                              value={boletaFullName}
                              onChange={(e) =>
                                setBoletaFullName(e.target.value)
                              }
                              disabled={isBoletaNameLocked}
                              readOnly={isBoletaNameLocked}
                              className={
                                isBoletaNameLocked
                                  ? "bg-slate-100 text-slate-700 cursor-not-allowed"
                                  : ""
                              }
                              required={
                                useCustomBoleta || boletaDni.length === 8
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Factura Electrónica */}
                  {receiptType === "factura" && (
                    <div className="space-y-4 p-4 bg-surface-subtle border border-border rounded-card">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="checkout-ruc"
                            className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                          >
                            RUC (11 dígitos, verificado en SUNAT){REQUIRED_MARK}
                          </label>
                          {isSearchingRuc && (
                            <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Consultando SUNAT...
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
                            <Input
                              id="checkout-ruc"
                              type="text"
                              inputMode="numeric"
                              maxLength={11}
                              placeholder="20XXXXXXXXX o 10XXXXXXXXX"
                              value={ruc}
                              onChange={handleRucChange}
                              onBlur={() => markTouched("ruc")}
                              className={
                                touched.ruc && !isValidRucFormat(ruc)
                                  ? INPUT_ERROR_CLASS
                                  : ""
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (ruc.length === 11) {
                                    triggerRucLookup();
                                  }
                                }
                              }}
                              required
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={() => triggerRucLookup()}
                            disabled={isSearchingRuc || ruc.length !== 11}
                            className="h-10 px-3.5 shrink-0"
                            title="Consultar RUC en SUNAT"
                          >
                            {isSearchingRuc ? (
                              <Loader2 className="w-4 h-4 animate-spin text-accent" />
                            ) : (
                              <Search className="w-4 h-4 text-brand-primary" />
                            )}
                          </Button>
                        </div>

                        {touched.ruc && !isValidRucFormat(ruc) && (
                          <p className="text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in duration-150">
                            El RUC debe tener 11 dígitos y empezar con 10 o 20.
                          </p>
                        )}

                        {rucFeedback && (
                          <p
                            className={
                              "mt-1.5 text-xs font-medium " +
                              (rucFeedback.type === "success"
                                ? "text-emerald-700"
                                : "text-rose-600")
                            }
                          >
                            {rucFeedback.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="w-full col-span-full">
                          <Input
                            label={<>Razón Social{REQUIRED_MARK}</>}
                            id="checkout-company"
                            placeholder="Se autocompleta al validar el RUC con la lupa"
                            value={companyName}
                            readOnly={true}
                            className="w-full bg-slate-100 text-slate-700 cursor-not-allowed"
                            required
                          />
                        </div>

                        <div className="w-full col-span-full">
                          <Input
                            label={<>Dirección Fiscal{REQUIRED_MARK}</>}
                            id="checkout-fiscal-address"
                            placeholder="Se autocompleta al validar el RUC con la lupa"
                            value={fiscalAddress}
                            readOnly={true}
                            className="w-full bg-slate-100 text-slate-700 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Métodos de Pago Dinámicos desde store_settings */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Método de Pago
                  </label>

                  <div className="space-y-3">
                    {/* Tarjeta 1: Billeteras Digitales y Transferencias */}
                    {hasDigitalWallets && (
                      <div
                        className={
                          "rounded-card border transition-all overflow-hidden " +
                          (paymentMethod === "yape_plin"
                            ? "border-brand-primary ring-2 ring-brand-primary bg-surface-card shadow-sm"
                            : "border-border bg-surface-card hover:border-border-strong")
                        }
                      >
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("yape_plin")}
                          className="w-full p-4 text-left flex items-start gap-3.5"
                        >
                          <div
                            className={
                              "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors " +
                              (paymentMethod === "yape_plin"
                                ? "border-brand-primary bg-brand-primary text-white"
                                : "border-border-strong bg-white")
                            }
                          >
                            {paymentMethod === "yape_plin" && (
                              <Check className="w-3 h-3 stroke-[3]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-sm font-bold text-brand-primary">
                                Billeteras Digitales y Transferencias
                              </span>
                              <Badge variant="neutral" className="text-[10px]">
                                {isYapeEnabled && isPlinEnabled
                                  ? "Yape / Plin / Bancos"
                                  : isYapeEnabled
                                    ? "Yape / Bancos"
                                    : "Plin / Bancos"}
                              </Badge>
                            </div>
                            <p className="text-xs text-brand-secondary mt-1">
                              Paga escaneando nuestro QR oficial o mediante transferencia
                              directa a nuestras cuentas autorizadas.
                            </p>
                          </div>
                        </button>

                        <div
                          className={`transition-all duration-300 ease-in-out overflow-hidden ${paymentMethod === "yape_plin"
                            ? "max-h-[800px] opacity-100 border-t border-border"
                            : "max-h-0 opacity-0"
                            }`}
                        >
                          {(() => {
                            const yapeQrUrl =
                              dynamicSettings.paymentMethods?.yape_qr_url;
                            const yapeHolder =
                              dynamicSettings.paymentMethods?.yape_holder_name ||
                              dynamicSettings.paymentMethods?.digital_wallets
                                ?.holder_name ||
                              "ERXIDI Oficial";

                            const plinQrUrl =
                              dynamicSettings.paymentMethods?.plin_qr_url;
                            const plinHolder =
                              dynamicSettings.paymentMethods?.plin_holder_name ||
                              dynamicSettings.paymentMethods?.digital_wallets
                                ?.holder_name ||
                              "ERXIDI Oficial";

                            const currentWalletName =
                              selectedWallet === "plin" ? "Plin" : "Yape";
                            const currentQrUrl =
                              selectedWallet === "plin" ? plinQrUrl : yapeQrUrl;
                            const currentHolder =
                              selectedWallet === "plin" ? plinHolder : yapeHolder;

                            return (
                              <div className="p-4 bg-surface-subtle space-y-4">
                                {/* 4.1 Selector de Pestañas Segmentadas */}
                                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-border rounded-button w-fit">
                                  {isYapeEnabled && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedWallet("yape")}
                                      className={`px-3 py-1.5 text-xs rounded transition-colors ${selectedWallet === "yape"
                                        ? "bg-brand-primary text-white font-bold shadow-xs"
                                        : "text-brand-secondary hover:text-brand-primary font-medium"
                                        }`}
                                    >
                                      Yape
                                    </button>
                                  )}
                                  {isPlinEnabled && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedWallet("plin")}
                                      className={`px-3 py-1.5 text-xs rounded transition-colors ${selectedWallet === "plin"
                                        ? "bg-brand-primary text-white font-bold shadow-xs"
                                        : "text-brand-secondary hover:text-brand-primary font-medium"
                                        }`}
                                    >
                                      Plin
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedWallet("transferencia")
                                    }
                                    className={`px-3 py-1.5 text-xs rounded transition-colors ${selectedWallet === "transferencia"
                                      ? "bg-brand-primary text-white font-bold shadow-xs"
                                      : "text-brand-secondary hover:text-brand-primary font-medium"
                                      }`}
                                  >
                                    Transferencia Bancaria Directa
                                  </button>
                                </div>

                                {/* 4.2 Esquema a 2 Columnas para Yape y Plin */}
                                {selectedWallet !== "transferencia" ? (
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch p-4 bg-surface-subtle">
                                    {/* Columna Izquierda (md:col-span-5): Visualizador de Código QR */}
                                    <div className="md:col-span-5 flex flex-col items-center justify-center">
                                      <div className="bg-white border border-border rounded-card p-2 flex items-center justify-center aspect-square max-w-[220px] w-full mx-auto shadow-xs">
                                        {currentQrUrl && currentQrUrl.trim() ? (
                                          <img
                                            src={currentQrUrl}
                                            alt={`Código QR de ${currentWalletName}`}
                                            className="w-full h-full object-contain"
                                          />
                                        ) : (
                                          <div className="flex flex-col items-center justify-center p-3 text-center space-y-2">
                                            <Wallet className="w-10 h-10 text-brand-secondary" />
                                            <span className="text-[11px] text-brand-secondary leading-snug">
                                              Escaneo no requerido. Realiza el pago por transferencia directa al número telefónico.
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Columna Derecha (md:col-span-7): Datos de Recepción y Voucher */}
                                    <div className="md:col-span-7 flex flex-col justify-between space-y-3">
                                      <div className="space-y-3">
                                        <div>
                                          <span className="text-xs text-brand-secondary block">
                                            Titular de la cuenta:
                                          </span>
                                          <span className="text-sm font-bold text-brand-primary block">
                                            {currentHolder}
                                          </span>
                                        </div>

                                        <div className="p-3 bg-white border border-border rounded-card space-y-0.5">
                                          <span className="text-xs text-brand-secondary block">
                                            Monto exacto a transferir:
                                          </span>
                                          <span className="text-xl font-mono font-extrabold text-brand-primary block">
                                            {formatCurrency(totalAmount)}
                                          </span>
                                        </div>
                                      </div>

                                      <div>
                                        <Input
                                          label={
                                            <>
                                              {selectedWallet === "yape"
                                                ? "Número de Operación de Yape (6 a 8 dígitos)"
                                                : "Número de Operación de Plin"}
                                              {REQUIRED_MARK}
                                            </>
                                          }
                                          id="checkout-wallet-op"
                                          placeholder={
                                            selectedWallet === "yape"
                                              ? "Ej. 12345678"
                                              : "Ej. 87654321"
                                          }
                                          value={yapeOpNumber}
                                          onChange={(e) =>
                                            setYapeOpNumber(
                                              e.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 8)
                                            )
                                          }
                                          required={paymentMethod === "yape_plin" && selectedWallet !== "transferencia"}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  /* 4.3 Pestaña Transferencia Bancaria (Cuentas BCP / Interbank) */
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-brand-primary">
                                        <Landmark className="w-4 h-4 text-accent" />
                                        <span>
                                          Cuentas Corrientes Corporativas (Soles)
                                        </span>
                                      </div>
                                      <div className="p-2 bg-white border border-border rounded-card flex items-center gap-2">
                                        <span className="text-xs text-brand-secondary">
                                          Monto exacto:
                                        </span>
                                        <span className="text-sm font-mono font-extrabold text-brand-primary">
                                          {formatCurrency(totalAmount)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="space-y-2.5">
                                      {(
                                        dynamicSettings.paymentMethods
                                          ?.bank_accounts || []
                                      ).map((b, idx) => (
                                        <div
                                          key={idx}
                                          className="p-3 bg-white border border-border rounded-card text-xs space-y-2 shadow-xs"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold text-brand-primary text-sm">
                                              {b.bank}
                                            </span>
                                            {b.holder_name && (
                                              <span className="text-[11px] text-brand-secondary">
                                                Titular: {b.holder_name}
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                                            <div className="space-y-0.5">
                                              <span className="text-[10px] uppercase font-bold text-brand-secondary block">
                                                Número de Cuenta Corriente ({b.bank})
                                              </span>
                                              <span className="font-mono font-semibold text-brand-primary">
                                                {b.account_number}
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleCopy(
                                                  b.account_number,
                                                  `acc_${idx}`
                                                )
                                              }
                                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline self-start sm:self-auto"
                                            >
                                              <Copy className="w-3 h-3" />
                                              {copiedState === `acc_${idx}`
                                                ? "¡Copiado!"
                                                : "Copiar Cuenta"}
                                            </button>
                                          </div>

                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                                            <div className="space-y-0.5">
                                              <span className="text-[10px] uppercase font-bold text-brand-secondary block">
                                                Código Interbancario (CCI)
                                              </span>
                                              <span className="font-mono text-brand-secondary">
                                                {b.cci}
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleCopy(b.cci, `cci_${idx}`)
                                              }
                                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline self-start sm:self-auto"
                                            >
                                              <Copy className="w-3 h-3" />
                                              {copiedState === `cci_${idx}`
                                                ? "¡Copiado!"
                                                : "Copiar CCI"}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="pt-2">
                                      <Input
                                        label={
                                          <>
                                            Número de Operación o Constancia de Transferencia
                                            {REQUIRED_MARK}
                                          </>
                                        }
                                        id="checkout-bank-op"
                                        placeholder="Ingresa el código o número de constancia emitido por tu banco"
                                        value={yapeOpNumber}
                                        onChange={(e) =>
                                          setYapeOpNumber(e.target.value.trim())
                                        }
                                        required={paymentMethod === "yape_plin" && selectedWallet === "transferencia"}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Tarjeta 2: Pasarela Culqi */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("culqi_gateway")}
                      className={
                        "w-full p-4 rounded-card border text-left transition-all flex items-start gap-3.5 " +
                        (paymentMethod === "culqi_gateway"
                          ? "border-brand-primary ring-2 ring-brand-primary bg-brand-primary/5 shadow-sm"
                          : "border-border bg-surface-card hover:border-border-strong")
                      }
                    >
                      <div
                        className={
                          "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors " +
                          (paymentMethod === "culqi_gateway"
                            ? "border-brand-primary bg-brand-primary text-white"
                            : "border-border-strong bg-white")
                        }
                      >
                        {paymentMethod === "culqi_gateway" && (
                          <Check className="w-3 h-3 stroke-[3]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-primary">
                              Tarjetas de Débito / Crédito
                            </span>
                            <Badge variant="success" className="text-[10px]">
                              <ShieldCheck className="w-3 h-3" /> Pago seguro
                              con Culqi
                            </Badge>
                          </div>
                          <CreditCard className="w-4 h-4 text-accent" />
                        </div>
                        <p className="text-xs text-brand-secondary mt-1">
                          Visa, Mastercard, Diners, Amex y Yape con código de
                          aprobación.
                        </p>
                      </div>
                    </button>

                    {/* Tarjeta 3: Pago Contra Entrega */}
                    <button
                      type="button"
                      disabled={!isCashOnDeliveryAllowed}
                      onClick={() => {
                        if (isCashOnDeliveryAllowed) {
                          setPaymentMethod("cash_on_delivery");
                        }
                      }}
                      className={
                        "w-full p-4 rounded-card border text-left transition-all flex items-start gap-3.5 " +
                        (!isCashOnDeliveryAllowed
                          ? "border-border bg-surface-subtle opacity-60 cursor-not-allowed"
                          : paymentMethod === "cash_on_delivery"
                            ? "border-brand-primary ring-2 ring-brand-primary bg-brand-primary/5 shadow-sm"
                            : "border-border bg-surface-card hover:border-border-strong")
                      }
                    >
                      <div
                        className={
                          "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors " +
                          (paymentMethod === "cash_on_delivery" &&
                            isCashOnDeliveryAllowed
                            ? "border-brand-primary bg-brand-primary text-white"
                            : "border-border-strong bg-white")
                        }
                      >
                        {paymentMethod === "cash_on_delivery" &&
                          isCashOnDeliveryAllowed && (
                            <Check className="w-3 h-3 stroke-[3]" />
                          )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-primary">
                              Pago Contra Entrega
                            </span>
                            {!isCashOnDeliveryAllowed && (
                              <Badge variant="warning" className="text-[10px]">
                                Solo cuentas verificadas
                              </Badge>
                            )}
                          </div>
                          <Banknote className="w-4 h-4 text-brand-secondary" />
                        </div>
                        <p className="text-xs text-brand-secondary mt-1">
                          Paga en efectivo al repartidor al recibir tu pedido en la puerta
                          de tu domicilio.
                        </p>
                      </div>
                    </button>
                  </div>

                  {isProcessing && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-card text-xs text-blue-800 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                      <p className="font-medium">
                        Procesando cobro seguro con Culqi...
                      </p>
                    </div>
                  )}

                  {culqiError && (
                    <div className="p-3 bg-rose-50 border border-status-danger-border rounded-card text-xs text-status-danger-text flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          Inconveniente al procesar el pedido
                        </p>
                        <p>{culqiError}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-between items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setCurrentStep(2)}
                    disabled={isSubmitting || isProcessing}
                  >
                    Regresar
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={
                      !paymentMethod ||
                      !isStep3Valid ||
                      isSubmitting ||
                      isProcessing ||
                      reservationTimeLeft <= 0 ||
                      isStoreClosed
                    }
                    isLoading={isSubmitting || isProcessing}
                    className="bg-accent hover:bg-accent-hover text-white px-8"
                  >
                    {!paymentMethod
                      ? "Selecciona un método de pago"
                      : isProcessing
                        ? "Procesando..."
                        : paymentMethod === "culqi_gateway"
                          ? "Pagar con Culqi " + formatCurrency(totalAmount)
                          : "Confirmar Pedido " + formatCurrency(totalAmount)}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Resumen Lateral */}
        <aside className="lg:col-span-4">
          <div className="bg-surface-card border border-border rounded-card p-5 space-y-5 sticky top-24 shadow-subtle">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-primary">
                Resumen del Pedido
              </h3>
              <Badge variant="neutral" className="text-[11px] font-mono">
                {totalUnits} {totalUnits === 1 ? "prenda" : "prendas"}
              </Badge>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-3 text-xs items-center justify-between"
                >
                  <div className="flex gap-2.5 items-center min-w-0">
                    <div className="w-10 h-12 rounded bg-surface-subtle border border-border overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-brand-muted">
                          N/A
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-brand-primary truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-brand-secondary">
                        Talla:{" "}
                        <span className="font-mono font-semibold">
                          {item.size}
                        </span>{" "}
                        &bull; Cant: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-brand-primary shrink-0">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-brand-secondary">
                <span>Subtotal prendas:</span>
                <span className="font-mono font-semibold text-brand-primary">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex justify-between text-brand-secondary">
                <span>Costo de envío:</span>
                <span className="font-mono font-semibold text-brand-primary">
                  {deliveryCost === 0 ? (
                    <span className="text-emerald-600 font-bold">Gratis</span>
                  ) : (
                    formatCurrency(deliveryCost)
                  )}
                </span>
              </div>

              <div className="border-t border-border pt-2 flex justify-between items-baseline text-sm">
                <span className="font-bold text-brand-primary">Total:</span>
                <span className="font-mono text-lg font-extrabold text-brand-primary">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle border border-border rounded text-[11px] text-brand-secondary flex items-start gap-2 leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                Por motivos de higiene sanitaria, la ropa interior no admite
                cambios ni devoluciones una vez abierto el empaque.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}