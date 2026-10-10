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
  Edit3,
  QrCode,
  Banknote,
  MapPin,
  Plus,
  Star,
  Home,
  Building,
  Navigation,
  ExternalLink,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Input from "../../components/ui/Input";
import LocationPickerMap from "../../components/ui/LocationPickerMap";
import { fetchDni, fetchRuc } from "../../services/api/decolectaService";
import { createOrder } from "../../services/api/checkoutService";
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
import { getStoreDeliverySettings } from "../admin/services/adminSettings.service";
import {
  isPointInPolygon,
  calculateDistanceKm,
  calculateDeliveryFee,
} from "../../utils/geoUtils";

export default function CheckoutView() {
  const navigate = useNavigate();
  const { items, totalUnits, subtotal, clearCart } = useCart();
  const { user, profile } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState({ 1: false, 2: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const createdOrderRef = useRef(null);

  // -------------------------------------------------------------
  // PASO 1: Identificación y Contacto
  // -------------------------------------------------------------
  const [dni, setDni] = useState(profile?.document_number || "");
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
      if (profile.dni || profile.document_number) {
        setDni(profile.dni || profile.document_number);
      }
      setIsNameLocked(true);
    }
  }, [user, profile]);

  const triggerDniLookup = async (dniToSearch = dni) => {
    const clean = String(dniToSearch || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (!/^\d{8}$/.test(clean)) {
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
          `${res.firstLastName || ""} ${res.secondLastName || ""}`.trim(),
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
            "No pudimos autocompletar tus datos. Ingrésalos manualmente.",
        });
      }
    } catch {
      setIsNameLocked(false);
      setDniFeedback({
        type: "info",
        message:
          "Servicio no disponible momentáneamente. Ingresa tus datos manualmente.",
      });
    } finally {
      setIsSearchingDni(false);
    }
  };

  const handleDniChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "").slice(0, 8);
    setDni(rawVal);
    setDniFeedback(null);

    if (rawVal.length === 8) {
      triggerDniLookup(rawVal);
    } else {
      setIsNameLocked(false);
    }
  };

  const isStep1Valid = useMemo(() => {
    const isDniValid = /^\d{8}$/.test(dni);
    const isNameValid =
      firstName.trim().length > 1 && lastName.trim().length > 1;
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const isPhoneValid = /^9\d{8}$/.test(phone.trim());
    return isDniValid && isNameValid && isEmailValid && isPhoneValid;
  }, [dni, firstName, lastName, email, phone]);

  const handleNextFromStep1 = (e) => {
    e.preventDefault();
    if (isStep1Valid) {
      setCompletedSteps((prev) => ({ ...prev, 1: true }));
      setCurrentStep(2);
    }
  };

  // -------------------------------------------------------------
  // PASO 2: Método de Entrega, Horarios y Direcciones
  // -------------------------------------------------------------
  const [deliveryType, setDeliveryType] = useState("scheduled");
  const [deliveryZones, setDeliveryZones] = useState(defaultDeliveryZones);
  const [selectedZoneId, setSelectedZoneId] = useState(
    defaultDeliveryZones[0]?.id || 1,
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState(
    defaultDeliverySlots[0],
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
  const [deliveryPricing, setDeliveryPricing] = useState({
    baseFee: 7.0,
    baseKm: 3.0,
    pricePerExtraKm: 1.5,
  });

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
          setDeliveryPricing({
            baseFee: Number(settings.pricing.baseFee ?? 7.0),
            baseKm: Number(settings.pricing.baseKm ?? 3.0),
            pricePerExtraKm: Number(settings.pricing.pricePerExtraKm ?? 1.5),
          });
        }
      })
      .catch((err) => {
        console.error("Error al cargar configuración de cobertura:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeCoordinates = useMemo(() => {
    if (selectedAddressMode === "saved" && selectedSavedAddressId) {
      const addr = (savedAddresses || []).find(
        (a) => a.id === selectedSavedAddressId,
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
            defaultAddr.latitude != null ? Number(defaultAddr.latitude) : null,
          );
          setDeliveryLongitude(
            defaultAddr.longitude != null
              ? Number(defaultAddr.longitude)
              : null,
          );

          if (defaultAddr.receiver_phone) {
            setPhone(defaultAddr.receiver_phone.replace(/\D/g, "").slice(0, 9));
          }
          if (defaultAddr.receiver_name) {
            const parts = defaultAddr.receiver_name.trim().split(" ");
            if (parts.length > 1) {
              setFirstName(parts.slice(0, -1).join(" "));
              setLastName(parts.slice(-1).join(" "));
            } else if (parts[0]) {
              setFirstName(parts[0]);
            }
          }
        } else {
          setSavedAddresses([]);
          setSelectedAddressMode("new");
          setSelectedSavedAddressId(null);
        }
      } catch (err) {
        console.error("Error al cargar direcciones:", err);
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
      addr.longitude != null ? Number(addr.longitude) : null,
    );

    if (addr.receiver_phone) {
      setPhone(addr.receiver_phone.replace(/\D/g, "").slice(0, 9));
    }
    if (addr.receiver_name) {
      const parts = addr.receiver_name.trim().split(" ");
      if (parts.length > 1) {
        setFirstName(parts.slice(0, -1).join(" "));
        setLastName(parts.slice(-1).join(" "));
      } else if (parts[0]) {
        setFirstName(parts[0]);
      }
    }
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
    [deliveryZones, selectedZoneId],
  );

  // Geocodificación Inversa: El pin en el mapa manda sobre la dirección y resuelve el distrito
  const handleMapLocationChange = async ({ lat, lng }) => {
    setDeliveryLatitude(lat);
    setDeliveryLongitude(lng);

    try {
      setIsGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      );
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
                .includes(detectedDistrict.toLowerCase()),
          );
          if (matched) {
            setSelectedZoneId(Number(matched.id));
          }
        }
      }
    } catch (err) {
      console.warn("Error en reverse geocoding:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Geocodificación Directa de respaldo
  const searchAddressOnMap = async (queryText) => {
    const clean = (queryText || "").trim();
    if (clean.length < 4) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          `${clean}, Lima, Perú`,
        )}&limit=1`,
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setDeliveryLatitude(lat);
        setDeliveryLongitude(lon);
      }
    } catch (err) {
      console.warn("Error geocodificando dirección:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleDeliveryAddressChange = (value) => {
    setDeliveryAddress(value);
  };

  const expressTimeWindow = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 45 * 60000);
    const end = new Date(now.getTime() + 90 * 60000);
    const formatH = (d) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `Tu pedido llegará hoy entre las ${formatH(start)} y ${formatH(end)} hrs`;
  }, []);

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
      activeCoordinates,
    );
  }, [activeCoordinates, storeLocationData]);

  const deliveryCost = useMemo(() => {
    if (deliveryType === "pickup") return 0;

    let baseShippingFee = selectedZone?.delivery_cost || 10.0;
    if (deliveryDistanceKm !== null) {
      baseShippingFee = calculateDeliveryFee(
        deliveryDistanceKm,
        deliveryPricing,
      );
    }

    if (deliveryType === "express") {
      return Number((baseShippingFee + 5.0).toFixed(2));
    }
    return baseShippingFee;
  }, [deliveryType, selectedZone, deliveryDistanceKm, deliveryPricing]);

  const totalAmount = subtotal + deliveryCost;

  // Validación: Referencia opcional, dirección y coordenadas obligatorias para envíos a domicilio
  const isStep2Valid = useMemo(() => {
    if (deliveryType === "pickup") return true;
    if (isOutOfCoverage) return false;
    if (!activeCoordinates) return false;

    return deliveryAddress.trim().length >= 4;
  }, [deliveryType, isOutOfCoverage, activeCoordinates, deliveryAddress]);

  const handleNextFromStep2 = (e) => {
    e.preventDefault();
    if (isStep2Valid) {
      setCompletedSteps((prev) => ({ ...prev, 2: true }));
      setCurrentStep(3);
    }
  };

  // -------------------------------------------------------------
  // PASO 3: Pago y Comprobante
  // -------------------------------------------------------------
  const [paymentMethod, setPaymentMethod] = useState("yape_plin");
  const [yapeOpNumber, setYapeOpNumber] = useState("");
  const [culqiError, setCulqiError] = useState(null);

  const [receiptType, setReceiptType] = useState("boleta");
  const [ruc, setRuc] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fiscalAddress, setFiscalAddress] = useState("");
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [isRucLocked, setIsRucLocked] = useState(false);
  const [rucFeedback, setRucFeedback] = useState(null);

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
            reference: ctx.deliveryReference.trim() || "Sin referencia",
            receiver_name:
              `${ctx.firstName.trim()} ${ctx.lastName.trim()}`.trim(),
            receiver_phone: ctx.phone.trim(),
            is_default: (ctx.savedAddresses || []).length === 0,
            latitude: ctx.deliveryLatitude || null,
            longitude: ctx.deliveryLongitude || null,
            updated_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.warn("Aviso al guardar nueva dirección:", err);
      }
    }
  };

  const buildOrderPayload = (
    gatewayTxId = null,
    paymentStatus = "pending_verification",
  ) => {
    const ctx = orderContextRef.current;
    const fullName = `${ctx.firstName.trim()} ${ctx.lastName.trim()}`.trim();
    const finalAddress =
      ctx.deliveryType === "pickup"
        ? pickupStoreInfo.address
        : `${ctx.deliveryAddress.trim()}${
            ctx.deliveryReference.trim()
              ? ` (Ref: ${ctx.deliveryReference.trim()})`
              : ""
          } - ${ctx.selectedZone?.district_name || "Lima"}`;

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
            (a) => a.id === ctx.selectedSavedAddressId,
          )
        : null;

    const resolvedLat =
      ctx.deliveryType === "pickup"
        ? null
        : (selectedAddress?.latitude ?? ctx.deliveryLatitude ?? null);

    const resolvedLng =
      ctx.deliveryType === "pickup"
        ? null
        : (selectedAddress?.longitude ?? ctx.deliveryLongitude ?? null);

    const invoicePrefix =
      ctx.receiptType === "factura"
        ? "F001"
        : ctx.receiptType === "boleta"
          ? "B001"
          : "NV01";
    const invoiceDocNumber = `${invoicePrefix}-${Date.now().toString().slice(-6)}`;

    const invoiceData = {
      type: ctx.receiptType,
      doc_number: invoiceDocNumber,
      tax_id: ctx.receiptType === "factura" ? ctx.ruc.trim() : ctx.dni.trim(),
      legal_name:
        ctx.receiptType === "factura" ? ctx.companyName.trim() : fullName,
      fiscal_address:
        ctx.receiptType === "factura"
          ? ctx.fiscalAddress.trim() || finalAddress
          : finalAddress,
      issued_at: new Date().toISOString(),
    };

    return {
      userId: ctx.user?.id || null,
      customerName: fullName,
      customerEmail: ctx.email.trim(),
      customerPhone: ctx.phone.trim(),
      deliveryType: ctx.deliveryType,
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
      scheduledTimeSlot:
        ctx.deliveryType === "scheduled"
          ? ctx.scheduledTimeSlot
          : deliveryType === "express"
            ? "Express Mismo Día"
            : "Horario Comercial 09:00 - 18:00",
      subtotal: ctx.subtotal,
      totalAmount: ctx.totalAmount,
      payment_method: "culqi_gateway",
      paymentMethod: "culqi_gateway",
      payment_status: paymentStatus,
      paymentStatus,
      payment_gateway_tx_id: gatewayTxId,
      paymentGatewayTxId: gatewayTxId,
      invoice_type: ctx.receiptType,
      invoice_data: invoiceData,
      items: ctx.items,
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
        const orderPayload = buildOrderPayload(null, "pending_verification");
        const result = await createOrder(orderPayload);
        if (!result.success || !result.order) {
          throw new Error(
            result.error || "No se pudo registrar la orden en el sistema.",
          );
        }
        orderToCharge = result.order;
        createdOrderRef.current = result.order;
        setCreatedOrder(result.order);
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
          status: "pending",
          payment_status: "paid",
          payment_gateway_tx_id: chargeId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderToCharge.id);

      clearCart();
      navigate(`/seguimiento/${orderToCharge.order_number}`);
    } catch (err) {
      console.error("Error al procesar cobro de Culqi:", err);
      setCulqiError(
        err.message ||
          "Tu tarjeta fue rechazada o ocurrió un inconveniente con la pasarela. Inténtalo nuevamente o elige otro método.",
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
        } else if (window.Culqi?.order) {
          const order = window.Culqi.order;
          closeCulqi();
          await handleCulqiTokenPayment(order.id);
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
        console.error("Error en callback window.culqi:", err);
        setCulqiError(err.message || "Error inesperado al procesar el pago.");
        setIsProcessing(false);
        setIsSubmitting(false);
      }
    };

    return () => {
      window.culqi = null;
    };
  }, []);

  const triggerRucLookup = async (rucToSearch = ruc) => {
    const clean = String(rucToSearch || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    if (!/^(10|20)\d{9}$/.test(clean)) {
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
        if (res.address) {
          setFiscalAddress(res.address);
        }
        setIsRucLocked(true);
        setRucFeedback({
          type: "success",
          message: `✓ RUC verificado: ${res.status || "ACTIVO"}`,
        });
      } else {
        setIsRucLocked(false);
        setRucFeedback({
          type: "info",
          message: "Completa la Razón Social y Dirección Fiscal manualmente.",
        });
      }
    } catch {
      setIsRucLocked(false);
      setRucFeedback({
        type: "info",
        message: "No pudimos consultar SUNAT. Ingrésalos manualmente.",
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

    if (val.length === 11 && /^(10|20)\d{9}$/.test(val)) {
      triggerRucLookup(val);
    }
  };

  const isCashOnDeliveryAllowed = Boolean(user && user.email_confirmed_at);

  const isStep3Valid = useMemo(() => {
    if (paymentMethod === "yape_plin") {
      if (!/^\d{6,8}$/.test(yapeOpNumber.trim())) return false;
    } else if (paymentMethod === "cash_on_delivery") {
      if (!isCashOnDeliveryAllowed) return false;
    }

    if (receiptType === "factura") {
      if (!/^(10|20)\d{9}$/.test(ruc.trim())) return false;
      if (companyName.trim().length < 2) return false;
    }

    return true;
  }, [
    paymentMethod,
    yapeOpNumber,
    isCashOnDeliveryAllowed,
    receiptType,
    ruc,
    companyName,
  ]);

  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (isSubmitting || isProcessing) return;

    if (receiptType === "factura") {
      if (!/^(10|20)\d{9}$/.test(ruc.trim()) || companyName.trim().length < 2) {
        setRucFeedback({
          type: "error",
          message:
            "Por favor completa un RUC y Razón Social válidos para la Factura.",
        });
        return;
      }
    }

    if (paymentMethod === "culqi_gateway") {
      setCulqiError(null);
      try {
        if (!createdOrderRef.current) {
          await maybeSaveNewAddress();
          const payload = buildOrderPayload(null, "pending_verification");
          const res = await createOrder(payload);
          if (res.success && res.order) {
            createdOrderRef.current = res.order;
            setCreatedOrder(res.order);
          }
        }
        initCulqi({
          title: "ERXIDI - Confecciones",
          amountInCents: totalAmount * 100,
        });
        openCulqi();
      } catch (err) {
        console.error("Error al iniciar Culqi:", err);
        setCulqiError(err.message || "No se pudo abrir la pasarela Culqi.");
      }
      return;
    }

    if (!isStep3Valid) return;

    setIsSubmitting(true);
    setCulqiError(null);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const finalAddress =
      deliveryType === "pickup"
        ? pickupStoreInfo.address
        : `${deliveryAddress.trim()}${
            deliveryReference.trim()
              ? ` (Ref: ${deliveryReference.trim()})`
              : ""
          } - ${selectedZone?.district_name || "Lima"}`;

    const isUsingSavedAddress =
      deliveryType !== "pickup" &&
      selectedAddressMode === "saved" &&
      Boolean(selectedSavedAddressId);

    const shippingAddressId = isUsingSavedAddress
      ? selectedSavedAddressId
      : null;

    const selectedAddress =
      deliveryType !== "pickup" && selectedAddressMode === "saved"
        ? (savedAddresses || []).find((a) => a.id === selectedSavedAddressId)
        : null;

    const resolvedLatitude =
      deliveryType === "pickup"
        ? null
        : (selectedAddress?.latitude ?? deliveryLatitude ?? null);

    const resolvedLongitude =
      deliveryType === "pickup"
        ? null
        : (selectedAddress?.longitude ?? deliveryLongitude ?? null);

    await maybeSaveNewAddress();

    const invoicePrefix =
      receiptType === "factura"
        ? "F001"
        : receiptType === "boleta"
          ? "B001"
          : "NV01";
    const invoiceDocNumber = `${invoicePrefix}-${Date.now().toString().slice(-6)}`;

    const invoiceData = {
      type: receiptType,
      doc_number: invoiceDocNumber,
      tax_id: receiptType === "factura" ? ruc.trim() : dni.trim(),
      legal_name: receiptType === "factura" ? companyName.trim() : fullName,
      fiscal_address:
        receiptType === "factura"
          ? fiscalAddress.trim() || finalAddress
          : finalAddress,
      issued_at: new Date().toISOString(),
    };

    const isCashOnDelivery = paymentMethod === "cash_on_delivery";

    const orderPayload = {
      userId: user?.id || null,
      customerName: fullName,
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
      deliveryType,
      deliveryAddress: finalAddress,
      delivery_latitude: resolvedLatitude,
      deliveryLatitude: resolvedLatitude,
      delivery_longitude: resolvedLongitude,
      deliveryLongitude: resolvedLongitude,
      shipping_address_id: shippingAddressId,
      shippingAddressId,
      deliveryZoneId:
        deliveryType === "pickup" ? null : selectedZone?.id || null,
      deliveryCost,
      scheduledTimeSlot:
        deliveryType === "scheduled"
          ? scheduledTimeSlot
          : deliveryType === "express"
            ? "Express Mismo Día"
            : "Horario Comercial 09:00 - 18:00",
      subtotal,
      totalAmount,
      payment_method: paymentMethod,
      paymentMethod,
      payment_status: isCashOnDelivery ? "pending" : "pending_verification",
      paymentStatus: isCashOnDelivery ? "pending" : "pending_verification",
      payment_gateway_tx_id: isCashOnDelivery ? null : yapeOpNumber.trim(),
      paymentGatewayTxId: isCashOnDelivery ? null : yapeOpNumber.trim(),
      invoice_type: receiptType,
      invoice_data: invoiceData,
      items,
    };

    try {
      if (createdOrderRef.current?.id) {
        const { error: updateOrderError } = await supabase
          .from("orders")
          .update({
            payment_method: paymentMethod,
            payment_status: isCashOnDelivery
              ? "pending"
              : "pending_verification",
            payment_gateway_tx_id: isCashOnDelivery
              ? null
              : yapeOpNumber.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdOrderRef.current.id);

        if (!updateOrderError) {
          clearCart();
          navigate(`/seguimiento/${createdOrderRef.current.order_number}`);
          return;
        }
      }

      const result = await createOrder(orderPayload);
      if (result.success && result.order) {
        clearCart();
        navigate(`/seguimiento/${result.order.order_number}`, {
          state: { order: result.order },
        });
      }
    } catch (err) {
      console.error("Error al procesar la compra:", err);
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
            <li
              onClick={() => handleStepClick(1)}
              className={`p-3 rounded-card border transition-all cursor-pointer select-none flex items-center gap-3 ${
                currentStep === 1
                  ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary"
                  : completedSteps[1]
                    ? "border-emerald-300 bg-emerald-50/40 hover:border-brand-primary"
                    : "border-border bg-surface-subtle opacity-70"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  completedSteps[1]
                    ? "bg-emerald-600 text-white"
                    : currentStep === 1
                      ? "bg-brand-primary text-white"
                      : "bg-surface-subtle text-brand-secondary border border-border"
                }`}
              >
                {completedSteps[1] ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Paso 1
                </span>
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Identificación
                </span>
              </div>
            </li>

            <li
              onClick={() => handleStepClick(2)}
              className={`p-3 rounded-card border transition-all ${
                completedSteps[1]
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              } select-none flex items-center gap-3 ${
                currentStep === 2
                  ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary"
                  : completedSteps[2]
                    ? "border-emerald-300 bg-emerald-50/40 hover:border-brand-primary"
                    : "border-border bg-surface-subtle"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  completedSteps[2]
                    ? "bg-emerald-600 text-white"
                    : currentStep === 2
                      ? "bg-brand-primary text-white"
                      : "bg-surface-subtle text-brand-secondary border border-border"
                }`}
              >
                {completedSteps[2] ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Paso 2
                </span>
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Entrega
                </span>
              </div>
            </li>

            <li
              onClick={() => handleStepClick(3)}
              className={`p-3 rounded-card border transition-all ${
                completedSteps[1] && completedSteps[2]
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              } select-none flex items-center gap-3 ${
                currentStep === 3
                  ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary"
                  : "border-border bg-surface-subtle"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  currentStep === 3
                    ? "bg-brand-primary text-white"
                    : "bg-surface-subtle text-brand-secondary border border-border"
                }`}
              >
                3
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Paso 3
                </span>
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Pago
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Formulario (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* ========================================================= */}
          {/* PASO 1 */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-base font-bold text-brand-primary">
                  1. Identificación y Contacto
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Ingresa tus datos personales para validar tu identidad con
                  RENIEC y coordinar el despacho.
                </p>
              </div>

              {user && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-card flex items-center justify-between text-xs text-emerald-900 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
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
                      DNI (8 dígitos)
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
                        placeholder="Ingresa 8 dígitos"
                        value={dni}
                        onChange={handleDniChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            triggerDniLookup();
                          }
                        }}
                        disabled={Boolean(user && profile?.document_number)}
                        required
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => triggerDniLookup()}
                      disabled={isSearchingDni || dni.length !== 8}
                      className="h-10 px-3.5 flex-shrink-0"
                      title="Consultar DNI en RENIEC"
                    >
                      {isSearchingDni ? (
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      ) : (
                        <Search className="w-4 h-4 text-brand-primary" />
                      )}
                    </Button>
                  </div>

                  {dniFeedback && (
                    <div
                      className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                        dniFeedback.type === "success"
                          ? "text-emerald-600 font-medium"
                          : "text-amber-600"
                      }`}
                    >
                      {dniFeedback.type === "success" ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{dniFeedback.message}</span>
                    </div>
                  )}

                  {isNameLocked && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setIsNameLocked(false)}
                        className="text-xs text-accent hover:text-accent-hover font-semibold hover:underline flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar nombres manualmente
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Nombres"
                    id="checkout-firstname"
                    placeholder="Tus nombres"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isNameLocked}
                    required
                  />

                  <Input
                    label="Apellidos"
                    id="checkout-lastname"
                    placeholder="Tus apellidos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isNameLocked}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Correo Electrónico"
                    id="checkout-email"
                    type="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <div>
                    <Input
                      label="WhatsApp / Celular"
                      id="checkout-phone"
                      type="tel"
                      placeholder="9XXXXXXXX (9 dígitos)"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                      }
                      required
                    />
                    <span className="text-[10px] text-brand-muted mt-1 block">
                      Usado para validar el pago y coordinar la entrega.
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!isStep1Valid}
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
                  Elige la modalidad que mejor se adapte a tus necesidades.
                </p>
              </div>

              <form onSubmit={handleNextFromStep2} className="space-y-6">
                {/* Alerta contextual si está fuera de cobertura */}
                {deliveryType !== "pickup" && isOutOfCoverage && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-card flex items-start gap-2.5 text-xs text-rose-900 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">
                        Zona fuera de cobertura a domicilio
                      </strong>
                      <span>
                        La ubicación fijada en el mapa se encuentra fuera de
                        nuestra zona de cobertura. Ubica el pin dentro de la
                        zona delimitada o cambia a{" "}
                        <strong>Recojo en Tienda</strong> para continuar.
                      </span>
                    </div>
                  </div>
                )}

                {/* 3 Opciones de Entrega: Seleccionables en todo momento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Recojo en Tienda */}
                  <label
                    onClick={() => setDeliveryType("pickup")}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === "pickup"
                        ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                        : "border-border bg-surface-card hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === "pickup"}
                      onChange={() => setDeliveryType("pickup")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Store className="w-5 h-5 text-accent" />
                        <Badge variant="success" className="text-[10px]">
                          Gratis
                        </Badge>
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Recojo en Tienda
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Stand Central ERXIDI
                      </span>
                    </div>
                  </label>

                  {/* Envío Express */}
                  <label
                    onClick={() => setDeliveryType("express")}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === "express"
                        ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                        : "border-border bg-surface-card hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === "express"}
                      onChange={() => setDeliveryType("express")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Zap className="w-5 h-5 text-accent" />
                        <Badge variant="warning" className="text-[10px]">
                          Mismo Día
                        </Badge>
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Envío Express
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Entrega prioritaria en 45 a 90 min
                      </span>
                    </div>
                  </label>

                  {/* Envío Programado */}
                  <label
                    onClick={() => setDeliveryType("scheduled")}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === "scheduled"
                        ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                        : "border-border bg-surface-card hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === "scheduled"}
                      onChange={() => setDeliveryType("scheduled")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Calendar className="w-5 h-5 text-accent" />
                        <Badge variant="success" className="text-[10px]">
                          Económico
                        </Badge>
                        <Badge variant="neutral" className="text-[10px]">
                          Día Siguiente
                        </Badge>
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Envío Programado
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Elige tu ventana horaria preferida
                      </span>
                    </div>
                  </label>
                </div>

                {/* Vista Recojo en Tienda */}
                {deliveryType === "pickup" && (
                  <div className="p-4 bg-surface-subtle border border-border rounded-card space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                      <div className="flex items-center gap-2 font-bold text-brand-primary">
                        <Store className="w-4 h-4 text-accent flex-shrink-0" />
                        <span>
                          {storeLocationData?.name || "Taller ERXIDI Central"}{" "}
                          &bull;{" "}
                          {storeLocationData?.address ||
                            pickupStoreInfo.address}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${
                          storeLocationData?.lat || -12.1215
                        },${storeLocationData?.lng || -77.0298}`}
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

                {/* Vista Envío Express o Programado */}
                {deliveryType !== "pickup" && (
                  <div className="space-y-5 pt-2 border-t border-border">
                    {deliveryType === "express" && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="font-semibold">
                          {expressTimeWindow}
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
                                className={`p-3 rounded-button border text-xs font-semibold flex items-center justify-between transition-colors focus:outline-none ${
                                  isSelected
                                    ? "border-brand-primary bg-surface-subtle text-brand-primary ring-1 ring-brand-primary"
                                    : "border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary"
                                }`}
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

                    {/* Selector de Dirección Guardada */}
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
                                      Number(z.id) === Number(addr.zone_id),
                                  ) || {
                                    name: "Lima",
                                    cost: 10.0,
                                  };

                              return (
                                <div
                                  key={addr.id}
                                  onClick={() => handleSelectSavedAddress(addr)}
                                  className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between text-left select-none ${
                                    isSelected
                                      ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary shadow-subtle"
                                      : "border-border bg-surface-card hover:border-border-strong"
                                  }`}
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
                                        S/{" "}
                                        {isSelected
                                          ? deliveryCost.toFixed(2)
                                          : Number(zoneInfo.cost).toFixed(2)}
                                      </span>
                                      {deliveryType === "express" &&
                                        " (+S/ 5.00 Express)"}
                                    </p>
                                    {addr.reference && (
                                      <p className="text-[10px] text-brand-muted mt-1 italic line-clamp-1">
                                        Ref: {addr.reference}
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-brand-muted">
                                    <span>Recibe: {addr.receiver_name}</span>
                                    <div
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        isSelected
                                          ? "border-accent bg-accent text-white"
                                          : "border-border"
                                      }`}
                                    >
                                      {isSelected && (
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            <div
                              onClick={handleSelectNewAddressMode}
                              className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col items-center justify-center text-center select-none min-h-[110px] ${
                                selectedAddressMode === "new"
                                  ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                                  : "border-dashed border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/50"
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center mb-1.5 text-accent">
                                <Plus className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-brand-primary">
                                ➕ Enviar a una nueva dirección
                              </span>
                              <span className="text-[10px] text-brand-secondary mt-0.5">
                                Fijar en el mapa
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Nueva Dirección: Mapa como fuente de verdad (Sin selector de distrito) */}
                        {selectedAddressMode === "new" && (
                          <div className="space-y-4 pt-3 border-t border-border bg-surface-subtle/40 p-4 rounded-card border mt-3 animate-in fade-in duration-150">
                            <div className="flex items-center gap-2 text-xs font-bold text-brand-primary">
                              <MapPin className="w-4 h-4 text-accent" />
                              <span>Nueva Dirección de Entrega</span>
                            </div>

                            {/* 1. MAPA PRIMERO (Reverse Geocoding) */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                                  Ubicación en el Mapa (Mueve el Pin)
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
                                height="h-56"
                              />
                              <p className="mt-1 text-[11px] text-brand-muted">
                                Mueve el marcador o pulsa «Usar mi ubicación
                                actual» para rellenar automáticamente tu
                                dirección y calcular el flete.
                              </p>
                            </div>

                            {/* 2. DIRECCIÓN EXACTA (Autocompletada) */}
                            <Input
                              label="Dirección Exacta"
                              id="checkout-new-address"
                              placeholder="Calle / Av. y número (se completa al mover el pin)"
                              value={deliveryAddress}
                              onChange={(e) =>
                                handleDeliveryAddressChange(e.target.value)
                              }
                              onBlur={() => {
                                if (deliveryAddress.trim().length >= 4) {
                                  searchAddressOnMap(
                                    `${deliveryAddress}, ${selectedZone?.district_name || ""}`,
                                  );
                                }
                              }}
                              required
                            />

                            {/* 3. REFERENCIA (Opcional) */}
                            <Input
                              label="Referencia de Llegada (Opcional)"
                              id="checkout-new-ref"
                              placeholder="Ej. Dpto 402, frente al parque, timbre blanco"
                              value={deliveryReference}
                              onChange={(e) =>
                                setDeliveryReference(e.target.value)
                              }
                            />

                            <div className="pt-2 border-t border-border space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-primary select-none">
                                <input
                                  type="checkbox"
                                  checked={saveAddressForFuture}
                                  onChange={(e) =>
                                    setSaveAddressForFuture(e.target.checked)
                                  }
                                  className="w-4 h-4 text-accent border-border rounded focus:ring-accent"
                                />
                                <span>
                                  Guardar esta dirección en mi cuenta para
                                  futuras compras
                                </span>
                              </label>

                              {saveAddressForFuture && (
                                <div className="pl-6 max-w-xs animate-in fade-in duration-100">
                                  <Input
                                    label="Alias de la dirección"
                                    id="checkout-new-alias"
                                    placeholder="Ej. Casa de playa, Oficina"
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
                      /* Modo Dirección Manual (Invitados o sin direcciones registradas, sin selector de distrito) */
                      <div className="space-y-4 pt-2 border-t border-border">
                        {/* 1. MAPA PRIMERO */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                              Ubicación en el Mapa (Mueve el Pin)
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
                            height="h-56"
                          />
                          <p className="mt-1 text-[11px] text-brand-muted">
                            Mueve el marcador o pulsa «Usar mi ubicación actual»
                            para rellenar automáticamente tu dirección y
                            calcular el flete.
                          </p>
                        </div>

                        {/* 2. DIRECCIÓN EXACTA */}
                        <Input
                          label="Dirección Exacta"
                          id="checkout-manual-address"
                          placeholder="Calle / Av. y número (se completa al mover el pin)"
                          value={deliveryAddress}
                          onChange={(e) =>
                            handleDeliveryAddressChange(e.target.value)
                          }
                          onBlur={() => {
                            if (deliveryAddress.trim().length >= 4) {
                              searchAddressOnMap(
                                `${deliveryAddress}, ${selectedZone?.district_name || ""}`,
                              );
                            }
                          }}
                          required
                        />

                        {/* 3. REFERENCIA (Opcional) */}
                        <Input
                          label="Referencia de Llegada (Opcional)"
                          id="checkout-manual-ref"
                          placeholder="Ej. Dpto 402, frente al parque, timbre blanco"
                          value={deliveryReference}
                          onChange={(e) => setDeliveryReference(e.target.value)}
                        />

                        {user && (
                          <div className="pt-2 border-t border-border space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-primary select-none">
                              <input
                                type="checkbox"
                                checked={saveAddressForFuture}
                                onChange={(e) =>
                                  setSaveAddressForFuture(e.target.checked)
                                }
                                className="w-4 h-4 text-accent border-border rounded focus:ring-accent"
                              />
                              <span>
                                Guardar esta dirección en mi cuenta para futuras
                                compras
                              </span>
                            </label>

                            {saveAddressForFuture && (
                              <div className="pl-6 max-w-xs animate-in fade-in duration-100">
                                <Input
                                  label="Alias de la dirección"
                                  id="checkout-manual-alias"
                                  placeholder="Ej. Casa, Oficina"
                                  value={newAddressAlias}
                                  onChange={(e) =>
                                    setNewAddressAlias(e.target.value)
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones Paso 2 */}
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
                        Ubicación fuera de cobertura para entrega a domicilio.
                      </span>
                    )}
                    {deliveryType !== "pickup" &&
                      !activeCoordinates &&
                      deliveryAddress.trim().length >= 4 && (
                        <span className="text-xs text-amber-600 font-medium text-right">
                          Fija el pin en el mapa para validar la cobertura.
                        </span>
                      )}
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={!isStep2Valid}
                    >
                      Continuar al Pago
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 3: Pago y Comprobante */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-base font-bold text-brand-primary">
                  3. Pago y Comprobante
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Selecciona tu forma de pago y los datos para tu comprobante.
                </p>
              </div>

              <form onSubmit={handleConfirmOrder} className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Tipo de Comprobante
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      onClick={() => setReceiptType("nota_venta")}
                      className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                        receiptType === "nota_venta"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-brand-primary">
                          Nota de Venta
                        </span>
                        {receiptType === "nota_venta" && (
                          <Check className="w-4 h-4 text-accent" />
                        )}
                      </div>
                      <span className="text-xs text-brand-secondary">
                        Control interno de pedido
                      </span>
                    </div>

                    <div
                      onClick={() => setReceiptType("boleta")}
                      className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                        receiptType === "boleta"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-brand-primary">
                          Boleta de Venta
                        </span>
                        {receiptType === "boleta" && (
                          <Check className="w-4 h-4 text-accent" />
                        )}
                      </div>
                      <span className="text-xs text-brand-secondary">
                        Consumo personal / DNI
                      </span>
                    </div>

                    <div
                      onClick={() => setReceiptType("factura")}
                      className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                        receiptType === "factura"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-brand-primary">
                          Factura Electrónica
                        </span>
                        {receiptType === "factura" && (
                          <Check className="w-4 h-4 text-accent" />
                        )}
                      </div>
                      <span className="text-xs text-brand-secondary">
                        Para empresas / RUC
                      </span>
                    </div>
                  </div>

                  {receiptType === "boleta" && (
                    <div className="p-3.5 bg-surface-subtle border border-border rounded-card text-xs space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-brand-secondary font-medium">
                          Titular del comprobante:
                        </span>
                        <span className="font-semibold text-brand-primary truncate max-w-[240px] text-right">
                          {firstName} {lastName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-brand-secondary font-medium">
                          Documento de Identidad:
                        </span>
                        <span className="font-mono font-semibold text-brand-primary">
                          DNI {dni}
                        </span>
                      </div>
                      <p className="text-[11px] text-brand-muted pt-1 border-t border-border/60">
                        La Boleta se emitirá automáticamente con los datos
                        verificados en el Paso 1.
                      </p>
                    </div>
                  )}

                  {receiptType === "nota_venta" && (
                    <div className="p-3 bg-surface-subtle border border-border rounded-card text-xs text-brand-secondary animate-in fade-in duration-150">
                      Comprobante para control interno y seguimiento de
                      despacho. No tiene efectos tributarios.
                    </div>
                  )}

                  {receiptType === "factura" && (
                    <div className="space-y-3.5 p-4 bg-surface-subtle border border-border rounded-card animate-in fade-in duration-150">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="checkout-ruc"
                            className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                          >
                            RUC (11 dígitos)
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
                              placeholder="20XXXXXXXXX o 10XXXXXXXXX"
                              value={ruc}
                              onChange={handleRucChange}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  triggerRucLookup();
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
                            className="h-10 px-3.5 flex-shrink-0"
                            title="Consultar RUC en SUNAT"
                          >
                            {isSearchingRuc ? (
                              <Loader2 className="w-4 h-4 animate-spin text-accent" />
                            ) : (
                              <Search className="w-4 h-4 text-brand-primary" />
                            )}
                          </Button>
                        </div>

                        {rucFeedback && (
                          <div
                            className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                              rucFeedback.type === "success"
                                ? "text-emerald-600 font-medium"
                                : rucFeedback.type === "error"
                                  ? "text-rose-600 font-medium"
                                  : "text-amber-600"
                            }`}
                          >
                            {rucFeedback.type === "success" ? (
                              <Check className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            <span>{rucFeedback.message}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1.5">
                            <label
                              htmlFor="checkout-company"
                              className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                            >
                              Razón Social
                            </label>
                            {isRucLocked && (
                              <button
                                type="button"
                                onClick={() => setIsRucLocked(false)}
                                className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Editar manualmente
                              </button>
                            )}
                          </div>
                          <Input
                            id="checkout-company"
                            placeholder="Nombre comercial o razón social"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            readOnly={isRucLocked}
                            className={
                              isRucLocked
                                ? "bg-slate-100 text-slate-700 cursor-not-allowed"
                                : ""
                            }
                            required
                          />
                        </div>

                        <Input
                          label="Dirección Fiscal (Opcional)"
                          id="checkout-fiscal-address"
                          placeholder="Dirección fiscal registrada"
                          value={fiscalAddress}
                          onChange={(e) => setFiscalAddress(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Métodos de Pago */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Método de Pago
                  </label>

                  <div className="space-y-3">
                    <div
                      onClick={() => setPaymentMethod("yape_plin")}
                      className={`p-4 rounded-card border cursor-pointer transition-all flex items-start gap-3 select-none ${
                        paymentMethod === "yape_plin"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/30"
                      }`}
                    >
                      <div className="mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors border-brand-primary bg-brand-primary text-white">
                        {paymentMethod === "yape_plin" ? (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-transparent" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-brand-primary">
                            Transferencia Directa (Yape / Plin Manual)
                          </span>
                          <Badge variant="neutral" className="text-[10px]">
                            Sin recargo
                          </Badge>
                        </div>
                        <span className="block text-xs text-brand-secondary mt-1">
                          Transfiere desde tu app bancaria e ingresa el número
                          de operación.
                        </span>
                      </div>
                    </div>

                    {paymentMethod === "yape_plin" && (
                      <div className="p-4 bg-surface-subtle border border-border rounded-card space-y-4 animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between sm:block border-b sm:border-b-0 border-border pb-1.5 sm:pb-0">
                              <span className="text-brand-secondary block text-[11px] uppercase tracking-wider font-semibold">
                                Número Institucional:
                              </span>
                              <span className="font-mono text-sm font-bold text-brand-primary">
                                987 654 321
                              </span>
                            </div>
                            <div className="flex justify-between sm:block border-b sm:border-b-0 border-border pb-1.5 sm:pb-0">
                              <span className="text-brand-secondary block text-[11px] uppercase tracking-wider font-semibold">
                                Titular:
                              </span>
                              <span className="font-semibold text-brand-primary">
                                ERXIDI S.A.C.
                              </span>
                            </div>
                            <div className="flex justify-between sm:block">
                              <span className="text-brand-secondary block text-[11px] uppercase tracking-wider font-semibold">
                                Monto a Transferir:
                              </span>
                              <span className="font-mono text-sm font-bold text-accent">
                                {formatCurrency(totalAmount)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-center justify-center p-3.5 bg-surface-card border border-border rounded-card text-center space-y-1.5">
                            <div className="w-24 h-24 rounded border border-border bg-white flex items-center justify-center p-2 shadow-xs">
                              <QrCode className="w-20 h-20 text-brand-primary" />
                            </div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                              QR Institucional Yape / Plin
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border space-y-1.5">
                          <Input
                            label="Número de Operación (6 a 8 dígitos)"
                            id="checkout-yape-op"
                            placeholder="Ej. 12345678"
                            value={yapeOpNumber}
                            onChange={(e) =>
                              setYapeOpNumber(
                                e.target.value.replace(/\D/g, "").slice(0, 8),
                              )
                            }
                            helperText="Ingresa el código numérico de 6 a 8 dígitos que figura en tu comprobante de Yape o Plin."
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div
                      onClick={() => setPaymentMethod("culqi_gateway")}
                      className={`p-4 rounded-card border cursor-pointer transition-all flex items-start gap-3 select-none ${
                        paymentMethod === "culqi_gateway"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/30"
                      }`}
                    >
                      <div className="mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors border-brand-primary bg-brand-primary text-white">
                        {paymentMethod === "culqi_gateway" ? (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-transparent" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-primary">
                              Pago Online Seguro (Culqi: Tarjetas y Yape App)
                            </span>
                            <Badge variant="success" className="text-[10px]">
                              Acreditación Inmediata
                            </Badge>
                          </div>
                          <CreditCard className="w-4 h-4 text-accent" />
                        </div>
                        <p className="text-xs text-brand-secondary mt-1">
                          Acepta Visa, Mastercard y Yape con código de
                          aprobación. Procesado de forma segura por Culqi.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => {
                        if (isCashOnDeliveryAllowed) {
                          setPaymentMethod("cash_on_delivery");
                        }
                      }}
                      className={`p-4 rounded-card border transition-all flex items-start gap-3 select-none ${
                        !isCashOnDeliveryAllowed
                          ? "border-border bg-surface-subtle opacity-70 cursor-not-allowed"
                          : paymentMethod === "cash_on_delivery"
                            ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary cursor-pointer"
                            : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/30 cursor-pointer"
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                          !isCashOnDeliveryAllowed
                            ? "border-border bg-surface-card text-brand-muted"
                            : paymentMethod === "cash_on_delivery"
                              ? "border-brand-primary bg-brand-primary text-white"
                              : "border-brand-secondary bg-surface-card text-white"
                        }`}
                      >
                        {paymentMethod === "cash_on_delivery" &&
                        isCashOnDeliveryAllowed ? (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-transparent" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-primary">
                              Pago Contra Entrega (Efectivo al recibir)
                            </span>
                            {!isCashOnDeliveryAllowed && (
                              <Badge variant="warning" className="text-[10px]">
                                Requiere cuenta verificada
                              </Badge>
                            )}
                          </div>
                          <Banknote className="w-4 h-4 text-accent" />
                        </div>

                        <p className="text-xs text-brand-secondary mt-1">
                          Cancela en efectivo exacto al momento de recibir tus
                          prendas.
                        </p>

                        {!isCashOnDeliveryAllowed && (
                          <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                            <span>
                              {!user
                                ? "Inicia sesión y verifica tu correo para habilitar pedidos con pago contra entrega."
                                : "Verifica tu correo electrónico para habilitar pedidos con pago contra entrega."}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isProcessing && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-card text-xs text-blue-800 flex items-center gap-2 animate-in fade-in duration-150">
                      <Loader2 className="w-4 h-4 animate-spin text-accent flex-shrink-0" />
                      <p className="font-medium">
                        Procesando pago seguro con Culqi. Por favor espera sin
                        recargar la página...
                      </p>
                    </div>
                  )}

                  {culqiError && (
                    <div className="p-3 bg-rose-50 border border-status-danger-border rounded-card text-xs text-status-danger-text flex items-start gap-2 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-status-danger-text" />
                      <div className="flex-1">
                        <p className="font-semibold">
                          Inconveniente con la pasarela
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
                    disabled={!isStep3Valid || isSubmitting || isProcessing}
                    isLoading={isSubmitting || isProcessing}
                    className="bg-accent hover:bg-accent-hover text-white px-8"
                  >
                    {isProcessing
                      ? "Procesando pago..."
                      : paymentMethod === "culqi_gateway"
                        ? `Pagar con Culqi ${formatCurrency(totalAmount)}`
                        : `Confirmar Pedido ${formatCurrency(totalAmount)}`}
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
                    <div className="w-10 h-12 rounded bg-surface-subtle border border-border overflow-hidden flex-shrink-0">
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
                  <span className="font-mono font-bold text-brand-primary flex-shrink-0">
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
              <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                Por motivos de higiene, la ropa interior no admite cambios ni
                devoluciones una vez entregada.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
